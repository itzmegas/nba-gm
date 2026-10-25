-- Reuse the championship fixture, then give each controlled player a distinct evidence case.
UPDATE public.games SET status='initializing';
SET session_replication_role=replica;
DELETE FROM public.game_contract_seasons WHERE start_year=2027;
UPDATE public.game_contract_agreements SET end_season_label='2026-27';
INSERT INTO public.game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind)
 SELECT id,game_id,'2027-28',2027,2028,2000000,
 CASE WHEN player_id::TEXT LIKE '%0001' THEN 'team' ELSE 'player' END,'unknown'
 FROM public.game_contract_agreements WHERE player_id::TEXT LIKE '%0001' OR player_id::TEXT LIKE '%0002';
UPDATE public.game_contract_agreements SET end_season_label='2027-28'
 WHERE player_id::TEXT LIKE '%0001' OR player_id::TEXT LIKE '%0002';
UPDATE public.game_contract_identities SET estimated=true WHERE player_id::TEXT LIKE '%0004';
UPDATE public.game_contract_agreements SET end_season_label=NULL WHERE player_id::TEXT LIKE '%0005';
UPDATE public.games SET status='active';
SET session_replication_role=origin;
CREATE OR REPLACE FUNCTION public.test_offseason_history() RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE t TEXT; rows JSONB; snapshot JSONB:='{}';
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
   AND tablename NOT IN ('game_offseasons','game_offseason_contracts') ORDER BY tablename LOOP
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::TEXT),''[]''::JSONB) FROM public.%I r',t) INTO rows;
   snapshot:=snapshot||jsonb_build_object(t,rows);
 END LOOP;
 RETURN snapshot;
END $$;
CREATE TEMP TABLE contract_history AS SELECT public.test_offseason_history() snapshot;
-- Exercise source precedence independently; all fixture changes roll back.
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE public.game_contract_agreements SET end_season_label='2026-27' WHERE player_id::TEXT LIKE '%0001';
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.offseason_contract_evidence('c3000000-0000-4000-8000-000000000001',2026)
 WHERE player_id='c2000000-0000-4000-8000-000000000001'),'Expiry contradicting next-year terms rejected';
END $$;
INSERT INTO public.game_runtime_contracts(game_id,player_id,origin_kind,start_year,end_year,annual_salary,is_team_option)
 VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004',
 'simulated-agreement',2026,2027,1234567,true);
DO $$ BEGIN
 ASSERT (SELECT classification='team_option' AND next_salary=1234567
 FROM public.offseason_contract_evidence('c3000000-0000-4000-8000-000000000001',2026)
 WHERE player_id='c2000000-0000-4000-8000-000000000004'),'Simulation overrides estimated canonical';
END $$;
DELETE FROM public.game_contract_seasons WHERE agreement_id IN
 (SELECT id FROM public.game_contract_agreements WHERE player_id::TEXT LIKE '%0005');
DELETE FROM public.game_contract_agreements WHERE player_id::TEXT LIKE '%0005';
DELETE FROM public.game_contract_identities WHERE player_id::TEXT LIKE '%0005';
DO $$ BEGIN
 ASSERT (SELECT classification='player_option'
 FROM public.offseason_contract_evidence('c3000000-0000-4000-8000-000000000001',2026)
 WHERE player_id='c2000000-0000-4000-8000-000000000005'),'Legacy terms used only without canonical';
END $$;
UPDATE public.contracts SET is_team_option=true WHERE player_id::TEXT LIKE '%0005';
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.offseason_contract_evidence('c3000000-0000-4000-8000-000000000001',2026)
 WHERE player_id='c2000000-0000-4000-8000-000000000005'),'Conflicting legacy options rejected';
END $$;
ROLLBACK;
-- Acquired players keep their imported team provenance; only current roster ownership authorizes action.
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE public.game_contract_seasons SET option_kind='team' WHERE start_year=2027 AND agreement_id IN
 (SELECT id FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000002');
SET LOCAL session_replication_role=origin;
UPDATE public.games SET selected_team_id='c1000000-0000-4000-8000-000000000002';
UPDATE public.game_player_states SET team_id='c1000000-0000-4000-8000-000000000002'
 WHERE player_id::TEXT LIKE '%0001' OR player_id::TEXT LIKE '%0003' OR player_id::TEXT LIKE '%0004';
INSERT INTO public.game_runtime_contracts(game_id,player_id,origin_kind,start_year,end_year,annual_salary,is_player_option,released_at)
 VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004',
 'simulated-agreement',2026,2027,999999,true,now());
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.offseason_contract_evidence('c3000000-0000-4000-8000-000000000001',2026)
 WHERE player_id='c2000000-0000-4000-8000-000000000004'),'Released runtime cannot override estimated canonical';
END $$;
INSERT INTO public.game_runtime_contracts(game_id,player_id,origin_kind,start_year,end_year,annual_salary,is_team_option)
 VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004',
 'simulated-agreement',2026,2027,3456789,true);
