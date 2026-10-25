-- Includes every original table and the complete 054 ledger, not just career history.
CREATE FUNCTION public.test_player_options(expected_count INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE before JSONB; first_result JSONB; retry JSONB;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM public.prepare_offseason_contracts('c3000000-0000-4000-8000-000000000001',2026);
  RESET ROLE;
  before:=public.test_offseason_history();
  SET LOCAL ROLE authenticated;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY player_id),'[]') INTO first_result
    FROM public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',2026) r;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY player_id),'[]') INTO retry
    FROM public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',2026) r;
  ASSERT jsonb_array_length(first_result)=expected_count,format('Expected %s known player options, got %s',expected_count,first_result);
  ASSERT first_result=retry,'Retry preserves full outcome, evidence and timestamp';
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_offseason_player_options o
    JOIN public.game_offseason_contracts l USING(game_id,season_year,player_id)
    WHERE o.evidence<>l.evidence OR l.classification<>'player_option'
      OR o.policy_version<>'salary-comparison-v1'),'Resolution records the 054 evidence and fixed policy';
  RESET ROLE;
  ASSERT public.test_offseason_history()=before,'Resolution leaves all originals and team decisions byte-equivalent';
  RETURN first_result;
END $$;
CREATE FUNCTION public.test_player_options_error(expected TEXT) RETURNS VOID LANGUAGE sql AS $$
  SELECT public.test_offseason_error($q$SELECT public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',2026)$q$,expected);
$$;
DO $$ DECLARE r TEXT; op TEXT; BEGIN
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options),'Installation resolves nothing';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.game_offseason_player_options'::REGCLASS);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      ASSERT NOT has_table_privilege(r,'public.game_offseason_player_options',op),'No direct writes even with BYPASSRLS';
    END LOOP;
    ASSERT has_table_privilege(r,'public.game_offseason_player_options','SELECT')=(r='authenticated');
    ASSERT has_function_privilege(r,'public.resolve_offseason_player_options(uuid,integer)','EXECUTE')=(r='authenticated');
  END LOOP;
  ASSERT (SELECT decision='exercise' FROM public.game_offseason_contracts WHERE classification='team_option'), 'Existing team decision is exercised';
END $$;
SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET request.jwt.claim.role='authenticated';
-- Matrix changes are fixture-only and roll back; duplicates include a NULL conflicting row.
BEGIN;
DO $$ DECLARE c RECORD; result JSONB; BEGIN
  FOR c IN SELECT * FROM (VALUES
    (1000000::BIGINT,2000000::BIGINT,'exercise'),(1000000,1000000,'exercise'),
    (2000000,1000000,'decline'),(0,0,'exercise'),(0,1000000,'exercise'),
    (1000000,0,'decline'),(NULL,1000000,NULL),(1000000,NULL,NULL)
  ) v(current_salary,next_salary,decision) LOOP
    DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000002';
    SET LOCAL session_replication_role=replica;
    UPDATE public.game_contract_seasons SET salary_amount=CASE WHEN start_year=2026 THEN c.current_salary ELSE c.next_salary END
      WHERE agreement_id IN (SELECT id FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000002');
    SET LOCAL session_replication_role=origin;
    result:=public.test_player_options(CASE WHEN c.decision IS NULL THEN 0 ELSE 1 END);
    IF c.decision IS NOT NULL THEN
      ASSERT result->0->>'decision'=c.decision AND (result->0->>'current_salary')::BIGINT=c.current_salary
        AND (result->0->>'next_salary')::BIGINT=c.next_salary,'Server compares known salaries including zero';
      ASSERT result->0->>'reason'=CASE WHEN c.decision='exercise' THEN 'salary_not_lower' ELSE 'salary_lower' END;
    END IF;
  END LOOP;
END $$;
ROLLBACK;

-- Missing current year, duplicate current year, estimated and conflicting next-year terms stay pending.
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=replica;
DELETE FROM public.game_contract_seasons WHERE start_year=2026 AND agreement_id IN
  (SELECT id FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000002');
SET LOCAL session_replication_role=origin;
SELECT public.test_player_options(0);
ROLLBACK;
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=replica;
INSERT INTO public.game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind)
  SELECT id,game_id,'2025-26',2026,2027,NULL,'none','unknown' FROM public.game_contract_agreements
  WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=origin;
SELECT public.test_player_options(0);
ROLLBACK;
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=replica;
UPDATE public.game_contract_agreements SET estimated=true WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=origin;
SELECT public.test_player_options(0);
ROLLBACK;
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=replica;
INSERT INTO public.game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind)
  SELECT id,game_id,'2028-29',2027,2028,3000000,'team','unknown' FROM public.game_contract_agreements
  WHERE player_id='c2000000-0000-4000-8000-000000000002';
