BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT pg_temp.assert_true((SELECT payroll = 56000000 AND roster_count = 14 FROM get_free_agency_financial_context(
  '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005')), 'Selected-team finances changed');
SELECT pg_temp.assert_true((SELECT payroll = 235000000 AND roster_count = 3 AND cap_room = 0
  FROM get_free_agency_financial_context('40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002')), 'NPC finances mixed teams or missed overlays');
SELECT pg_temp.assert_true((SELECT selected_team_id = '20000000-0000-4000-8000-000000000001' FROM games
  WHERE id = '40000000-0000-4000-8000-000000000002'), 'Private context mutated selected team');
SELECT pg_temp.expect_error($q$SELECT get_free_agency_financial_context(
  '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000099')$q$, 'Team does not participate');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT pg_temp.expect_error($q$SELECT get_free_agency_financial_context(
  '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000002')$q$, 'Owned active modern game required');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF has_function_privilege(current_user, 'get_free_agency_financial_context(uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client can choose another team finance context';
  END IF;
END $$;
SELECT pg_temp.assert_true((SELECT count(*) = 3 FROM list_pending_free_agency_offers(
  '40000000-0000-4000-8000-000000000002')), 'Public pending API changed');
RESET ROLE;
ROLLBACK;
