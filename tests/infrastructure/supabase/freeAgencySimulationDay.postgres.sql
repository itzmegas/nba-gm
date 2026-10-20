-- Fixed sports schedule and explicit second candidate; the market never invents enrollment.
INSERT INTO scheduled_games(id, game_id, game_date, home_team_id, away_team_id) VALUES
  ('70000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '2026-10-03',
    '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '2026-10-04',
    '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');
INSERT INTO league_standings(game_id, team_id) SELECT '40000000-0000-4000-8000-000000000002', id FROM teams;
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000017', NULL, true);
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000017', 'simulation-bootstrap-enrollment');

CREATE FUNCTION pg_temp.day_snapshot() RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_object_agg(name, rows) FROM (
    SELECT 'games' AS name, jsonb_agg(to_jsonb(x) ORDER BY id) AS rows FROM games x
    UNION ALL SELECT 'roster', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_player_states x
    UNION ALL SELECT 'runtime', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_runtime_contracts x
    UNION ALL SELECT 'offers', jsonb_agg(to_jsonb(x) ORDER BY id) FROM free_agency_pending_offers x
    UNION ALL SELECT 'schedule', jsonb_agg(to_jsonb(x) ORDER BY id) FROM scheduled_games x
    UNION ALL SELECT 'standings', jsonb_agg(to_jsonb(x) ORDER BY game_id, team_id) FROM league_standings x
    UNION ALL SELECT 'identities', jsonb_agg(to_jsonb(x) ORDER BY game_id, player_id) FROM game_contract_identities x
    UNION ALL SELECT 'agreements', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_contract_agreements x
    UNION ALL SELECT 'seasons', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_contract_seasons x
    UNION ALL SELECT 'provenance', jsonb_agg(to_jsonb(x) ORDER BY agreement_id) FROM game_contract_provenance x
    UNION ALL SELECT 'sources', jsonb_agg(to_jsonb(x) ORDER BY id) FROM contract_source_snapshot_versions x
    UNION ALL SELECT 'legacy', jsonb_agg(to_jsonb(x) ORDER BY id) FROM contracts x
  ) snapshots
$$;

BEGIN;
SET ROLE authenticated;
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT simulation_date = '2026-10-03' FROM games
  WHERE id = '40000000-0000-4000-8000-000000000002'), 'Clock did not advance');
SELECT pg_temp.assert_true((SELECT status = 'completed' FROM scheduled_games
  WHERE id = '70000000-0000-4000-8000-000000000001'), 'Sports core was bypassed');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM free_agency_pending_offers WHERE status = 'accepted'), 'Public day did not sign exactly one offer');
CREATE TEMP TABLE stale_before AS SELECT pg_temp.day_snapshot() AS snapshot;
SET ROLE authenticated;
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
RESET ROLE;
SELECT pg_temp.assert_true(pg_temp.day_snapshot() = (SELECT snapshot FROM stale_before), 'Stale day retry mutated state');
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day_core('40000000-0000-4000-8000-000000000002', '2026-10-03')$q$,
  'permission denied for function advance_simulation_day_core');
RESET ROLE;
ROLLBACK;

-- Fail after AI insertion, sports simulation, standings and clock writes, then compare every protected row.
CREATE FUNCTION pg_temp.fail_market_day() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT simulation_date FROM games WHERE id = NEW.game_id) <> '2026-10-03'
     OR (SELECT status FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000001') <> 'completed' THEN
    RAISE EXCEPTION 'Rollback injection did not reach post-sports state';
  END IF;
  RAISE EXCEPTION 'Injected market-day failure after sports and clock writes';
END $$;
BEGIN;
CREATE TRIGGER market_day_failure AFTER INSERT ON game_runtime_contracts FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_market_day();
CREATE TEMP TABLE rollback_before AS SELECT pg_temp.day_snapshot() AS snapshot;
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02')$q$,
  'Injected market-day failure after sports and clock writes');
SELECT pg_temp.assert_true(pg_temp.day_snapshot() = (SELECT snapshot FROM rollback_before), 'Market failure partially committed the day');
ROLLBACK;

-- Compare durable outcomes, excluding random agreement/request IDs and wall-clock audit times.
CREATE FUNCTION pg_temp.day_outcome() RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'date', (SELECT simulation_date FROM games WHERE id = '40000000-0000-4000-8000-000000000002'),
    'roster', (SELECT jsonb_agg(jsonb_build_array(player_id, team_id, is_active) ORDER BY player_id) FROM game_player_states
      WHERE game_id = '40000000-0000-4000-8000-000000000002'),
    'runtime', (SELECT jsonb_agg(to_jsonb(x) - 'id' - 'created_at' ORDER BY player_id) FROM game_runtime_contracts x),
    'offers', (SELECT jsonb_agg(to_jsonb(x) - 'request_id' - 'created_at' - 'resolved_at' - 'resolved_contract_id' ORDER BY id)
      FROM free_agency_pending_offers x),
    'sports', (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM scheduled_games x),
    'standings', (SELECT jsonb_agg(to_jsonb(x) ORDER BY game_id, team_id) FROM league_standings x)
  )
$$;
BEGIN;
DO $$
DECLARE cursor_date DATE := '2026-10-02'; next_date DATE;
BEGIN
  FOR day IN 1..3 LOOP
    SELECT new_date INTO next_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', cursor_date) LIMIT 1;
    cursor_date := next_date;
  END LOOP;
END $$;
SELECT pg_temp.day_outcome() AS range_outcome \gset
ROLLBACK;
BEGIN;
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-03');
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-04');
SELECT pg_temp.assert_true(pg_temp.day_outcome() = :'range_outcome'::jsonb, 'Day/range outcomes diverged');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM game_runtime_contracts WHERE source_offer_id IS NOT NULL), 'Range lost human or AI signing');
ROLLBACK;

BEGIN;
UPDATE games SET simulation_date = '2027-04-15' WHERE id = '40000000-0000-4000-8000-000000000002';
CREATE TEMP TABLE terminal_before AS SELECT pg_temp.day_snapshot() AS snapshot;
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2027-04-15');
SELECT pg_temp.assert_true(pg_temp.day_snapshot() = (SELECT snapshot FROM terminal_before), 'Terminal day ran the market');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02')$q$, 'Game not found or access denied');
ROLLBACK;
BEGIN;
UPDATE games SET status = 'archived' WHERE id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02')$q$, 'Game not found or access denied');
ROLLBACK;
BEGIN;
UPDATE games SET season_era_id = 'jordan' WHERE id = '40000000-0000-4000-8000-000000000003';
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000003', '2026-10-02');
SELECT pg_temp.assert_true((SELECT simulation_date = '2026-10-03' FROM games
  WHERE id = '40000000-0000-4000-8000-000000000003'), 'Historical simulation regressed');
ROLLBACK;
