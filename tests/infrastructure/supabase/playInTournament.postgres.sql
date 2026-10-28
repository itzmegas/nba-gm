DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_play_in_games), 'Migration does not advance careers';
  ASSERT (SELECT count(*)=0 FROM public.postseason_playoff_seeds), 'Migration does not seed careers';
  ASSERT NOT has_table_privilege('authenticated','public.postseason_playoff_seeds','INSERT'), 'No client seed writes';
  ASSERT NOT has_table_privilege('authenticated','public.postseason_play_in_games','INSERT'), 'No client fixture writes';
  ASSERT NOT has_function_privilege('authenticated','public.prepare_play_in(uuid)','EXECUTE'), 'No preparation bypass';
  ASSERT NOT has_function_privilege('authenticated','public.advance_qualification_day(uuid,date)','EXECUTE'), 'No qualification bypass';
END $$;

-- An existing modern career exercises the actual v2 possession engine after April 15.
UPDATE public.games SET season_era_id='modern' WHERE id='b3000000-0000-4000-8000-000000000002';
CREATE TEMP TABLE playin_roster AS SELECT gen_random_uuid() AS player_id,q.team_id,n
  FROM public.postseason_qualifications q CROSS JOIN generate_series(1,9) n
  WHERE q.game_id='b3000000-0000-4000-8000-000000000002' AND q.seed BETWEEN 7 AND 10;
INSERT INTO public.players(id,first_name,last_name,full_name,position,is_active)
  SELECT player_id,'Play-in',n::TEXT,'Play-in player '||n,'G',true FROM playin_roster;
INSERT INTO public.game_player_states(game_id,player_id,team_id,is_active,is_injured)
  SELECT 'b3000000-0000-4000-8000-000000000002',player_id,team_id,true,false FROM playin_roster;
INSERT INTO public.player_rating_source_versions(id,game_version,content_hash,payload)
  VALUES ('b4000000-0000-4000-8000-000000000001','2K27',repeat('b',64),'{}');
INSERT INTO public.game_attribute_materializations(game_id,season_year,source_version_id,player_count)
  VALUES ('b3000000-0000-4000-8000-000000000002',2026,'b4000000-0000-4000-8000-000000000001',72);
