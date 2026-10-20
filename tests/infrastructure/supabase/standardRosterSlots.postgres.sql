BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('49000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'Standard roster slots', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-15', 'initializing');
INSERT INTO players(id, first_name, last_name, full_name, years_of_experience)
SELECT ('39000000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID,
  'Slot', n::TEXT, 'Slot ' || n, 4 FROM generate_series(1, 19) n;
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
SELECT '49000000-0000-4000-8000-000000000001', id,
  CASE WHEN last_name = '19' THEN NULL ELSE '20000000-0000-4000-8000-000000000001'::UUID END, true
FROM players WHERE first_name = 'Slot';
INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
VALUES ('49000000-0000-4000-8000-000000000001', 'fixture', '2026-27',
  ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 30)));
INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
  provenance_quality, source_method, estimated, cap_treatment, exclusion_evidence)
SELECT '49000000-0000-4000-8000-000000000001', id, '20000000-0000-4000-8000-000000000001',
  CASE WHEN last_name::INTEGER <= 15 THEN 'observed-standard'
    WHEN last_name = '18' THEN 'inactive-excluded' ELSE 'official-two-way' END,
  CASE WHEN last_name::INTEGER <= 15 THEN 'standard' WHEN last_name = '18' THEN NULL ELSE 'two-way' END,
  'official', 'fixture', false,
  CASE WHEN last_name::INTEGER <= 15 THEN 'standard-cap-and-matching'
    WHEN last_name = '18' THEN 'excluded-inactive' ELSE 'excluded-two-way' END,
  CASE WHEN last_name = '18' THEN '{"source":"fixture"}'::JSONB ELSE NULL END
FROM players WHERE first_name = 'Slot' AND last_name::INTEGER <= 18;
INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary)
SELECT '49000000-0000-4000-8000-000000000001', id, 'simulated-agreement', 2026, 2026, 1000000
FROM players WHERE first_name = 'Slot' AND last_name::INTEGER <= 15;
UPDATE games SET status = 'active' WHERE id = '49000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT enroll_simulated_free_agents('49000000-0000-4000-8000-000000000001',
  ARRAY['39000000-0000-4000-8000-000000000019'::UUID]);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

SELECT pg_temp.assert_true((SELECT roster_count = 15 AND payroll = 15000000
  FROM get_free_agency_financial_context('49000000-0000-4000-8000-000000000001',
    '39000000-0000-4000-8000-000000000019')), 'STANDARD_SLOTS_RED: two-way/inactive identities consumed standard slots');
SELECT pg_temp.assert_true((get_free_agency_market('49000000-0000-4000-8000-000000000001')
  #>> '{context,roster_count}')::INTEGER = 15, 'Market count differs from submission count');
SELECT pg_temp.expect_error($q$SELECT submit_free_agency_offer('49000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000019', '69000000-0000-4000-8000-000000000001',
  '2026-27', 2625627, 1)$q$, 'Roster maximum reached');

-- Fourteen standard players plus two two-way players must still allow a standard offer.
UPDATE game_player_states SET is_active = false WHERE game_id = '49000000-0000-4000-8000-000000000001'
  AND player_id = '39000000-0000-4000-8000-000000000015';
SELECT submit_free_agency_offer('49000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000019', '69000000-0000-4000-8000-000000000001', '2026-27', 2625627, 1);
UPDATE games SET simulation_date = '2026-10-16' WHERE id = '49000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_true((SELECT rejection_reason IS NULL FROM assess_free_agency_offer(
  '49000000-0000-4000-8000-000000000001', (SELECT id FROM free_agency_pending_offers
    WHERE request_id = '69000000-0000-4000-8000-000000000001'))), 'Shared assessment rejected a valid standard slot');

-- AI uses the same count after roster ownership changes; the selected team stays untouched.
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
WHERE game_id = '49000000-0000-4000-8000-000000000001' AND team_id IS NOT NULL;
UPDATE free_agency_pending_offers SET team_id = '20000000-0000-4000-8000-000000000002',
  offer_origin = 'ai', ai_decision_date = '2026-10-15'
WHERE request_id = '69000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_true((SELECT rejection_reason IS NULL FROM assess_free_agency_offer(
  '49000000-0000-4000-8000-000000000001', (SELECT id FROM free_agency_pending_offers
    WHERE request_id = '69000000-0000-4000-8000-000000000001'))), 'AI assessment counted two-way slots');

-- A simulated standard agreement overrides an imported two-way classification.
INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary)
VALUES ('49000000-0000-4000-8000-000000000001', '39000000-0000-4000-8000-000000000016',
  'simulated-agreement', 2026, 2026, 1000000);
SELECT pg_temp.assert_true((SELECT rejection_reason = 'Roster maximum reached' FROM assess_free_agency_offer(
  '49000000-0000-4000-8000-000000000001', (SELECT id FROM free_agency_pending_offers
    WHERE request_id = '69000000-0000-4000-8000-000000000001'))), 'Runtime standard override failed to consume a slot');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated',
  'get_free_agency_financial_context(uuid,uuid,uuid)', 'EXECUTE'), 'Private helper became client callable');
ROLLBACK;
