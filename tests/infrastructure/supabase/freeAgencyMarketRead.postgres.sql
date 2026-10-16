BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
CREATE TEMP TABLE market_read_before AS
SELECT (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_player_states x) roster,
       (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM free_agency_pending_offers x) offers,
       (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_runtime_contracts x) runtime;
CREATE TEMP TABLE market_read_result AS
SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002') AS value;
SELECT pg_temp.assert_true((SELECT (value->>'supported')::boolean AND value->'context'->>'season' = '2026-27'
  AND value->'context'->>'team_id' = '20000000-0000-4000-8000-000000000001'
  FROM market_read_result), 'Supported market context is missing');
SELECT pg_temp.assert_true((SELECT value->'context'->>'payroll' = f.payroll::text
  AND value->'context'->>'salary_cap' = f.salary_cap::text
  AND value->'context'->>'roster_count' = f.roster_count::text
  FROM market_read_result CROSS JOIN LATERAL get_free_agency_financial_context(
    '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005') f),
  'Selected-team finance context differs from private authority');
SELECT pg_temp.assert_true((SELECT jsonb_typeof(value->'candidates') = 'array'
  AND jsonb_typeof(value->'offers') = 'array' FROM market_read_result), 'Market arrays missing');
SELECT pg_temp.assert_true((SELECT array_agg(candidate->>'player_id' ORDER BY candidate->>'player_id') = ARRAY[
    '30000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000017'
  ] FROM market_read_result, jsonb_array_elements(value->'candidates') candidate),
  'Explicitly enrolled eligible candidates are missing or unordered');
SELECT pg_temp.assert_true((SELECT roster = (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_player_states x)
  AND offers = (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM free_agency_pending_offers x)
  AND runtime = (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_runtime_contracts x)
  FROM market_read_before), 'Read RPC mutated market state');
DO $$ BEGIN
  IF has_function_privilege('anon', 'get_free_agency_market(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'get_free_agency_market(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'get_free_agency_market(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Market RPC execute grants are incorrect';
  END IF;
END $$;
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', 'simulation-bootstrap-enrollment'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000018', 'simulation-bootstrap-enrollment');
UPDATE game_player_states SET team_id = NULL, is_active = false
WHERE game_id = '40000000-0000-4000-8000-000000000002' AND player_id = '30000000-0000-4000-8000-000000000006';
CREATE TEMP TABLE excluded_candidate_result AS
SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002') AS value;
SELECT pg_temp.assert_true((SELECT NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(value->'candidates') candidate
  WHERE candidate->>'player_id' IN ('30000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000018')
) FROM excluded_candidate_result), 'Inactive or contracted enrollment leaked into candidate list');
DELETE FROM free_agency_availability_enrollments WHERE game_id = '40000000-0000-4000-8000-000000000002';
CREATE TEMP TABLE empty_pool_result AS
SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002') AS value;
SELECT pg_temp.assert_true((SELECT (value->>'supported')::boolean
  AND value->'context' IS NOT NULL AND value->'candidates' = '[]'::jsonb
  FROM empty_pool_result), 'Empty enrolled pool lost supported selected-team context');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT pg_temp.expect_error($q$SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002')$q$,
  'Owned game not found');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF has_function_privilege(current_user, 'get_free_agency_financial_context(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege(current_user, 'get_free_agency_financial_context(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client can execute private financial context';
  END IF;
END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002')$q$,
  'permission denied');
RESET ROLE;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
UPDATE games SET status = 'initializing' WHERE id = '40000000-0000-4000-8000-000000000003';
SELECT pg_temp.assert_true((SELECT NOT (value->>'supported')::boolean AND value->'context' = 'null'::jsonb
  AND value->'candidates' = '[]'::jsonb FROM (SELECT get_free_agency_market(
    '40000000-0000-4000-8000-000000000003') value) market), 'Historical game invented a ready market');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT submit_free_agency_offer('40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000005', '6fffffff-0000-4000-8000-000000000009',
  '2026-27', 42000000, 1);
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
CREATE TEMP TABLE post_day_market AS
SELECT get_free_agency_market('40000000-0000-4000-8000-000000000002') value;
SELECT pg_temp.assert_true((SELECT EXISTS (
  SELECT 1 FROM post_day_market, jsonb_array_elements(post_day_market.value->'offers') offer
  WHERE offer->>'request_id' = '6fffffff-0000-4000-8000-000000000009'
    AND offer->>'offer_origin' = 'human' AND offer->>'status' = 'accepted'
    AND offer ? 'resolved_date' AND offer ? 'resolution_reason'
    AND offer ? 'resolution_detail' AND offer ? 'resolved_contract_id'
    AND offer->>'player_name' = 'Explicit Free Agent'
) AND EXISTS (
  SELECT 1 FROM post_day_market, jsonb_array_elements(post_day_market.value->'offers') offer
  WHERE offer->>'offer_origin' = 'ai' AND offer->>'status' = 'rejected'
    AND offer->>'resolution_reason' = 'another_offer_accepted'
    AND offer->>'team_name' = 'Beta'
)), 'Post-day human and AI terminal history is incomplete');
ROLLBACK;
