CREATE FUNCTION public.fixture_day_state() RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_object_agg(name, rows) FROM (
    SELECT 'games' AS name, jsonb_agg(to_jsonb(x) ORDER BY id) AS rows FROM games x
    UNION ALL SELECT 'roster', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_player_states x
    UNION ALL SELECT 'offers', jsonb_agg(to_jsonb(x) ORDER BY id) FROM free_agency_pending_offers x
    UNION ALL SELECT 'runtime', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_runtime_contracts x
    UNION ALL SELECT 'sports', jsonb_agg(to_jsonb(x) ORDER BY id) FROM scheduled_games x
    UNION ALL SELECT 'standings', jsonb_agg(to_jsonb(x) ORDER BY game_id, team_id) FROM league_standings x
    UNION ALL SELECT 'identities', jsonb_agg(to_jsonb(x) ORDER BY game_id, player_id) FROM game_contract_identities x
    UNION ALL SELECT 'agreements', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_contract_agreements x
    UNION ALL SELECT 'seasons', jsonb_agg(to_jsonb(x) ORDER BY id) FROM game_contract_seasons x
    UNION ALL SELECT 'provenance', jsonb_agg(to_jsonb(x) ORDER BY agreement_id) FROM game_contract_provenance x
    UNION ALL SELECT 'sources', jsonb_agg(to_jsonb(x) ORDER BY id) FROM contract_source_snapshot_versions x
    UNION ALL SELECT 'legacy', jsonb_agg(to_jsonb(x) ORDER BY id) FROM contracts x
  ) snapshots
$$;
CREATE TABLE fixture_day_before AS SELECT fixture_day_state() AS snapshot;

-- AFTER_CONCURRENT_DAYS
SELECT pg_temp.assert_true((SELECT simulation_date = '2026-10-03' FROM games
  WHERE id = '40000000-0000-4000-8000-000000000002'), 'Duplicate request advanced two days');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM free_agency_pending_offers WHERE offer_origin = 'ai'), 'Duplicate day generated multiple AI bids');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM game_runtime_contracts WHERE source_offer_id IS NOT NULL), 'Duplicate day signed twice');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM free_agency_pending_offers WHERE status = 'accepted'), 'Duplicate day accepted competing offers');
SELECT pg_temp.assert_true((SELECT sum(wins) = 1 AND sum(losses) = 1 FROM league_standings), 'Duplicate day counted sports twice');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM scheduled_games WHERE status = 'completed'), 'Duplicate day simulated extra games');
DO $$
DECLARE before_state JSONB; after_state JSONB; key TEXT;
BEGIN
  SELECT snapshot INTO before_state FROM fixture_day_before;
  after_state := fixture_day_state();
  FOREACH key IN ARRAY ARRAY['identities','agreements','seasons','provenance','sources','legacy'] LOOP
    IF before_state->key IS DISTINCT FROM after_state->key THEN RAISE EXCEPTION 'Market changed imported % snapshot', key; END IF;
  END LOOP;
END $$;
CREATE TABLE fixture_day_after AS SELECT fixture_day_state() AS snapshot;
SET ROLE authenticated;
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
RESET ROLE;
SELECT pg_temp.assert_true(fixture_day_state() = (SELECT snapshot FROM fixture_day_after), 'Post-race stale replay mutated state');
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-03')$q$,
  'permission denied for function advance_simulation_day');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day_core('40000000-0000-4000-8000-000000000002', '2026-10-03')$q$,
  'permission denied for function advance_simulation_day_core');
RESET ROLE;
