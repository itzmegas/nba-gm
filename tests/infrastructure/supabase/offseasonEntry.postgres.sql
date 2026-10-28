INSERT INTO auth.users(id) VALUES
  ('c0000000-0000-4000-8000-000000000001'), ('c0000000-0000-4000-8000-000000000002');
INSERT INTO public.teams(id,nba_id,name,city,abbreviation,conference) VALUES
  ('c1000000-0000-4000-8000-000000000001',11001,'Home','Test','HOM','East'),
  ('c1000000-0000-4000-8000-000000000002',11002,'Away','Test','AWY','West');
INSERT INTO public.players(id,first_name,last_name,full_name,position)
  SELECT ('c2000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,
    'Player',n::TEXT,'Player '||n,'G' FROM generate_series(1,10) n;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
  VALUES ('c3000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',
    'Offseason entry','c1000000-0000-4000-8000-000000000001',2026,'jordan','2027-06-10','initializing');
INSERT INTO public.game_player_states(game_id,player_id,team_id)
  SELECT g.id,p.id,('c1000000-0000-4000-8000-'||lpad(CASE WHEN p.last_name::INTEGER<=5 THEN '1' ELSE '2' END,12,'0'))::UUID
    FROM public.games g CROSS JOIN public.players p;
INSERT INTO public.contracts(game_id,player_id,team_id,start_year,end_year,salary_y1,is_player_option)
  SELECT game_id,player_id,team_id,2026,2027,1000000,true FROM public.game_player_states;
INSERT INTO public.game_contract_materializations(game_id,source,season,source_version_ids)
  SELECT id,'test','2026-27',array_fill(gen_random_uuid(),ARRAY[30]) FROM public.games;
INSERT INTO public.game_contract_identities(game_id,player_id,team_id,resolution_status,contract_type,provenance_quality,cap_treatment)
  SELECT game_id,player_id,team_id,'observed-standard','standard','observed','standard-cap-and-matching'
    FROM public.game_player_states;
INSERT INTO public.game_contract_agreements(game_id,player_id,team_id,start_season_label,end_season_label,
  contract_type,provenance_quality,source_method,cap_treatment)
  SELECT game_id,player_id,team_id,'2026-27','2027-28','standard','observed','test','standard-cap-and-matching'
    FROM public.game_player_states;
INSERT INTO public.game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind)
  SELECT id,game_id,'2026-27',2026,2027,1000000,'none','guaranteed' FROM public.game_contract_agreements
  UNION ALL SELECT id,game_id,'2027-28',2027,2028,NULL,'unknown','unknown' FROM public.game_contract_agreements;
INSERT INTO public.player_rating_source_versions(id,game_version,content_hash,payload)
  VALUES ('c4000000-0000-4000-8000-000000000001','2K27',repeat('c',64),'{}');
INSERT INTO public.game_attribute_materializations(game_id,season_year,source_version_id,player_count)
  SELECT id,2026,'c4000000-0000-4000-8000-000000000001',10 FROM public.games;
INSERT INTO public.game_player_attributes(game_id,season_year,player_id,origin,match_method,attributes,generator_version,identity_evidence)
  SELECT game_id,2026,player_id,'estimated','missing-source',
    (SELECT jsonb_object_agg(k,70) FROM unnest(ARRAY['closeShot','midRangeShot','threePointShot','freeThrow',
      'drawFoul','ballHandle','passAccuracy','interiorDefense','perimeterDefense','steal','block',
      'offensiveRebound','defensiveRebound','stamina']) k),'replacement-v1','{}' FROM public.game_player_states;
