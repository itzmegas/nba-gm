BEGIN;
INSERT INTO games(id, user_id, name, selected_team_id, season_year, simulation_date, status)
VALUES ('40000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000001',
  'Initial market', '20000000-0000-4000-8000-000000000001', 2026, '2026-10-02', 'initializing'),
  ('40000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000002',
  'Independent market', '20000000-0000-4000-8000-000000000002', 2026, '2026-10-02', 'initializing');
INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
SELECT id, 'fixture', '2026-27', ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 30))
FROM games WHERE id IN ('40000000-0000-4000-8000-000000000033', '40000000-0000-4000-8000-000000000034');
UPDATE games SET status = 'active' WHERE id IN
  ('40000000-0000-4000-8000-000000000033', '40000000-0000-4000-8000-000000000034');
UPDATE players SET nba_id = 9000332 WHERE id = '30000000-0000-4000-8000-000000000001';
CREATE TEMP TABLE nba_snapshot AS SELECT jsonb_build_object(
  'sourceUrl', 'https://www.nba.com/players/free-agent-tracker/2026',
  'seasonYear', 2026, 'fetchedAt', '2026-10-16T12:00:00Z', 'players', jsonb_agg(base || extra)
) value FROM (VALUES
  ('{"playerId":9000331,"playerDisplayName":"Imported Free Agent"}'::jsonb),
  ('{"playerId":9000332,"playerDisplayName":"Canonical Runtime"}'::jsonb),
  ('{"playerId":9000333,"playerDisplayName":"Canonical Standard"}'::jsonb),
  ('{"playerId":9000334,"type":"rfa"}'::jsonb),
  ('{"playerId":9000335,"newTeamId":"1610612747"}'::jsonb),
  ('{"playerId":9000336,"isTwoWayFreeAgent":true}'::jsonb),
  ('{"playerId":9000337,"isPlayerOption":true}'::jsonb)
) entries(extra) CROSS JOIN (SELECT '{"season":"2026","playerFirstName":"Imported","playerLastName":"Agent",
  "playerDisplayName":"Excluded Player","position":"G","exp":4,"type":"ufa","newTeamId":"0",
  "isPlayerOption":false,"isTeamOption":false,"isEarlyTerminationOption":false,"isTwoWayFreeAgent":false}'::jsonb base) defaults;

SELECT pg_temp.expect_error($q$SELECT import_initial_free_agents('40000000-0000-4000-8000-000000000033',
  '10000000-0000-4000-8000-000000000001', (SELECT value FROM nba_snapshot))$q$, 'Service role required');
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT pg_temp.expect_error($q$SELECT import_initial_free_agents('40000000-0000-4000-8000-000000000033',
  '10000000-0000-4000-8000-000000000002', (SELECT value FROM nba_snapshot))$q$, 'Owned active');
SELECT pg_temp.assert_true(import_initial_free_agents('40000000-0000-4000-8000-000000000033',
  '10000000-0000-4000-8000-000000000001', (SELECT value FROM nba_snapshot)) =
  '{"enrolled_count":1,"skipped_count":2}'::jsonb, 'Import did not filter restricted, signed, option or unresolved identities');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM players WHERE nba_id BETWEEN 9000333 AND 9000337),
  'Excluded players were unexpectedly created');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM free_agency_imports WHERE snapshot = (SELECT value FROM nba_snapshot)),
  'Dated source snapshot was not persisted');

SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT pg_temp.assert_true((SELECT jsonb_array_length(get_free_agency_market(
  '40000000-0000-4000-8000-000000000033')->'candidates') = 1), 'New-save market is empty after import');
SELECT submit_free_agency_offer('40000000-0000-4000-8000-000000000033',
  (SELECT id FROM players WHERE nba_id = 9000331), '60000000-0000-4000-8000-000000000033', '2026-27', 30000000, 1);
UPDATE games SET simulation_date = '2026-10-03' WHERE id = '40000000-0000-4000-8000-000000000033';
SELECT resolve_free_agency_offer('40000000-0000-4000-8000-000000000033',
  (SELECT id FROM free_agency_pending_offers WHERE request_id = '60000000-0000-4000-8000-000000000033'));
SELECT pg_temp.assert_true(get_free_agency_market('40000000-0000-4000-8000-000000000033')->'candidates' = '[]'::jsonb,
  'Signed player remained available');
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT import_initial_free_agents('40000000-0000-4000-8000-000000000033',
  '10000000-0000-4000-8000-000000000001', NULL);
SELECT pg_temp.assert_true((SELECT team_id = '20000000-0000-4000-8000-000000000001' FROM game_player_states
  WHERE game_id = '40000000-0000-4000-8000-000000000033' AND player_id = (SELECT id FROM players WHERE nba_id = 9000331)),
  'Import replay reset a completed signing');
SELECT import_initial_free_agents('40000000-0000-4000-8000-000000000034',
  '10000000-0000-4000-8000-000000000002', (SELECT value FROM nba_snapshot));
SELECT pg_temp.assert_true((SELECT team_id IS NULL FROM game_player_states
  WHERE game_id = '40000000-0000-4000-8000-000000000034' AND player_id = (SELECT id FROM players WHERE nba_id = 9000331)),
  'A signing leaked into another save');
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM free_agency_imports), 'Import snapshot RLS leaked another save');
SELECT pg_temp.expect_error($q$SELECT import_initial_free_agents('40000000-0000-4000-8000-000000000033',
  '10000000-0000-4000-8000-000000000001', NULL)$q$, 'permission denied');
RESET ROLE;
ROLLBACK;
