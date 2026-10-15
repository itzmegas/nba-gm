-- BEFORE_MIGRATION_026: authenticated clients have no signing/DML bypass.
-- Stable fixture identifiers are distinct concepts in production; pin only the test rows.
UPDATE free_agency_pending_offers SET id = request_id;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary)
    VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
      'simulated-agreement', 2026, 2026, 42000000);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for table game_runtime_contracts%' THEN
    RAISE EXCEPTION 'Authenticated direct runtime-contract insert was not denied: state %, message %', v_state, v_message;
  END IF;
  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE free_agency_pending_offers SET status = 'accepted'
    WHERE request_id = '60000000-0000-4000-8000-000000000004';
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for table free_agency_pending_offers%' THEN
    RAISE EXCEPTION 'Authenticated direct offer terminalization was not denied: state %, message %', v_state, v_message;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM free_agency_pending_offers
      WHERE request_id = '60000000-0000-4000-8000-000000000004' AND status = 'pending')
     OR EXISTS (SELECT 1 FROM game_runtime_contracts
      WHERE game_id = '40000000-0000-4000-8000-000000000002'
        AND player_id = '30000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'Pending offer changed without the private signing transaction';
  END IF;
END $$;
RESET ROLE;
SELECT 'RED baseline control: authenticated DML cannot sign or terminalize pending offers' AS signing_baseline_control;

-- AFTER_MIGRATION_026
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for function resolve_free_agency_offer%' THEN
    RAISE EXCEPTION 'Authenticated direct signing execution was not denied: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for function resolve_free_agency_offer%' THEN
    RAISE EXCEPTION 'Anonymous direct signing execution was not denied: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message NOT LIKE 'permission denied for function resolve_free_agency_offer%' THEN
    RAISE EXCEPTION 'Service role signing bypass was not denied: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;

-- Owner two cannot invoke signing for owner one's save even in the internal owner context.
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Owned active modern game required' THEN
    RAISE EXCEPTION 'Cross-owner internal signing was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;

-- Not-due pending offers remain unchanged.
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Offer is not due' THEN
    RAISE EXCEPTION 'Not-due signing was not blocked: state %, message %', v_state, v_message;
  END IF;
END $$;

-- The authenticated simulated-day RPC advances the real clock; no offer is accepted instantly.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT simulation_date FROM games WHERE id = '40000000-0000-4000-8000-000000000002') <> '2026-10-03'
     OR EXISTS (SELECT 1 FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
        AND request_id IN ('60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000006') AND status <> 'pending')
     OR EXISTS (SELECT 1 FROM game_runtime_contracts WHERE game_id = '40000000-0000-4000-8000-000000000002'
       AND player_id = '30000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'Day advancement incorrectly signed or terminalized an offer outside the private resolver';
  END IF;
END $$;

-- No enrollment, inactive global player, and existing canonical/runtime agreements fail closed.
DELETE FROM free_agency_availability_enrollments
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000005';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'Explicitly enrolled active teamless%' THEN
    RAISE EXCEPTION 'Missing enrollment was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
  'simulation-bootstrap-enrollment');
UPDATE players SET is_active = false WHERE id = '30000000-0000-4000-8000-000000000005';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Active explicitly enrolled player required' THEN
    RAISE EXCEPTION 'Inactive global player was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;
UPDATE players SET is_active = true WHERE id = '30000000-0000-4000-8000-000000000005';
UPDATE game_player_states SET is_active = false
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000005';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'Explicitly enrolled active teamless%' THEN
    RAISE EXCEPTION 'Inactive game-player state was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;
UPDATE game_player_states SET is_active = true
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000005';

UPDATE game_player_states SET team_id = NULL
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000002';
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
  'simulation-bootstrap-enrollment');
INSERT INTO free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id, season,
  annual_salary, years, due_date)
VALUES ('60000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001', '2026-27', 42000000, 1, '2026-10-03');
UPDATE free_agency_pending_offers SET id = request_id WHERE request_id = '60000000-0000-4000-8000-000000000010';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000010');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'Explicitly enrolled active teamless%' THEN
    RAISE EXCEPTION 'Existing canonical agreement was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;
DELETE FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000010';
DELETE FROM free_agency_availability_enrollments
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000002';
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000001'
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000002';

UPDATE game_player_states SET team_id = NULL
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000020';
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000020',
  'simulation-bootstrap-enrollment');
INSERT INTO free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id, season,
  annual_salary, years, due_date)
VALUES ('60000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000020',
  '20000000-0000-4000-8000-000000000001', '2026-27', 42000000, 1, '2026-10-03');
UPDATE free_agency_pending_offers SET id = request_id WHERE request_id = '60000000-0000-4000-8000-000000000011';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  BEGIN
    PERFORM public.resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000011');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'Explicitly enrolled active teamless%' THEN
    RAISE EXCEPTION 'Existing runtime agreement was not rejected: state %, message %', v_state, v_message;
  END IF;
END $$;
DELETE FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000011';
DELETE FROM free_agency_availability_enrollments
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000020';
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000020';

-- Cross-owner ineligible, changed-cap, and changed-roster failures above leave all competitor offers pending.
SELECT 'GREEN: due, ownership, enrollment, global activity, existing agreements, cap and roster revalidation passed' AS signing_validation_proof;

