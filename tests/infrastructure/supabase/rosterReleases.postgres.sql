BEGIN;
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('49500000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'Roster releases', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-15', 'initializing');
INSERT INTO players(id, first_name, last_name, full_name, years_of_experience)
SELECT ('39500000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID, 'Release', n::TEXT, 'Release ' || n, 4
FROM generate_series(1, 19) n;
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
SELECT '49500000-0000-4000-8000-000000000001', id,
  CASE WHEN last_name = '17' THEN NULL WHEN last_name::INTEGER >= 18 THEN '20000000-0000-4000-8000-000000000002'::UUID
    ELSE '20000000-0000-4000-8000-000000000001'::UUID END, true FROM players WHERE first_name = 'Release';
INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
VALUES ('49500000-0000-4000-8000-000000000001', 'fixture', '2026-27', ARRAY(SELECT gen_random_uuid() FROM generate_series(1,30)));
INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
  provenance_quality, source_method, estimated, cap_treatment)
SELECT '49500000-0000-4000-8000-000000000001', id, '20000000-0000-4000-8000-000000000001',
  CASE WHEN last_name = '15' THEN 'observed-standard' ELSE 'official-two-way' END,
  CASE WHEN last_name = '15' THEN 'standard' ELSE 'two-way' END, 'official', 'fixture', false,
  CASE WHEN last_name = '15' THEN 'standard-cap-and-matching' ELSE 'excluded-two-way' END
FROM players WHERE first_name = 'Release' AND last_name IN ('15', '16');
INSERT INTO game_contract_agreements(id, game_id, player_id, team_id, contract_type, provenance_quality, source_method, estimated, cap_treatment)
VALUES ('59500000-0000-4000-8000-000000000015', '49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000001',
  'standard', 'observed', 'fixture', false, 'standard-cap-and-matching');
INSERT INTO game_contract_seasons(game_id, agreement_id, season_label, start_year, end_year, salary_amount, option_kind, guarantee_kind)
VALUES ('49500000-0000-4000-8000-000000000001', '59500000-0000-4000-8000-000000000015', '2026-27', 2026, 2027, 8000000, 'none', 'guaranteed'),
  ('49500000-0000-4000-8000-000000000001', '59500000-0000-4000-8000-000000000015', '2027-28', 2027, 2028, 9000000, 'none', 'not-guaranteed');
INSERT INTO game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year, annual_salary, is_guaranteed)
SELECT '49500000-0000-4000-8000-000000000001', id, 'simulated-agreement', 2026, 2026,
  CASE WHEN last_name = '18' THEN 3000000 ELSE 1000000 END, CASE WHEN last_name = '19' THEN false ELSE NULL END
FROM players WHERE first_name = 'Release' AND (last_name::INTEGER <= 14 OR last_name::INTEGER >= 18);
UPDATE games SET status = 'active' WHERE id = '49500000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT enroll_simulated_free_agents('49500000-0000-4000-8000-000000000001', ARRAY['39500000-0000-4000-8000-000000000017'::UUID]);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
-- BEFORE_RELEASE_ACTIONS
SELECT pg_temp.assert_true((SELECT roster_count = 15 AND payroll = 22000000 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Initial roster/payroll mismatch');
SELECT pg_temp.expect_error($q$SELECT submit_free_agency_offer('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000017', gen_random_uuid(), '2026-27', 2625627, 1)$q$, 'Roster maximum reached');

-- Authenticated owners cannot cut another team's player or forge ledger rows.
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000018', gen_random_uuid(), NULL)$q$, 'selected team active roster');
SELECT pg_temp.expect_error($q$DELETE FROM game_roster_releases$q$, 'permission denied');
SELECT pg_temp.expect_error($q$UPDATE game_runtime_contracts SET released_at = now()$q$, 'permission denied');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000015', gen_random_uuid(), '59500000-0000-4000-8000-000000000015')$q$, 'Owned active modern');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000015', gen_random_uuid(), gen_random_uuid())$q$, 'contract changed');
SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000015',
  '69500000-0000-4000-8000-000000000015', '59500000-0000-4000-8000-000000000015');
SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000015',
  '69500000-0000-4000-8000-000000000015', '59500000-0000-4000-8000-000000000015');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM game_roster_releases), 'Replay duplicated a release');