UPDATE public.games SET status='active';
INSERT INTO public.scheduled_games(id,game_id,season_year,competition_phase,game_date,home_team_id,away_team_id,
  status,home_score,away_score,winner_team_id)
  SELECT ('c5000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,g.id,2026,
    CASE WHEN n=1 THEN 'regular_season' ELSE 'playoffs' END,DATE '2027-06-08'+n,
    'c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002',
    'completed',100,90,'c1000000-0000-4000-8000-000000000001'
    FROM public.games g CROSS JOIN generate_series(1,2) n;
INSERT INTO public.game_box_scores(game_id,scheduled_game_id,payload)
  SELECT f.game_id,f.id,jsonb_build_object('engineVersion','possessions-v2','homeScore',100,'awayScore',90,
    'overtimes',0,'players',(SELECT jsonb_agg(jsonb_build_object('playerId',p.id,'playerName',p.full_name,
      'side',CASE WHEN p.last_name::INTEGER<=5 THEN 'home' ELSE 'away' END,'seconds',2880,
      'fieldGoalsMade',CASE WHEN p.last_name::INTEGER<=5 THEN 10 ELSE 9 END,'fieldGoalsAttempted',10,
      'threePointersMade',0,'threePointersAttempted',0,'freeThrowsMade',0,'freeThrowsAttempted',0,
      'offensiveRebounds',0,'defensiveRebounds',0,'assists',0,'steals',0,'blocks',0,'turnovers',0,
      'personalFouls',0,'points',CASE WHEN p.last_name::INTEGER<=5 THEN 20 ELSE 18 END)) FROM public.players p))
    FROM public.scheduled_games f;
INSERT INTO public.league_standings(game_id,team_id,wins,losses)
  SELECT g.id,t.id,CASE WHEN t.conference='East' THEN 1 ELSE 0 END,
    CASE WHEN t.conference='West' THEN 1 ELSE 0 END FROM public.games g CROSS JOIN public.teams t;
INSERT INTO public.postseason_qualifications(game_id,season_year,team_id,conference,seed,wins,losses,draw_order)
  SELECT s.game_id,2026,s.team_id,t.conference,1,s.wins,s.losses,row_number() OVER (ORDER BY t.id)
    FROM public.league_standings s JOIN public.teams t ON t.id=s.team_id;
INSERT INTO public.postseason_playoff_seeds SELECT game_id,season_year,team_id,conference,seed FROM public.postseason_qualifications;
INSERT INTO public.postseason_series(id,game_id,season_year,round,conference,bracket_slot,home_team_id,away_team_id,
  home_wins,away_wins,winner_team_id)
  SELECT 'c6000000-0000-4000-8000-000000000001',id,2026,4,'Finals',1,
    'c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002',4,0,
    'c1000000-0000-4000-8000-000000000001' FROM public.games;
INSERT INTO public.postseason_series_games SELECT game_id,'c6000000-0000-4000-8000-000000000001',1,id
  FROM public.scheduled_games WHERE competition_phase='playoffs';

-- Snapshot every existing public table, including empty ones, not only selected history fields.
CREATE FUNCTION public.test_offseason_history() RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE t TEXT; rows JSONB; snapshot JSONB:='{}';
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'game_offseasons' ORDER BY tablename LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::TEXT),''[]''::JSONB) FROM public.%I r',t) INTO rows;
    snapshot:=snapshot||jsonb_build_object(t,rows);
  END LOOP;
  RETURN snapshot;
END $$;
REVOKE ALL ON FUNCTION public.test_offseason_history() FROM PUBLIC;
CREATE FUNCTION public.test_offseason_error(statement TEXT, expected TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN ASSERT SQLERRM=expected, SQLERRM; RETURN; END;
  RAISE EXCEPTION 'Expected rejection: %',expected;
END $$;
CREATE TEMP TABLE upgrade_history AS SELECT public.test_offseason_history() AS snapshot;

-- AFTER_MIGRATION_053
DO $$ DECLARE role_name TEXT; operation TEXT; BEGIN
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM upgrade_history), 'Installation changes no existing data';
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseasons), 'Installation enters no career';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.game_offseasons'::REGCLASS), 'RLS enabled';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      ASSERT NOT has_table_privilege(role_name,'public.game_offseasons',operation), 'No direct writes, even with BYPASSRLS';
    END LOOP;
    ASSERT has_function_privilege(role_name,'public.enter_offseason(uuid,integer)','EXECUTE')=(role_name='authenticated'), 'Only authenticated entry';
    ASSERT has_table_privilege(role_name,'public.game_offseasons','SELECT')=(role_name='authenticated'), 'Only authenticated reads';
  END LOOP;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Completed championship required');
RESET ROLE;
DO $$ BEGIN
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM upgrade_history), 'Rejected entry changes nothing';
END $$;
-- The same career now has a persisted championship, without a full-season simulation.
INSERT INTO public.postseason_results SELECT game_id,season_year,id,home_team_id,away_team_id,DATE '2027-06-10'
  FROM public.postseason_series;
