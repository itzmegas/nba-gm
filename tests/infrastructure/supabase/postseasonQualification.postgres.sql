INSERT INTO auth.users(id) VALUES
  ('b0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
INSERT INTO public.teams(id,nba_id,name,city,abbreviation,conference,base_rating)
SELECT ('b1000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
  10000+n, 'Team '||n, 'Test', 'T'||n, CASE WHEN n <= 15 THEN 'East' ELSE 'West' END, 75
FROM generate_series(1,30) n;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
SELECT ('b3000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
  ('b0000000-0000-4000-8000-' || lpad(CASE WHEN n=2 THEN '2' ELSE '1' END,12,'0'))::UUID,
  'Qualification test', 'b1000000-0000-4000-8000-000000000001', 2026, 'jordan',
  CASE WHEN n=2 THEN DATE '2027-04-15' ELSE DATE '2027-03-01' END, 'active'
FROM generate_series(1,3) n;
INSERT INTO public.scheduled_games(game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
SELECT g.id, DATE '2027-03-01' + day,
  ('b1000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
  ('b1000000-0000-4000-8000-' || lpad((n+15)::TEXT,12,'0'))::UUID,
  CASE WHEN day=0 OR g.simulation_date='2027-04-15' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN day=0 OR g.simulation_date='2027-04-15' THEN 100 END,
  CASE WHEN day=0 OR g.simulation_date='2027-04-15' THEN 90 END,
  CASE WHEN day=0 OR g.simulation_date='2027-04-15'
    THEN ('b1000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID END
FROM public.games g CROSS JOIN generate_series(1,15) n CROSS JOIN generate_series(0,1) day;
INSERT INTO public.league_standings(game_id,team_id,wins,losses)
SELECT g.id,t.id,
  count(*) FILTER (WHERE f.winner_team_id=t.id),
  count(*) FILTER (WHERE f.status='completed' AND f.winner_team_id<>t.id)
FROM public.games g CROSS JOIN public.teams t
LEFT JOIN public.scheduled_games f ON f.game_id=g.id AND t.id IN (f.home_team_id,f.away_team_id)
GROUP BY g.id,t.id;

-- A real-shaped historical payload must survive both migration and finalization unchanged.
INSERT INTO public.game_box_scores(game_id,scheduled_game_id,payload)
SELECT f.game_id,f.id,jsonb_build_object('engineVersion','possessions-v1',
  'homeScore',100,'awayScore',90,'overtimes',0,'players',
  (SELECT jsonb_agg(jsonb_build_object('playerId',gen_random_uuid(),'playerName','Historical player',
    'side',CASE WHEN n<=5 THEN 'home' ELSE 'away' END,'seconds',2880,
    'fieldGoalsMade',CASE WHEN n<=5 THEN 10 ELSE 9 END,
    'fieldGoalsAttempted',10,'threePointersMade',0,'threePointersAttempted',0,
    'freeThrowsMade',0,'freeThrowsAttempted',0,'offensiveRebounds',0,'defensiveRebounds',0,
    'assists',0,'steals',0,'blocks',0,'turnovers',0,'personalFouls',0,
    'points',CASE WHEN n<=5 THEN 20 ELSE 18 END)) FROM generate_series(1,10) n))
FROM public.scheduled_games f WHERE f.game_date='2027-03-01'
  AND f.home_team_id='b1000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE historical_results AS SELECT * FROM public.scheduled_games WHERE status='completed';
CREATE TEMP TABLE historical_payloads AS SELECT * FROM public.game_box_scores;

-- AFTER_MIGRATION_049
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM historical_results EXCEPT SELECT * FROM public.scheduled_games), 'Migration preserves results';
  ASSERT NOT EXISTS (SELECT * FROM historical_payloads EXCEPT SELECT * FROM public.game_box_scores), 'Migration preserves payloads';
  ASSERT (SELECT count(*)=0 FROM public.postseason_qualifications), 'Migration does not advance existing careers';
  ASSERT NOT has_table_privilege('authenticated','public.postseason_qualifications','INSERT'), 'No client writes';
  ASSERT NOT has_function_privilege('authenticated','public.freeze_postseason_qualification(uuid)','EXECUTE'), 'No freeze bypass';
  ASSERT NOT has_function_privilege('authenticated','public.rank_postseason_group(jsonb,jsonb,integer)','EXECUTE'), 'No ranking bypass';
  ASSERT NOT has_function_privilege('authenticated','public.advance_regular_season_day(uuid,date)','EXECUTE'), 'No old daily bypass';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
  ASSERT (SELECT NOT season_complete AND new_date='2027-03-01' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-02-28')), 'Stale retry does not finalize or advance';
  ASSERT (SELECT count(*)=0 FROM public.postseason_qualifications), 'Pending schedule cannot qualify';
END $$;
SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-01');
DO $$ BEGIN
  ASSERT (SELECT count(*)=30 FROM public.postseason_qualifications), 'Thirty frozen qualifiers';
  ASSERT (SELECT count(*)=12 FROM public.postseason_qualifications WHERE seed<=6), 'Twelve direct places';
  ASSERT (SELECT count(*)=8 FROM public.postseason_qualifications WHERE seed BETWEEN 7 AND 10), 'Eight play-in places';
  ASSERT (SELECT season_complete AND new_date='2027-03-02' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-03-02')), 'Terminal retry does not move clock';
  ASSERT (SELECT season_complete AND new_date='2027-03-02' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-03-01')), 'Stale final-day retry recognizes frozen state';
END $$;
RESET ROLE;
CREATE TEMP TABLE frozen_qualifiers AS SELECT * FROM public.postseason_qualifications;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM historical_results EXCEPT SELECT * FROM public.scheduled_games), 'Finalization preserves historical results';
  ASSERT NOT EXISTS (SELECT * FROM historical_payloads EXCEPT SELECT * FROM public.game_box_scores), 'Finalization preserves payloads';
  ASSERT (SELECT count(*)=3 FROM public.game_box_scores), 'No invented historical or legacy box scores';
  ASSERT (SELECT simulation_date='2027-03-02' AND season_year=2026 FROM public.games
    WHERE id='b3000000-0000-4000-8000-000000000001'), 'Close on actual last fixture without rollover';
END $$;

UPDATE public.games SET status='deleted',deleted_at=now() WHERE id='b3000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_qualifications), 'Deleted career is not readable';
END $$;
RESET ROLE;
UPDATE public.games SET status='active',deleted_at=NULL WHERE id='b3000000-0000-4000-8000-000000000001';

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_qualifications), 'Other owner cannot read qualifiers';
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-03-02');
    RAISE EXCEPTION 'Expected access rejection';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Game not found or access denied', 'Other owner cannot advance';
  END;
  ASSERT (SELECT season_complete AND new_date='2027-04-15' FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000002','2027-04-15')), 'Existing terminal career can finalize without resimulation';
  ASSERT (SELECT count(*)=30 FROM public.postseason_qualifications), 'Second career has independent snapshot';
END $$;
RESET ROLE;

-- Fail after the East has been inserted: the final games, standings and clock must roll back too.
CREATE FUNCTION public.fail_qualification_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.conference='West' THEN RAISE EXCEPTION 'Injected qualification failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_qualification_fixture BEFORE INSERT ON public.postseason_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.fail_qualification_fixture();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000003','2027-03-01');
    RAISE EXCEPTION 'Expected injected failure';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Injected qualification failure', 'Expected injected failure';
  END;
  ASSERT (SELECT count(*)=0 FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000003'), 'No partial seeds';
END $$;
RESET ROLE;
DROP TRIGGER fail_qualification_fixture ON public.postseason_qualifications;
DROP FUNCTION public.fail_qualification_fixture();
DO $$ BEGIN
  ASSERT (SELECT simulation_date='2027-03-01' FROM public.games WHERE id='b3000000-0000-4000-8000-000000000003'), 'Clock rollback';
  ASSERT (SELECT count(*)=15 FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000003' AND status='scheduled'), 'Results rollback';
  ASSERT (SELECT sum(wins)=15 AND sum(losses)=15 FROM public.league_standings WHERE game_id='b3000000-0000-4000-8000-000000000003'), 'Standings rollback';
END $$;
UPDATE public.league_standings SET wins=wins+1 WHERE game_id='b3000000-0000-4000-8000-000000000003'
  AND team_id='b1000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000003','2027-03-01');
    RAISE EXCEPTION 'Expected integrity rejection';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Standings do not match stored regular-season results', 'Never repair missing history silently';
  END;
END $$;
RESET ROLE;
UPDATE public.league_standings SET wins=wins-1 WHERE game_id='b3000000-0000-4000-8000-000000000003'
  AND team_id='b1000000-0000-4000-8000-000000000001';

UPDATE public.games SET simulation_date='2027-04-15' WHERE id='b3000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000003','2027-04-15');
    RAISE EXCEPTION 'Expected incomplete schedule rejection';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM='Regular-season schedule is incomplete at the simulation boundary', 'Calendar date alone cannot qualify';
  END;
END $$;
RESET ROLE;
UPDATE public.games SET simulation_date='2027-03-01' WHERE id='b3000000-0000-4000-8000-000000000003';

DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM frozen_qualifiers EXCEPT SELECT * FROM public.postseason_qualifications), 'Frozen seeds and draw never change on retries';
END $$;

-- Phase filtering: an already recorded postseason fixture cannot affect qualification.
INSERT INTO public.scheduled_games(game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id,competition_phase)
VALUES ('b3000000-0000-4000-8000-000000000003','2027-02-28',
  'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000016',
  'completed',1,200,'b1000000-0000-4000-8000-000000000016','playoffs');