INSERT INTO public.game_offseasons(game_id,season_year) SELECT game_id,season_year FROM public.postseason_results;
SET ROLE authenticated;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET request.jwt.claim.role='authenticated';
SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026);
DO $$ DECLARE first_decision public.game_offseason_contracts; BEGIN
 ASSERT (SELECT classification='team_option' AND team_id='c1000000-0000-4000-8000-000000000002'
   AND evidence->'identity'->>'team_id'='c1000000-0000-4000-8000-000000000001'
   AND evidence->'agreement'->>'team_id'='c1000000-0000-4000-8000-000000000001'
   FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000001'),
   'Traded canonical team option follows current owner, not imported team';
 ASSERT (SELECT classification='expiring' AND team_id='c1000000-0000-4000-8000-000000000002'
   AND evidence->'agreement'->>'team_id'='c1000000-0000-4000-8000-000000000001'
   FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000003'),
   'Traded canonical expiry follows current owner';
 ASSERT (SELECT count(*)=1 AND bool_and(classification='team_option' AND next_salary=3456789
   AND evidence->'runtime'->>'released_at' IS NULL)
   FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000004'),
   'Re-sign snapshots only the active agreement, not released history';
 ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_contracts
   WHERE team_id<>'c1000000-0000-4000-8000-000000000002'),'Only selected-team ledger rows';
 PERFORM public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000002','exercise')$q$,
   'Known controlled-team option required');
 first_decision:=public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000004','decline');
 ASSERT first_decision=public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000004','decline'),
   'Re-signed active agreement decision retries are identical';
 first_decision:=public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise');
 ASSERT first_decision=public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise'),
   'Acquired canonical option can be exercised with stable retries';
END $$;
ROLLBACK;
DO $$ DECLARE r TEXT; op TEXT; BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_contracts),'Install creates no ledger';
 ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.game_offseason_contracts'::REGCLASS);
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
   ASSERT NOT has_table_privilege(r,'public.game_offseason_contracts',op);
  END LOOP;
  ASSERT has_function_privilege(r,'public.prepare_offseason_contracts(uuid,integer)','EXECUTE')=(r='authenticated');
  ASSERT has_function_privilege(r,'public.decide_offseason_team_option(uuid,integer,uuid,text)','EXECUTE')=(r='authenticated');
  ASSERT NOT has_function_privilege(r,'public.offseason_contract_evidence(uuid,integer)','EXECUTE');
 END LOOP;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET request.jwt.claim.role='authenticated';
SELECT public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026)$q$,'Offseason entry required');
SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026);
SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026);
DO $$ BEGIN
 ASSERT (SELECT count(*)=3 FROM public.game_offseason_contracts),'Only three known controlled contracts';
 ASSERT (SELECT count(*)=1 FROM public.game_offseason_contracts WHERE classification='expiring');
 ASSERT (SELECT count(*)=1 FROM public.game_offseason_contracts WHERE classification='player_option' AND decision IS NULL);
 PERFORM public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026);
 PERFORM public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2025)$q$,'Season year does not match the current season');
 PERFORM public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',NULL)$q$,'Season year does not match the current season');
 PERFORM public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000002','exercise')$q$,'Known controlled-team option required');
 PERFORM public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000006','exercise')$q$,'Known controlled-team option required');
 PERFORM public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000004','exercise')$q$,'Known controlled-team option required');
 PERFORM public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001',NULL)$q$,'Invalid team option decision');
END $$;
BEGIN;
SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','decline');
SELECT public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise')$q$,'Team option decision is immutable');
SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','decline');
ROLLBACK;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_contracts),'RLS isolates owners';
 PERFORM public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
END $$;
RESET ROLE;
CREATE FUNCTION public.test_fail_option() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 ASSERT NEW.decision IS NOT NULL,'Decision was written'; RAISE EXCEPTION 'Injected option failure';
END $$;
CREATE TRIGGER test_fail_option AFTER UPDATE ON public.game_offseason_contracts
 FOR EACH ROW EXECUTE FUNCTION public.test_fail_option();
SET ROLE authenticated;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SELECT public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise')$q$,'Injected option failure');
RESET ROLE;
DROP TRIGGER test_fail_option ON public.game_offseason_contracts;
DROP FUNCTION public.test_fail_option();
BEGIN;
UPDATE public.games SET status='archived';
SET ROLE authenticated;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SELECT public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
RESET ROLE;
UPDATE public.games SET status='deleted',deleted_at=now();
SET ROLE authenticated;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_contracts),'Deleted game hidden'; END $$;
SELECT public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026)$q$,'Game not found or access denied');
SET request.jwt.claim.sub='';
SELECT public.test_offseason_error($q$SELECT public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026)$q$,'Authentication required');
ROLLBACK;
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE public.game_contract_seasons SET salary_amount=3000000 WHERE start_year=2027;
SET LOCAL session_replication_role=origin;
SET ROLE authenticated;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SELECT public.test_offseason_error($q$SELECT public.decide_offseason_team_option('c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise')$q$,'Offseason contract evidence changed');
ROLLBACK;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_contracts WHERE decision IS NOT NULL),'Decision rollback';
 ASSERT public.test_offseason_history()=(SELECT snapshot FROM contract_history),'Every original table unchanged';
END $$;