CREATE TEMP TABLE entry_history AS SELECT public.test_offseason_history() AS snapshot;
BEGIN;
SET ROLE authenticated;
DO $$ DECLARE entry JSONB; state JSONB; BEGIN
  state:=public.get_postseason_state('c3000000-0000-4000-8000-000000000001');
  entry:=public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026);
  ASSERT entry=jsonb_build_object('seasonYear',2026,'enteredAt',(SELECT entered_at FROM public.game_offseasons)), 'Return persisted marker';
  ASSERT entry=public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026), 'Idempotent entry';
  ASSERT (SELECT count(*)=1 FROM public.game_offseasons), 'One owner-readable marker';
  ASSERT state=public.get_postseason_state('c3000000-0000-4000-8000-000000000001') AND state->>'phase'='complete', 'Championship view stays original';
  ASSERT (SELECT count(*)=1 AND bool_and(season_complete AND new_date=DATE '2027-06-10' AND result_id IS NULL)
    FROM public.advance_simulation_day('c3000000-0000-4000-8000-000000000001','2027-06-10')), 'Daily advance remains terminal';
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2025)$q$,'Season year does not match the current season');
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2027)$q$,'Season year does not match the current season');
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',NULL)$q$,'Season year does not match the current season');
  PERFORM public.test_offseason_error('SELECT public.enter_offseason(NULL,2026)','Game not found or access denied');
  PERFORM public.test_offseason_error($q$INSERT INTO public.game_offseasons(game_id,season_year) VALUES ('c3000000-0000-4000-8000-000000000001',2026)$q$,'permission denied for table game_offseasons');
  PERFORM public.test_offseason_error('UPDATE public.game_offseasons SET entered_at=now()','permission denied for table game_offseasons');
  PERFORM public.test_offseason_error('DELETE FROM public.game_offseasons','permission denied for table game_offseasons');
  PERFORM public.test_offseason_error('TRUNCATE public.game_offseasons','permission denied for table game_offseasons');
END $$;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseasons), 'Other owner cannot read entry';
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Authentication required');
RESET ROLE;
SET ROLE anon;
SELECT public.test_offseason_error('SELECT * FROM public.game_offseasons','permission denied for table game_offseasons');
SELECT public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'permission denied for function enter_offseason');
RESET ROLE;
SET ROLE service_role;
SELECT public.test_offseason_error('SELECT * FROM public.game_offseasons','permission denied for table game_offseasons');
SELECT public.test_offseason_error('DELETE FROM public.game_offseasons','permission denied for table game_offseasons');
SELECT public.test_offseason_error('TRUNCATE public.game_offseasons','permission denied for table game_offseasons');
SELECT public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'permission denied for function enter_offseason');
RESET ROLE;
DO $$ BEGIN
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM entry_history), 'Entry/retries/security checks change no existing rows';
END $$;
ROLLBACK;

-- Fail after insertion, not before: the marker must roll back with the exception.
CREATE FUNCTION public.test_fail_offseason() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.game_offseasons WHERE game_id=NEW.game_id), 'Marker was inserted';
  RAISE EXCEPTION 'Injected offseason failure';
END $$;
CREATE TRIGGER test_fail_offseason AFTER INSERT ON public.game_offseasons FOR EACH ROW EXECUTE FUNCTION public.test_fail_offseason();
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Injected offseason failure');
RESET ROLE;
DROP TRIGGER test_fail_offseason ON public.game_offseasons;
DROP FUNCTION public.test_fail_offseason();
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseasons), 'Exception rolls back marker';
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM entry_history), 'Exception preserves all existing data';
END $$;

-- Inactive/deleted checks also run against a marker, exercising RLS soft-delete hiding.
BEGIN;
INSERT INTO public.game_offseasons(game_id,season_year) SELECT game_id,season_year FROM public.postseason_results;
UPDATE public.games SET status='archived';
SET ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*)=1 FROM public.game_offseasons), 'Nondeleted inactive owner can read';
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
END $$;
RESET ROLE;
UPDATE public.games SET status='deleted',deleted_at=now();
SET ROLE authenticated;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseasons), 'Deleted owner cannot read';
  PERFORM public.test_offseason_error($q$SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
END $$;
RESET ROLE;
ROLLBACK;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseasons), 'Concurrency fixture starts without a marker';
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM entry_history), 'All existing data unchanged';
END $$;