SET LOCAL session_replication_role=origin;
SELECT public.test_player_options(0);
ROLLBACK;

-- Runtime overrides even estimated canonical; released runtime is never a source.
-- Acquired canonical player keeps imported team provenance; legacy uses this year's index, not y1.
BEGIN;
SET LOCAL session_replication_role=replica;
DELETE FROM public.game_contract_seasons WHERE agreement_id IN
  (SELECT id FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000005');
DELETE FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000005';
DELETE FROM public.game_contract_identities WHERE player_id='c2000000-0000-4000-8000-000000000005';
UPDATE public.contracts SET start_year=2024,end_year=2027,salary_y1=999,salary_y2=888,salary_y3=7,salary_y4=0
  WHERE player_id='c2000000-0000-4000-8000-000000000005';
UPDATE public.game_player_states SET team_id='c1000000-0000-4000-8000-000000000001'
  WHERE player_id='c2000000-0000-4000-8000-000000000006';
UPDATE public.game_contract_agreements SET end_season_label='2027-28'
  WHERE player_id IN ('c2000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000007');
INSERT INTO public.game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind)
  SELECT id,game_id,'2027-28',2027,2028,2000000,'player','unknown' FROM public.game_contract_agreements
  WHERE player_id IN ('c2000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000007');
SET LOCAL session_replication_role=origin;
INSERT INTO public.game_runtime_contracts(game_id,player_id,origin_kind,start_year,end_year,annual_salary,is_player_option,released_at)
  SELECT 'c3000000-0000-4000-8000-000000000001',('c2000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,
    'simulated-agreement',2026,2027,999999,true,now() FROM generate_series(3,4) n;
SELECT public.test_player_options(3);
DO $$ BEGIN
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000004'),
    'Released runtime never overrides estimated canonical';
END $$;
INSERT INTO public.game_runtime_contracts(game_id,player_id,origin_kind,start_year,end_year,annual_salary,is_player_option)
  VALUES ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000004','simulated-agreement',2026,2027,1234567,true);
SELECT public.test_player_options(4);
DO $$ BEGIN
  ASSERT (SELECT current_salary=1234567 AND next_salary=1234567 AND decision='exercise'
    AND evidence->'runtime'->>'released_at' IS NULL AND (evidence->'identity'->>'estimated')::BOOLEAN
    FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000004');
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000003');
  ASSERT (SELECT current_salary=7 AND next_salary=0 AND decision='decline'
    FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000005');
  ASSERT (SELECT team_id='c1000000-0000-4000-8000-000000000001'
    AND evidence->'agreement'->>'team_id'='c1000000-0000-4000-8000-000000000002'
    FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000006');
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options WHERE player_id::TEXT>'c2000000-0000-4000-8000-000000000006');
END $$;
ROLLBACK;

-- Legacy missing/negative salaries and conflicting options cannot resolve; no canonical fallback.
BEGIN;
SET LOCAL session_replication_role=replica;
DELETE FROM public.game_contract_seasons WHERE agreement_id IN
  (SELECT id FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000005');
DELETE FROM public.game_contract_agreements WHERE player_id='c2000000-0000-4000-8000-000000000005';
DELETE FROM public.game_contract_identities WHERE player_id='c2000000-0000-4000-8000-000000000005';
SET LOCAL session_replication_role=origin;
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT * FROM (VALUES (NULL::BIGINT,1::BIGINT,false),(1,NULL,false),(-1,1,false),(1,-1,false),(1,2,true))
    v(current_salary,next_salary,team_option) LOOP
    DELETE FROM public.game_offseason_contracts WHERE player_id='c2000000-0000-4000-8000-000000000005';
    UPDATE public.contracts SET salary_y1=c.current_salary,salary_y2=c.next_salary,is_team_option=c.team_option
      WHERE player_id='c2000000-0000-4000-8000-000000000005';
    PERFORM public.test_player_options(1);
    ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options WHERE player_id='c2000000-0000-4000-8000-000000000005');
  END LOOP;
END $$;
ROLLBACK;

-- An explicit resolver can fill not-yet-prepared 054 rows without touching an existing team decision.
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE classification<>'team_option';
SET LOCAL ROLE authenticated;
SELECT public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',2026);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*)=3 FROM public.game_offseason_contracts),'Resolver explicitly prepares missing known rows';
  ASSERT (SELECT decision='exercise' FROM public.game_offseason_contracts WHERE classification='team_option');
END $$;
ROLLBACK;

-- Failure after insertion must undo the entire batch, including implicit 054 preparation.
CREATE FUNCTION public.test_fail_player_options() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  ASSERT EXISTS(SELECT 1 FROM public.game_offseason_player_options WHERE player_id=NEW.player_id);
  RAISE EXCEPTION 'Injected player-option failure';
END $$;
CREATE TRIGGER test_fail_player_options AFTER INSERT ON public.game_offseason_player_options
  FOR EACH ROW EXECUTE FUNCTION public.test_fail_player_options();
BEGIN;
DELETE FROM public.game_offseason_contracts WHERE classification<>'team_option';
CREATE TEMP TABLE failure_history AS SELECT public.test_offseason_history() snapshot;
SET LOCAL ROLE authenticated;
SELECT public.test_player_options_error('Injected player-option failure');
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options),'Failure rolls back outcomes';
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM failure_history),'Failure also rolls back implicit preparation';
END $$;
ROLLBACK;
DROP TRIGGER test_fail_player_options ON public.game_offseason_player_options;
DROP FUNCTION public.test_fail_player_options();

SET ROLE authenticated;
SELECT public.test_offseason_error($q$SELECT public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',2025)$q$,'Season year does not match the current season');
SELECT public.test_offseason_error($q$SELECT public.resolve_offseason_player_options('c3000000-0000-4000-8000-000000000001',NULL)$q$,'Season year does not match the current season');
SELECT public.test_offseason_error('SELECT public.resolve_offseason_player_options(NULL,2026)','Game not found or access denied');
RESET ROLE;
BEGIN;
DELETE FROM public.game_offseasons;
SET LOCAL ROLE authenticated;
SELECT public.test_player_options_error('Offseason entry required');
ROLLBACK;
BEGIN;
UPDATE public.games SET status='archived';
SET LOCAL ROLE authenticated;
SELECT public.test_player_options_error('Game not found or access denied');
RESET ROLE;
UPDATE public.games SET status='deleted',deleted_at=now();
SET LOCAL ROLE authenticated;
SELECT public.test_player_options_error('Game not found or access denied');
ROLLBACK;

-- Resolve inside a transaction to test actual owner visibility and stale retries, then roll back.
BEGIN;
SELECT public.test_player_options(1);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='c0000000-0000-4000-8000-000000000002';
DO $$ BEGIN ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options),'Other owner sees no outcomes'; END $$;
SELECT public.test_player_options_error('Game not found or access denied');
SET LOCAL request.jwt.claim.sub='';
SELECT public.test_player_options_error('Authentication required');
SET LOCAL request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claim.role='service_role';
SELECT public.test_player_options_error('Authentication required');
SET LOCAL request.jwt.claim.role='authenticated';
SELECT public.test_offseason_error('INSERT INTO public.game_offseason_player_options SELECT * FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('UPDATE public.game_offseason_player_options SET decision=''decline''','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('DELETE FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('TRUNCATE public.game_offseason_player_options','permission denied for table game_offseason_player_options');
RESET ROLE;
UPDATE public.games SET status='deleted',deleted_at=now();
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options),'Deleted game hidden'; END $$;
RESET ROLE;
UPDATE public.games SET status='active',deleted_at=NULL;
SET LOCAL session_replication_role=replica;
UPDATE public.game_contract_seasons SET salary_amount=3000000 WHERE start_year=2026;
SET LOCAL session_replication_role=origin;
SET LOCAL ROLE authenticated;
SELECT public.test_player_options_error('Offseason contract evidence changed');
ROLLBACK;
SET ROLE anon;
SELECT public.test_offseason_error('SELECT * FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_player_options_error('permission denied for function resolve_offseason_player_options');
RESET ROLE;
SET ROLE service_role;
SELECT public.test_offseason_error('SELECT * FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('INSERT INTO public.game_offseason_player_options SELECT * FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('UPDATE public.game_offseason_player_options SET decision=''decline''','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('DELETE FROM public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_offseason_error('TRUNCATE public.game_offseason_player_options','permission denied for table game_offseason_player_options');
SELECT public.test_player_options_error('permission denied for function resolve_offseason_player_options');
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT EXISTS(SELECT 1 FROM public.game_offseason_player_options),'All scenario outcomes rolled back before concurrency test';
  ASSERT public.test_offseason_history()=(SELECT snapshot FROM before_055),'Tests preserve all initial originals and 054 decisions';
END $$;