-- BEFORE_CONCURRENT_SIGNING
CREATE TABLE free_agency_signing_prestate(snapshot JSONB NOT NULL);
INSERT INTO free_agency_signing_prestate(snapshot)
SELECT jsonb_build_object(
  'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
    FROM game_contract_identities x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
  'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
    FROM game_contract_agreements x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
  'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id, x.season_label)
    FROM game_contract_seasons x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
  'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id)
    FROM game_contract_provenance x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
  'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
    FROM contract_source_snapshot_versions x WHERE x.id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
  'legacyContractTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY x.game_id, x.player_id)
    FROM contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
  'existingRuntime', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
    FROM game_runtime_contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb)
);

-- AFTER_CONCURRENT_SIGNING
DO $$
DECLARE v_before JSONB; v_after JSONB; v_accepted public.free_agency_pending_offers%ROWTYPE;
BEGIN
  IF (SELECT count(*) FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000005' AND status = 'accepted') <> 1
     OR (SELECT count(*) FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000005' AND status = 'rejected') <> 4
     OR (SELECT count(*) FROM game_runtime_contracts WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000005') <> 1 THEN
    RAISE EXCEPTION 'Concurrent offers did not resolve exactly once';
  END IF;
  SELECT * INTO v_accepted FROM free_agency_pending_offers
  WHERE game_id = '40000000-0000-4000-8000-000000000002'
    AND player_id = '30000000-0000-4000-8000-000000000005' AND status = 'accepted';
  IF (SELECT source_offer_id FROM game_runtime_contracts WHERE id = v_accepted.resolved_contract_id)
      IS DISTINCT FROM v_accepted.id
     OR (SELECT annual_salary FROM game_runtime_contracts WHERE id = v_accepted.resolved_contract_id)
      IS DISTINCT FROM v_accepted.annual_salary
     OR (SELECT team_id FROM game_player_states WHERE game_id = v_accepted.game_id
      AND player_id = v_accepted.player_id) IS DISTINCT FROM v_accepted.team_id
     OR v_accepted.resolved_date <> '2026-10-03'
     OR v_accepted.resolution_reason <> 'selected_offer_accepted' THEN
    RAISE EXCEPTION 'Accepted offer source/runtime/roster resolution does not match durable offer';
  END IF;
  IF EXISTS (SELECT 1 FROM free_agency_pending_offers o
      WHERE o.game_id = '40000000-0000-4000-8000-000000000002'
        AND o.player_id = '30000000-0000-4000-8000-000000000005' AND o.status = 'rejected'
        AND o.request_id IN ('60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000006')
        AND (o.resolved_date <> '2026-10-03' OR o.resolution_reason <> 'another_offer_accepted'
          OR o.resolved_contract_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Rejected competitor resolution fields are inconsistent';
  END IF;

  SELECT snapshot INTO v_before FROM free_agency_signing_prestate;
  SELECT jsonb_build_object(
    'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_contract_identities x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM game_contract_agreements x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id, x.season_label)
      FROM game_contract_seasons x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id)
      FROM game_contract_provenance x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM contract_source_snapshot_versions x WHERE x.id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'legacyContractTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY x.game_id, x.player_id)
      FROM contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'existingRuntime', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_runtime_contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'
        AND x.player_id <> '30000000-0000-4000-8000-000000000005'), '[]'::jsonb)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'Signing changed full imported snapshots or existing simulated terms';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF (public.resolve_free_agency_offer(v_accepted.game_id, v_accepted.id)).resolved_contract_id
      IS DISTINCT FROM v_accepted.resolved_contract_id THEN
    RAISE EXCEPTION 'Accepted replay did not return stable stored contract identity';
  END IF;
  IF (SELECT (public.resolve_free_agency_offer(o.game_id, o.id)).status
      FROM free_agency_pending_offers o WHERE o.game_id = v_accepted.game_id
        AND o.player_id = v_accepted.player_id AND o.status = 'rejected' ORDER BY o.id LIMIT 1) <> 'rejected' THEN
    RAISE EXCEPTION 'Rejected competitor replay did not return stable terminal status';
  END IF;
END $$;
DO $$
DECLARE v_before JSONB; v_after JSONB;
BEGIN
  SELECT snapshot INTO v_before FROM free_agency_signing_prestate;
  SELECT jsonb_build_object(
    'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_contract_identities x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM game_contract_agreements x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id, x.season_label)
      FROM game_contract_seasons x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.agreement_id)
      FROM game_contract_provenance x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id)
      FROM contract_source_snapshot_versions x WHERE x.id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'legacyContractTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY x.game_id, x.player_id)
      FROM contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'existingRuntime', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.game_id, x.player_id)
      FROM game_runtime_contracts x WHERE x.game_id = '40000000-0000-4000-8000-000000000002'
        AND x.player_id <> '30000000-0000-4000-8000-000000000005'), '[]'::jsonb)
  ) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'Runtime-only trade changed canonical snapshots or existing simulated agreement terms';
  END IF;
END $$;
SELECT 'GREEN: atomic sign/replay, full provenance snapshot and runtime-only trade proof passed' AS signing_transaction_proof;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT execute_trade_transactional(
  '40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '[{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000005","from_team_id":"20000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000020","from_team_id":"20000000-0000-4000-8000-000000000002"}]'::jsonb
);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT team_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000005') <> '20000000-0000-4000-8000-000000000002'
     OR (SELECT team_id FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000020') <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'Runtime-only player trade did not exchange roster ownership';
  END IF;
  IF (SELECT source_offer_id FROM game_runtime_contracts WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000005') IS NULL
     OR (SELECT annual_salary FROM game_runtime_contracts WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000020') <> 5000000 THEN
    RAISE EXCEPTION 'Runtime-only trade altered source linkage or simulated terms';
  END IF;
END $$;