INSERT INTO public.game_player_attributes(game_id,season_year,player_id,origin,match_method,attributes,generator_version,identity_evidence)
  SELECT 'b3000000-0000-4000-8000-000000000002',2026,player_id,'estimated','missing-source',
    (SELECT jsonb_object_agg(key,70) FROM unnest(ARRAY['closeShot','midRangeShot','threePointShot',
      'freeThrow','drawFoul','ballHandle','passAccuracy','interiorDefense','perimeterDefense',
      'steal','block','offensiveRebound','defensiveRebound','stamina']) key),'replacement-v1','{}'
  FROM playin_roster;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
  ASSERT (SELECT NOT season_complete AND new_date='2027-04-16' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000002','2027-04-15')), 'Resume frozen career after April 15';
  ASSERT (SELECT count(*)=4 FROM public.postseason_play_in_games), 'Four first-stage fixtures';
  ASSERT (SELECT count(*)=12 FROM public.postseason_playoff_seeds), 'Six direct seeds per conference';
  ASSERT (SELECT new_date='2027-04-16' AND NOT season_complete FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000002','2027-04-15')), 'Stale day does not duplicate play-in';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p JOIN public.scheduled_games f
    ON f.id=p.scheduled_game_id JOIN public.postseason_qualifications home ON home.game_id=p.game_id
      AND home.season_year=p.season_year AND home.team_id=f.home_team_id
    JOIN public.postseason_qualifications away ON away.game_id=p.game_id AND away.season_year=p.season_year AND away.team_id=f.away_team_id
    WHERE f.game_date<>'2027-04-17' OR f.competition_phase<>'play_in'
      OR home.seed<>CASE WHEN p.stage='seven_eight' THEN 7 ELSE 9 END
      OR away.seed<>home.seed+1), 'Correct pairings, home court and rest day';
END $$;

CREATE TEMP TABLE missing_attribute AS SELECT * FROM public.game_player_attributes LIMIT 1;
DELETE FROM public.game_player_attributes WHERE (game_id,season_year,player_id)
  IN (SELECT game_id,season_year,player_id FROM missing_attribute);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000002','2027-04-16');
    RAISE EXCEPTION 'Expected attribute failure';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Player attribute coverage is incomplete', 'Existing engine validation retained';
  END;
END $$;
RESET ROLE;
INSERT INTO public.game_player_attributes SELECT * FROM missing_attribute;
DO $$ BEGIN
  ASSERT (SELECT simulation_date='2027-04-16' FROM public.games WHERE id='b3000000-0000-4000-8000-000000000002'), 'Failed play-in day rolls back clock';
  ASSERT (SELECT count(*)=0 FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000002' AND competition_phase='play_in' AND status='completed'), 'Failed day rolls back all results';
  ASSERT (SELECT count(*)=0 FROM public.game_box_scores b JOIN public.scheduled_games f ON f.id=b.scheduled_game_id WHERE f.competition_phase='play_in'), 'Failed day rolls back all box scores';
END $$;

-- Exercise preparation failure and a career which has not frozen qualification yet.
CREATE FUNCTION public.fail_playin_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.conference='West' THEN RAISE EXCEPTION 'Injected play-in failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_playin_fixture BEFORE INSERT ON public.postseason_play_in_games
  FOR EACH ROW EXECUTE FUNCTION public.fail_playin_fixture();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_play_in_games), 'Owner isolation';
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-02');
    RAISE EXCEPTION 'Expected injected play-in failure';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Injected play-in failure', 'Preparation failure returned'; END;
  ASSERT (SELECT count(*)=0 FROM public.postseason_playoff_seeds), 'No partial direct seeds';
END $$;
RESET ROLE;
DROP TRIGGER fail_playin_fixture ON public.postseason_play_in_games;
DROP FUNCTION public.fail_playin_fixture();
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000001' AND competition_phase='play_in'), 'No orphan fixtures';
END $$;
DELETE FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT NOT season_complete AND new_date='2027-03-02' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000003','2027-03-02')), 'Qualification flows into generated play-in without claiming completion';
END $$;
-- Complete the legacy play-in: March 3 rest, March 4 first stage, March 5 rest, March 6 final stage.
SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-02');
SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-03');
SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-04');
DO $$ BEGIN
  ASSERT (SELECT bool_and(season_complete) FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-03-05')), 'Final play-in day stops at sixteen playoff seeds';
  ASSERT (SELECT count(*)=16 FROM public.postseason_playoff_seeds WHERE game_id='b3000000-0000-4000-8000-000000000001'), 'Sixteen playoff teams';
  ASSERT (SELECT new_date='2027-03-06' AND season_complete FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-03-06')), 'Ready for playoffs is an idempotent stop';
END $$;
RESET ROLE;

-- A new final regular-season day must generate play-in and let a batch continue.
BEGIN;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b3000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001',
  'Final regular day','b1000000-0000-4000-8000-000000000001',2026,'jordan','2027-03-01','active');
INSERT INTO public.scheduled_games(game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
SELECT 'b3000000-0000-4000-8000-000000000004',game_date,home_team_id,away_team_id,
  CASE WHEN game_date='2027-03-01' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN game_date='2027-03-01' THEN home_score END,
  CASE WHEN game_date='2027-03-01' THEN away_score END,
  CASE WHEN game_date='2027-03-01' THEN winner_team_id END
FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000001' AND competition_phase='regular_season';
INSERT INTO public.league_standings(game_id,team_id,wins,losses)
SELECT 'b3000000-0000-4000-8000-000000000004',id,
  CASE WHEN conference='East' THEN 1 ELSE 0 END,CASE WHEN conference='West' THEN 1 ELSE 0 END FROM public.teams;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  ASSERT (SELECT bool_and(NOT season_complete AND new_date='2027-03-02') FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000004','2027-03-01')), 'Regular completion does not terminate batch';
  ASSERT (SELECT count(*)=30 FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000004'), 'Regular completion freezes seeds';
  ASSERT (SELECT count(*)=4 FROM public.postseason_play_in_games WHERE game_id='b3000000-0000-4000-8000-000000000004'), 'Regular completion schedules first play-in stage';
END $$;
ROLLBACK;

-- AFTER_CONCURRENT_PLAY_IN
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
  ASSERT (SELECT count(*)=6 FROM public.postseason_play_in_games), 'Concurrent stage creates only two final fixtures';
  ASSERT (SELECT count(*)=14 FROM public.postseason_playoff_seeds), 'Concurrent first stage seeds only two winners';
  ASSERT (SELECT count(*)=4 FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000002' AND competition_phase='play_in' AND status='completed'), 'First stage simulated once';
END $$;
SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000002','2027-04-17');
DO $$ BEGIN
  ASSERT (SELECT bool_and(season_complete) FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000002','2027-04-18')), 'Modern play-in ends after final stage';
  ASSERT public.get_player_season_statistics('b3000000-0000-4000-8000-000000000002',2026,'play_in')->>'coveredGames'='6', 'Separate play-in statistics';
  ASSERT public.get_player_season_statistics('b3000000-0000-4000-8000-000000000002',2026,'regular_season')->>'coveredGames'='1', 'Regular statistics unchanged';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*)=6 FROM public.game_box_scores b JOIN public.scheduled_games f ON f.id=b.scheduled_game_id
    WHERE f.game_id='b3000000-0000-4000-8000-000000000002' AND f.competition_phase='play_in'
      AND b.payload->>'engineVersion'='possessions-v2'
      AND (b.payload->>'homeScore')::INTEGER=f.home_score AND (b.payload->>'awayScore')::INTEGER=f.away_score), 'Persisted modern box scores match all six results';
  ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p JOIN public.scheduled_games f ON f.id=p.scheduled_game_id
    JOIN public.postseason_playoff_seeds s ON s.game_id=p.game_id AND s.season_year=p.season_year
      AND s.conference=p.conference AND s.seed=CASE WHEN p.stage='seven_eight' THEN 7 ELSE 8 END
    WHERE p.stage IN ('seven_eight','eighth_seed') AND f.status='completed' AND s.team_id<>f.winner_team_id), 'Correct seventh and eighth seeds';
  ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p JOIN public.scheduled_games a ON a.id=p.scheduled_game_id
    JOIN public.postseason_play_in_games last ON last.game_id=p.game_id AND last.season_year=p.season_year
      AND last.conference=p.conference AND last.stage='eighth_seed'
    JOIN public.scheduled_games c ON c.id=last.scheduled_game_id
    WHERE p.stage='seven_eight' AND (c.home_team_id<>CASE WHEN a.winner_team_id=a.home_team_id THEN a.away_team_id ELSE a.home_team_id END
      OR c.game_date<>a.game_date+2)), 'Loser of 7v8 hosts the last chance with a rest day';
  ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p JOIN public.scheduled_games b ON b.id=p.scheduled_game_id
    JOIN public.postseason_play_in_games last ON last.game_id=p.game_id AND last.season_year=p.season_year
      AND last.conference=p.conference AND last.stage='eighth_seed'
    JOIN public.scheduled_games c ON c.id=last.scheduled_game_id
    WHERE p.stage='nine_ten' AND c.away_team_id<>b.winner_team_id), 'Winner of 9v10 visits the last chance';
END $$;
