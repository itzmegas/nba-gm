-- Match the reported career: 30 known teams, NULL conferences, April 14, final fixtures pending.
UPDATE public.teams t SET abbreviation = mapping.abbreviations[(t.nba_id-10000)::INTEGER], conference=NULL
FROM (SELECT ARRAY['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS',
  'DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'] AS abbreviations) mapping;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b3000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001',
  'Missing conferences','b1000000-0000-4000-8000-000000000001',2026,'jordan','2027-04-14','active');
INSERT INTO public.scheduled_games(game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
SELECT 'b3000000-0000-4000-8000-000000000004',
  CASE WHEN game_date='2027-03-01' THEN DATE '2027-04-14' ELSE DATE '2027-04-15' END,
  home_team_id,away_team_id,CASE WHEN game_date='2027-03-01' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN game_date='2027-03-01' THEN home_score END,
  CASE WHEN game_date='2027-03-01' THEN away_score END,
  CASE WHEN game_date='2027-03-01' THEN winner_team_id END
FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000001' AND competition_phase='regular_season';
INSERT INTO public.league_standings(game_id,team_id,wins,losses)
SELECT 'b3000000-0000-4000-8000-000000000004',id,
  CASE WHEN nba_id<=10015 THEN 1 ELSE 0 END,CASE WHEN nba_id>10015 THEN 1 ELSE 0 END FROM public.teams;
CREATE TEMP TABLE conference_results_before AS SELECT * FROM public.scheduled_games;
CREATE TEMP TABLE conference_payloads_before AS SELECT * FROM public.game_box_scores;
CREATE TEMP TABLE conference_standings_before AS SELECT * FROM public.league_standings;
CREATE TEMP TABLE conference_qualifiers_before AS SELECT * FROM public.postseason_qualifications;
CREATE TEMP TABLE conference_games_before AS SELECT * FROM public.games;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000004','2027-04-14');
    RAISE EXCEPTION 'Expected missing conference failure';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Qualification requires 15 teams in each conference', 'Reproduced reported blocker';
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM conference_results_before EXCEPT SELECT * FROM public.scheduled_games), 'Failed final day changes no fixture';
  ASSERT NOT EXISTS (SELECT * FROM conference_standings_before EXCEPT SELECT * FROM public.league_standings), 'Failed final day changes no standings';
  ASSERT NOT EXISTS (SELECT * FROM conference_games_before EXCEPT SELECT * FROM public.games), 'Failed final day changes no clock';
END $$;
-- Empty metadata is also missing; unknown teams must not be guessed.
UPDATE public.teams SET conference='  ' WHERE abbreviation='BOS';
INSERT INTO public.teams(nba_id,name,city,abbreviation) VALUES (99999,'Unknown','Test','UNK');
\ir ../../../scripts/migrations/051_missing_team_conferences.sql
DO $$ BEGIN
  ASSERT (SELECT count(*)=15 FROM public.teams WHERE conference='East'), 'Fifteen East teams';
  ASSERT (SELECT count(*)=15 FROM public.teams WHERE conference='West'), 'Fifteen West teams';
  ASSERT (SELECT conference IS NULL FROM public.teams WHERE abbreviation='UNK'), 'Unknown teams untouched';
  ASSERT NOT EXISTS (SELECT * FROM conference_results_before EXCEPT SELECT * FROM public.scheduled_games), 'Repair changes no results';
  ASSERT NOT EXISTS (SELECT * FROM conference_payloads_before EXCEPT SELECT * FROM public.game_box_scores), 'Repair changes no box scores';
  ASSERT NOT EXISTS (SELECT * FROM conference_standings_before EXCEPT SELECT * FROM public.league_standings), 'Repair changes no standings';
  ASSERT NOT EXISTS (SELECT * FROM conference_qualifiers_before EXCEPT SELECT * FROM public.postseason_qualifications), 'Repair does not reclassify careers';
  ASSERT NOT EXISTS (SELECT * FROM conference_games_before EXCEPT SELECT * FROM public.games), 'Repair advances no careers';
END $$;
SET ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT bool_and(new_date='2027-04-15' AND NOT season_complete) FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000004','2027-04-14')), 'Same pending final day now completes';
  ASSERT (SELECT count(*)=30 FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000004'), 'Qualification succeeds';
  ASSERT (SELECT count(*)=4 FROM public.postseason_play_in_games WHERE game_id='b3000000-0000-4000-8000-000000000004'), 'Play-in scheduled';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM conference_results_before WHERE status='completed' EXCEPT SELECT * FROM public.scheduled_games), 'Completed games never replayed';
  ASSERT NOT EXISTS (SELECT * FROM conference_payloads_before EXCEPT SELECT * FROM public.game_box_scores), 'Historical payloads unchanged';
END $$;
-- Existing non-empty data, even when noncanonical, must not be silently overwritten.
UPDATE public.teams SET conference='West' WHERE abbreviation='ATL';
CREATE TEMP TABLE conference_teams_after AS SELECT * FROM public.teams;
\ir ../../../scripts/migrations/051_missing_team_conferences.sql
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM conference_teams_after EXCEPT SELECT * FROM public.teams), 'Idempotent repair preserves non-empty metadata';
END $$;