SELECT pg_temp.assert_true((SELECT salary_by_year = '{"2026":8000000,"2027":0}'::JSONB FROM game_roster_releases), 'Guarantee charges incorrect');
SELECT pg_temp.assert_true(get_roster_release_cap_charge('49500000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 2026) = 8000000, 'Release aggregate differs from payroll');
SELECT pg_temp.assert_true(get_roster_release_cap_charge('49500000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 2027) = 0, 'Aggregate retained a future non-guaranteed salary');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT roster_count = 14 AND payroll = 22000000 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Release invented cap space');
SELECT pg_temp.assert_true((get_free_agency_market('49500000-0000-4000-8000-000000000001')->'candidates') @>
  '[{"player_id":"39500000-0000-4000-8000-000000000015"}]', 'Released player missing from market');
SELECT pg_temp.assert_true((SELECT count(*) = 2 AND sum(salary_amount) = 17000000 FROM game_contract_seasons
  WHERE agreement_id = '59500000-0000-4000-8000-000000000015'), 'Imported observations changed');
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000014', '69500000-0000-4000-8000-000000000015', NULL)$q$, 'Idempotency key reused');
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49500000-0000-4000-8000-000000000001',
  '39500000-0000-4000-8000-000000000015', gen_random_uuid(), '59500000-0000-4000-8000-000000000015')$q$, 'selected team active roster');

SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000016', gen_random_uuid(), NULL);
SELECT pg_temp.assert_true((SELECT roster_count = 14 AND payroll = 22000000 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Two-way release freed a standard slot');
SELECT submit_free_agency_offer('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017',
  '69500000-0000-4000-8000-000000000017', '2026-27', 2625627, 1);
UPDATE games SET simulation_date = '2026-10-16' WHERE id = '49500000-0000-4000-8000-000000000001';
SELECT resolve_free_agency_offer('49500000-0000-4000-8000-000000000001', (SELECT id FROM free_agency_pending_offers
  WHERE request_id = '69500000-0000-4000-8000-000000000017'));
SELECT pg_temp.assert_true((SELECT roster_count = 15 AND payroll = 24625627 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Release-to-sign flow failed');

-- A signed player can be cut, re-signed, and cut again without erasing agreement history.
SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017', gen_random_uuid(),
  (SELECT id FROM game_active_runtime_contracts WHERE game_id = '49500000-0000-4000-8000-000000000001' AND player_id = '39500000-0000-4000-8000-000000000017'));
SELECT submit_free_agency_offer('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017',
  '69500000-0000-4000-8000-000000000018', '2026-27', 2625627, 1);
UPDATE games SET simulation_date = '2026-10-17' WHERE id = '49500000-0000-4000-8000-000000000001';
SELECT resolve_free_agency_offer('49500000-0000-4000-8000-000000000001', (SELECT id FROM free_agency_pending_offers
  WHERE request_id = '69500000-0000-4000-8000-000000000018'));
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM game_runtime_contracts WHERE game_id = '49500000-0000-4000-8000-000000000001'
  AND player_id = '39500000-0000-4000-8000-000000000017'), 'Runtime history lost on re-sign');
SELECT pg_temp.assert_true((SELECT roster_count = 15 AND payroll = 27251254 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Re-sign duplicated active salary or lost cap charges');
SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017', gen_random_uuid(),
  (SELECT id FROM game_active_runtime_contracts WHERE game_id = '49500000-0000-4000-8000-000000000001' AND player_id = '39500000-0000-4000-8000-000000000017'));
SELECT pg_temp.assert_true((SELECT roster_count = 14 AND payroll = 27251254 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Second cut lost salary liability');

-- AI can recruit a released observed player while the former team retains the cap charge.
SELECT pg_temp.assert_true(generate_ai_free_agency_offers('49500000-0000-4000-8000-000000000001') = 1, 'AI missed released candidates');
UPDATE games SET simulation_date = '2026-10-18' WHERE id = '49500000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_true(resolve_due_free_agency_market('49500000-0000-4000-8000-000000000001') = 1, 'AI could not sign released player');
SELECT pg_temp.assert_true((SELECT team_id = '20000000-0000-4000-8000-000000000002' FROM game_player_states
  WHERE game_id = '49500000-0000-4000-8000-000000000001' AND player_id = '39500000-0000-4000-8000-000000000015'), 'AI assigned wrong owner');
SELECT pg_temp.assert_true((SELECT payroll = 27251254 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000017')), 'Original salary followed released player to AI team');
UPDATE games SET selected_team_id = '20000000-0000-4000-8000-000000000002' WHERE id = '49500000-0000-4000-8000-000000000001';
CREATE TEMP TABLE before_non_guaranteed_cut AS SELECT payroll FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000019');
SELECT release_roster_player('49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000019', gen_random_uuid(),
  (SELECT id FROM game_active_runtime_contracts WHERE game_id = '49500000-0000-4000-8000-000000000001' AND player_id = '39500000-0000-4000-8000-000000000019'));
SELECT pg_temp.assert_true((SELECT f.payroll = b.payroll - 1000000 FROM get_free_agency_financial_context(
  '49500000-0000-4000-8000-000000000001', '39500000-0000-4000-8000-000000000019') f CROSS JOIN before_non_guaranteed_cut b),
  'Non-guaranteed salary was retained');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM game_roster_releases), 'Foreign owner can read releases');
SELECT pg_temp.assert_true(get_roster_release_cap_charge('49500000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 2026) = 0, 'Aggregate bypasses RLS');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM game_active_runtime_contracts WHERE game_id = '49500000-0000-4000-8000-000000000001'), 'Active view bypasses RLS');
RESET ROLE;
ROLLBACK;
