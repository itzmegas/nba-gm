CREATE FUNCTION pg_temp.assert_fails(p_sql TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'Expected statement to fail: %', p_sql;
EXCEPTION WHEN raise_exception OR insufficient_privilege OR check_violation OR foreign_key_violation THEN
  IF SQLERRM LIKE 'Expected statement to fail:%' THEN RAISE; END IF;
END;
$$;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
BEGIN
  IF enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001',
      ARRAY['30000000-0000-4000-8000-000000000001'::UUID,
            '30000000-0000-4000-8000-000000000002'::UUID]) <> 2 THEN
    RAISE EXCEPTION 'Expected two explicit enrollments';
  END IF;
  BEGIN
    PERFORM enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001',
      ARRAY['30000000-0000-4000-8000-000000000001'::UUID,
            '30000000-0000-4000-8000-000000000004'::UUID]);
    RAISE EXCEPTION 'Expected agreement enrollment to fail';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected agreement enrollment to fail' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001',
      ARRAY['30000000-0000-4000-8000-000000000003'::UUID]);
    RAISE EXCEPTION 'Expected inactive player enrollment to fail';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Expected inactive player enrollment to fail' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;
SELECT pg_temp.assert_fails($sql$SELECT enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001', ARRAY['30000000-0000-4000-8000-000000000005'::UUID])$sql$);
SELECT pg_temp.assert_fails($sql$INSERT INTO free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id, season, annual_salary, years, due_date)
VALUES ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-27', 2625627, 1, '2026-10-03')$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '2026-27', 2625627, 1)$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', '2026-27', 2625627, 1)$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', '2027-28', 2625627, 1)$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005', '2026-27', 100, 1)$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000008', '2026-27', 2625627, 1)$sql$);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000010', '2026-27', 50000000, 1)$sql$);

DO $$
DECLARE v_offer free_agency_pending_offers%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM submit_free_agency_offer(
    '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000011', '2026-27', 10000000, 1);
  IF v_offer.annual_salary <> 10000000 THEN
    RAISE EXCEPTION 'Other teams payroll incorrectly reduced the selected team cap room';
  END IF;
  SELECT * INTO v_offer FROM submit_free_agency_offer(
    '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000006', '2026-27', 2625627, 1);
  IF v_offer.team_id <> '20000000-0000-4000-8000-000000000001'
     OR v_offer.due_date <> '2026-10-03' OR v_offer.status <> 'pending'
     OR v_offer.owner_id <> '10000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'Offer did not derive owner, selected team, pending status, and next-day due date';
  END IF;
  PERFORM submit_free_agency_offer(
    '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000006', '2026-27', 2625627, 1);
END;
$$;
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000006', '2026-27', 2625627, 1)$sql$);
DO $$
BEGIN
  IF (SELECT count(*) FROM list_pending_free_agency_offers('40000000-0000-4000-8000-000000000001')) <> 2 THEN
    RAISE EXCEPTION 'Pending offer list did not return two persisted offers';
  END IF;
  IF (SELECT count(*) FROM list_pending_free_agency_offers('40000000-0000-4000-8000-000000000002')) <> 0 THEN
    RAISE EXCEPTION 'Foreign save leaked pending offers';
  END IF;
END;
$$;
RESET ROLE;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT pg_temp.assert_fails($sql$SELECT * FROM submit_free_agency_offer('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000007', '2026-27', 2625627, 1)$sql$);
SELECT pg_temp.assert_fails($sql$INSERT INTO free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id, season, annual_salary, years, due_date)
VALUES ('50000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-27', 2625627, 1, '2026-10-03')$sql$);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM free_agency_pending_offers) <> 2 THEN RAISE EXCEPTION 'Failed submission leaked a row'; END IF;
  IF (SELECT count(*) FROM free_agency_availability_enrollments) <> 2 THEN RAISE EXCEPTION 'Failed enrollment batch did not roll back'; END IF;
  IF (SELECT count(*) FROM game_contract_agreements) <> 2 OR (SELECT count(*) FROM contracts) <> 2 THEN
    RAISE EXCEPTION 'Imported agreement snapshots changed during FA-02a';
  END IF;
END;
$$;
