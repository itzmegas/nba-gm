BEGIN;
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('49600000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'Release salary grid', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-15', 'initializing');
INSERT INTO players(id, first_name, last_name, full_name, years_of_experience)
SELECT ('39600000-0000-4000-8000-' || lpad(n::TEXT, 12, '0'))::UUID,
  'Coverage', n::TEXT, 'Coverage ' || n, 4 FROM generate_series(1, 3) n;
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
SELECT '49600000-0000-4000-8000-000000000001', id,
  CASE WHEN last_name = '1' THEN '20000000-0000-4000-8000-000000000001'::UUID
    ELSE '20000000-0000-4000-8000-000000000002'::UUID END, true
FROM players WHERE first_name = 'Coverage';
INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
VALUES ('49600000-0000-4000-8000-000000000001', 'fixture', '2026-27',
  ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 30)));
INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
  provenance_quality, source_method, estimated, cap_treatment)
SELECT game_id, player_id, team_id, 'observed-standard', 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'
FROM game_player_states WHERE game_id = '49600000-0000-4000-8000-000000000001';
INSERT INTO game_contract_agreements(id, game_id, player_id, team_id, contract_type,
  provenance_quality, source_method, estimated, cap_treatment)
SELECT ('59600000-0000-4000-8000-' || lpad(p.last_name, 12, '0'))::UUID,
  s.game_id, s.player_id, s.team_id, 'standard', 'observed', 'fixture', false, 'standard-cap-and-matching'
FROM game_player_states s JOIN players p ON p.id = s.player_id
WHERE s.game_id = '49600000-0000-4000-8000-000000000001';
-- Real imports copy every salary-table season, including empty future cells.
INSERT INTO game_contract_seasons(game_id, agreement_id, season_label, start_year, end_year, salary_amount, option_kind, guarantee_kind)
VALUES
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000001', '2026-27', 2026, 2027, 8000000, 'none', 'guaranteed'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000001', '2027-28', 2027, 2028, 9000000, 'none', 'unknown'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000001', '2028-29', 2028, 2029, NULL, 'none', 'unknown'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000001', '2029-30', 2029, 2030, NULL, 'none', 'unknown'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000002', '2026-27', 2026, 2027, NULL, 'none', 'unknown'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000002', '2027-28', 2027, 2028, 9000000, 'none', 'unknown'),
  ('49600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000003', '2027-28', 2027, 2028, 9000000, 'none', 'unknown');
UPDATE games SET status = 'active' WHERE id = '49600000-0000-4000-8000-000000000001';
CREATE TEMP TABLE coverage_snapshots AS SELECT id, to_jsonb(s) AS snapshot FROM game_contract_seasons s
WHERE game_id = '49600000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT release_roster_player('49600000-0000-4000-8000-000000000001', '39600000-0000-4000-8000-000000000001',
  '69600000-0000-4000-8000-000000000001', '59600000-0000-4000-8000-000000000001');
SELECT pg_temp.assert_true((SELECT salary_by_year = '{"2026":8000000,"2027":9000000}'::JSONB FROM game_roster_releases
  WHERE game_id = '49600000-0000-4000-8000-000000000001'), 'Known salary charges lost or empty grid cells became fake salaries');
SELECT pg_temp.assert_true(get_roster_release_cap_charge('49600000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 2026) = 8000000, 'Current guaranteed salary disappeared');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT roster_count = 0 AND payroll = 8000000 FROM get_free_agency_financial_context(
  '49600000-0000-4000-8000-000000000001', '39600000-0000-4000-8000-000000000001')), 'Release failed to free slot while retaining current cap charge');
SELECT pg_temp.assert_true(is_available_free_agent('49600000-0000-4000-8000-000000000001',
  '39600000-0000-4000-8000-000000000001'), 'Released observed player is unavailable');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM coverage_snapshots b JOIN game_contract_seasons s USING(id)
  WHERE b.snapshot IS DISTINCT FROM to_jsonb(s)), 'Release changed imported salary observations');
-- Missing CURRENT salary still fails atomically; relaxing future coverage must not invent cap room.
UPDATE games SET selected_team_id = '20000000-0000-4000-8000-000000000002'
WHERE id = '49600000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49600000-0000-4000-8000-000000000001',
  '39600000-0000-4000-8000-000000000002', gen_random_uuid(), '59600000-0000-4000-8000-000000000002')$q$, 'Release salary coverage is incomplete');
SELECT pg_temp.expect_error($q$SELECT release_roster_player('49600000-0000-4000-8000-000000000001',
  '39600000-0000-4000-8000-000000000003', gen_random_uuid(), '59600000-0000-4000-8000-000000000003')$q$, 'Release salary coverage is incomplete');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM game_roster_releases
  WHERE game_id = '49600000-0000-4000-8000-000000000001'), 'Failed release left a partial event');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM game_player_states
  WHERE game_id = '49600000-0000-4000-8000-000000000001' AND team_id = '20000000-0000-4000-8000-000000000002'),
  'Failed release changed roster ownership');
RESET ROLE;
ROLLBACK;
