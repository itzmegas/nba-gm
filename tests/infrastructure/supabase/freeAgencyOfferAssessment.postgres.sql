BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
UPDATE free_agency_pending_offers SET id = request_id;
SELECT pg_temp.assert_true((SELECT rejection_reason = 'Offer is not due' AND score = 0
  FROM assess_free_agency_offer('40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004')), 'Assessment ignored due date');
UPDATE games SET simulation_date = '2026-10-03' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true((SELECT rejection_reason IS NULL AND score BETWEEN 68 AND 69
  FROM assess_free_agency_offer('40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004')), 'Human assessment drifted from domain 60/25/15 scoring');
UPDATE free_agency_pending_offers SET team_id = '20000000-0000-4000-8000-000000000002'
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.expect_error($q$SELECT resolve_free_agency_offer('40000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000004')$q$, 'Offer team does not match');
UPDATE free_agency_pending_offers SET offer_origin = 'ai', ai_decision_date = '2026-10-02', annual_salary = 2625627
WHERE id = '60000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_true((SELECT rejection_reason IS NULL AND score = 31.25
  FROM assess_free_agency_offer('40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004')), 'AI minimum exception or roster opportunity is incorrect');
SELECT resolve_free_agency_offer('40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004');
SELECT pg_temp.assert_true((SELECT team_id = '20000000-0000-4000-8000-000000000002'
  FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
    AND player_id = '30000000-0000-4000-8000-000000000005'), 'AI winner was assigned to user team');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM game_runtime_contracts
  WHERE source_offer_id = '60000000-0000-4000-8000-000000000004'), 'AI source agreement missing');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM free_agency_pending_offers WHERE status = 'pending'
  AND game_id = '40000000-0000-4000-8000-000000000002'), 'AI signing did not terminalize competitors');
DO $$
DECLARE original free_agency_pending_offers%ROWTYPE; replay free_agency_pending_offers%ROWTYPE;
BEGIN
  FOR original IN SELECT * FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002' LOOP
    replay := resolve_free_agency_offer(original.game_id, original.id);
    IF to_jsonb(original) IS DISTINCT FROM to_jsonb(replay) THEN RAISE EXCEPTION 'Terminal replay changed'; END IF;
  END LOOP;
END $$;
SET ROLE authenticated;
SELECT pg_temp.assert_true(NOT has_function_privilege(current_user,
  'assess_free_agency_offer(uuid,uuid)', 'EXECUTE'), 'Client controls assessment');
SELECT pg_temp.assert_true(NOT has_function_privilege(current_user,
  'resolve_free_agency_offer(uuid,uuid)', 'EXECUTE'), 'Client controls resolution');
RESET ROLE;
ROLLBACK;
