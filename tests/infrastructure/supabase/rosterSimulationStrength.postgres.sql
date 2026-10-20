-- A real scheduled-game score must use save roster depth while retaining the existing seed.
BEGIN;
DELETE FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000017' AND status = 'pending';
DELETE FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND offer_origin = 'ai' AND ai_decision_date = '2026-10-02' AND status IN ('pending', 'rejected');
INSERT INTO players(id, first_name, last_name, full_name, years_of_experience, is_active)
VALUES ('2f000000-0000-4000-8000-000000000099', 'AI', 'Roster Target', 'AI Roster Target', 4, true);
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000002', '2f000000-0000-4000-8000-000000000099', NULL, true);
INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
VALUES ('40000000-0000-4000-8000-000000000002', '2f000000-0000-4000-8000-000000000099',
  'simulation-bootstrap-enrollment');
UPDATE game_player_states SET
  team_id = (CASE
    WHEN player_id IN ('30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000018',
                       '30000000-0000-4000-8000-000000000020') THEN '20000000-0000-4000-8000-000000000002'
    WHEN player_id IN ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
                       '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000006',
                       '30000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000008',
                       '30000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000010',
                       '30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012',
                       '30000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000014',
                       '30000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000016')
      THEN '20000000-0000-4000-8000-000000000001'
    ELSE NULL END)::UUID,
  is_active = true, is_injured = false
WHERE game_id = '40000000-0000-4000-8000-000000000002';
UPDATE games SET simulation_date = '2026-10-02'
WHERE id = '40000000-0000-4000-8000-000000000002';
UPDATE scheduled_games SET status = 'scheduled', home_score = NULL, away_score = NULL, winner_team_id = NULL
WHERE id IN ('70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002');
UPDATE league_standings SET wins = 0, losses = 0
WHERE game_id = '40000000-0000-4000-8000-000000000002';
CREATE TEMP TABLE roster_strength_orig_ratings AS
SELECT id, base_rating FROM teams
WHERE id IN ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
UPDATE games SET season_era_id = 'jordan' WHERE id = '40000000-0000-4000-8000-000000000003';
SELECT pg_temp.assert_true(
  get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001') =
    (SELECT base_rating + 4 FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
    'Fourteen available human-save players must add four rating points');
SELECT pg_temp.assert_true(
  get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002') =
    (SELECT base_rating - 18 FROM teams WHERE id = '20000000-0000-4000-8000-000000000002'),
    'Three AI-roster players must apply the independent three-player adjustment');
SELECT pg_temp.assert_true(
  get_simulation_team_rating('40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001') =
    (SELECT base_rating - 22 FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'The same team must receive its distinct game-save roster count');
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  'Modern fallback test', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing');
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Modern save without roster states or materialization must retain base rating');
INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
VALUES ('40000000-0000-4000-8000-000000000004', 'fixture', '2026-27',
  ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 30)));
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Materialized modern save without roster states must retain base rating');
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000017', NULL, true);
DELETE FROM game_contract_materializations WHERE game_id = '40000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Unmaterialized modern save with roster rows must retain base rating');
UPDATE players SET is_active = false WHERE id = '30000000-0000-4000-8000-000000000006';
SELECT pg_temp.assert_true(
  get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001') =
    (SELECT base_rating + 4 FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Global player activity must not change save roster strength');
UPDATE players SET is_active = true WHERE id = '30000000-0000-4000-8000-000000000006';
UPDATE game_player_states SET is_active = false WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000006';
UPDATE game_player_states SET is_injured = true WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000007';
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Inactive and injured players must be excluded');
UPDATE game_player_states SET is_active = true, is_injured = false
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id IN ('30000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000007');
UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000001'
WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id IN ('30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000018',
                    '30000000-0000-4000-8000-000000000020');
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating + 6 FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'More than fifteen available players must not add extra depth');
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002') =
  (SELECT base_rating - 24 FROM teams WHERE id = '20000000-0000-4000-8000-000000000002'),
  'An empty team in a materialized roster universe must receive the zero-player penalty');
UPDATE teams SET base_rating = 99 WHERE id = '20000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001') = 100, 'Roster maximum cap or upper rating clamp failed');
UPDATE teams SET base_rating = 5 WHERE id = '20000000-0000-4000-8000-000000000002';
UPDATE game_player_states SET is_injured = true WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND team_id = '20000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true(get_simulation_team_rating('40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002') = 0, 'Empty AI roster or lower rating clamp failed');
UPDATE teams SET base_rating = orig.base_rating FROM roster_strength_orig_ratings orig
WHERE teams.id = orig.id;
UPDATE game_player_states SET
  team_id = (CASE
    WHEN player_id IN ('30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000018',
                       '30000000-0000-4000-8000-000000000020') THEN '20000000-0000-4000-8000-000000000002'
    WHEN player_id IN ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
                       '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000006',
                       '30000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000008',
                       '30000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000010',
                       '30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000012',
                       '30000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000014',
                       '30000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000016')
      THEN '20000000-0000-4000-8000-000000000001'
    ELSE NULL END)::UUID,
  is_active = true, is_injured = false
WHERE game_id = '40000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_true(
  get_simulation_team_rating('40000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001') =
  (SELECT base_rating FROM teams WHERE id = '20000000-0000-4000-8000-000000000001'),
  'Historical save did not retain base rating');
UPDATE game_player_states SET is_active = false WHERE game_id = '40000000-0000-4000-8000-000000000002'
  AND player_id = '30000000-0000-4000-8000-000000000006';
SAVEPOINT no_signing;
SELECT * FROM advance_simulation_day_core('40000000-0000-4000-8000-000000000002', '2026-10-02');
SELECT home_score AS baseline_home_score FROM scheduled_games
WHERE id = '70000000-0000-4000-8000-000000000001' \gset
SELECT away_score AS baseline_same_day_away FROM scheduled_games
WHERE id = '70000000-0000-4000-8000-000000000001' \gset
SELECT * FROM advance_simulation_day_core('40000000-0000-4000-8000-000000000002', '2026-10-03');
SELECT home_score AS baseline_next_home FROM scheduled_games
WHERE id = '70000000-0000-4000-8000-000000000002' \gset
SELECT away_score AS baseline_away_score FROM scheduled_games
WHERE id = '70000000-0000-4000-8000-000000000002' \gset
ROLLBACK TO SAVEPOINT no_signing;
SELECT submit_free_agency_offer('40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000017', '6fffffff-0000-4000-8000-000000000010',
  '2026-27', 42000000, 1);
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
SELECT pg_temp.assert_true((SELECT home_score = :'baseline_home_score'::SMALLINT
  FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000001'),
  'End-of-day signing changed the same-day fixture');
SELECT pg_temp.assert_true((SELECT away_score = :'baseline_same_day_away'::SMALLINT
  FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000001'),
  'End-of-day signing changed the same-day away score');
SELECT pg_temp.assert_true((SELECT s.team_id = '20000000-0000-4000-8000-000000000001'
  AND o.status = 'accepted' AND o.offer_origin = 'human'
  FROM game_player_states s JOIN free_agency_pending_offers o
    ON o.game_id = s.game_id AND o.player_id = s.player_id
  WHERE s.game_id = '40000000-0000-4000-8000-000000000002'
    AND s.player_id = '30000000-0000-4000-8000-000000000017'
    AND o.request_id = '6fffffff-0000-4000-8000-000000000010'),
  format('Human signing did not commit: team %s, status %s, origin %s',
    (SELECT team_id::TEXT FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '30000000-0000-4000-8000-000000000017'),
    (SELECT status FROM free_agency_pending_offers WHERE request_id = '6fffffff-0000-4000-8000-000000000010'),
    (SELECT offer_origin FROM free_agency_pending_offers WHERE request_id = '6fffffff-0000-4000-8000-000000000010')));
SELECT pg_temp.assert_true((SELECT s.team_id = '20000000-0000-4000-8000-000000000002'
  AND o.status = 'accepted' AND o.offer_origin = 'ai'
  FROM game_player_states s JOIN free_agency_pending_offers o
    ON o.game_id = s.game_id AND o.player_id = s.player_id
  WHERE s.game_id = '40000000-0000-4000-8000-000000000002'
    AND s.player_id = '2f000000-0000-4000-8000-000000000099'),
  format('AI signing did not commit: team %s, status %s, origin %s',
    (SELECT team_id::TEXT FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '2f000000-0000-4000-8000-000000000099'),
    (SELECT status FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '2f000000-0000-4000-8000-000000000099'),
    (SELECT offer_origin FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002'
      AND player_id = '2f000000-0000-4000-8000-000000000099')));
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-03');
SELECT pg_temp.assert_true((SELECT home_score <> :'baseline_next_home'::SMALLINT
  FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000002'),
  'AI signing did not change its same-seed next-day home score');
SELECT pg_temp.assert_true((SELECT away_score <> :'baseline_away_score'::SMALLINT
  FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000002'),
  'Human signing did not change its same-seed next-day away score');
SELECT home_score AS actual_next_home FROM scheduled_games
WHERE id = '70000000-0000-4000-8000-000000000002' \gset
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');
SELECT pg_temp.assert_true((SELECT home_score = :'actual_next_home'::SMALLINT
  FROM scheduled_games WHERE id = '70000000-0000-4000-8000-000000000002'),
  'Stale public day replay mutated completed score');
UPDATE games SET status = 'active' WHERE id = '40000000-0000-4000-8000-000000000004';
INSERT INTO scheduled_games(id, game_id, game_date, home_team_id, away_team_id) VALUES
  ('70000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', '2026-10-03',
    '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('70000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', '2026-10-04',
    '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000004', '2026-10-05',
    '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
INSERT INTO league_standings(game_id, team_id) SELECT '40000000-0000-4000-8000-000000000004', id
FROM teams ON CONFLICT DO NOTHING;
CREATE FUNCTION pg_temp.fail_sports_clock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.simulation_date IS DISTINCT FROM OLD.simulation_date
     AND EXISTS (SELECT 1 FROM scheduled_games WHERE game_id = NEW.id AND status = 'completed') THEN
    RAISE EXCEPTION 'Injected failure after sports before clock commit';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER roster_strength_clock_failure BEFORE UPDATE OF simulation_date ON games
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_sports_clock();
SELECT pg_temp.expect_error($q$SELECT * FROM advance_simulation_day(
  '40000000-0000-4000-8000-000000000004', '2026-10-02')$q$,
  'Injected failure after sports before clock commit');
SELECT pg_temp.assert_true((SELECT simulation_date = '2026-10-02' FROM games
  WHERE id = '40000000-0000-4000-8000-000000000004')
  AND (SELECT bool_and(status = 'scheduled' AND home_score IS NULL AND away_score IS NULL)
    FROM scheduled_games WHERE game_id = '40000000-0000-4000-8000-000000000004'),
  'Public day failure committed sports or clock writes');
DROP TRIGGER roster_strength_clock_failure ON games;
SAVEPOINT core_range_baseline;
SELECT new_date FROM advance_simulation_day_core('40000000-0000-4000-8000-000000000004', '2026-10-02');
SELECT new_date FROM advance_simulation_day_core('40000000-0000-4000-8000-000000000004', '2026-10-03');
SELECT new_date FROM advance_simulation_day_core('40000000-0000-4000-8000-000000000004', '2026-10-04');
SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) AS core_range FROM scheduled_games s
WHERE s.game_id = '40000000-0000-4000-8000-000000000004' \gset
ROLLBACK TO SAVEPOINT core_range_baseline;
SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000004', '2026-10-02');
SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000004', '2026-10-03');
SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000004', '2026-10-04');
SELECT pg_temp.assert_true((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) = :'core_range'::JSONB
  FROM scheduled_games s WHERE s.game_id = '40000000-0000-4000-8000-000000000004'),
  'Public daily range diverged from the unchanged simulation core');
SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) AS completed_range FROM scheduled_games s
WHERE s.game_id = '40000000-0000-4000-8000-000000000004' \gset
SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000004', '2026-10-04');
SELECT pg_temp.assert_true((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) = :'completed_range'::JSONB
  FROM scheduled_games s WHERE s.game_id = '40000000-0000-4000-8000-000000000004'),
  'Stale range replay changed completed fixtures');
UPDATE games SET simulation_date = '2027-04-15' WHERE id = '40000000-0000-4000-8000-000000000004';
SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) AS terminal_range FROM scheduled_games s
WHERE s.game_id = '40000000-0000-4000-8000-000000000004' \gset
SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000004', '2027-04-15');
SELECT pg_temp.assert_true((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) = :'terminal_range'::JSONB
  AND (SELECT simulation_date = '2027-04-15' FROM games WHERE id = '40000000-0000-4000-8000-000000000004')
  FROM scheduled_games s WHERE s.game_id = '40000000-0000-4000-8000-000000000004'),
  'Terminal public-day retry changed completed fixtures or clock');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT pg_temp.expect_error($q$SELECT get_simulation_team_rating(
  '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$,
  'Game not found or access denied');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $$ BEGIN
  IF has_function_privilege('anon', 'get_simulation_team_rating(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'get_simulation_team_rating(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'get_simulation_team_rating(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'advance_simulation_day_core(uuid,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'advance_simulation_day_core(uuid,date)', 'EXECUTE')
     OR has_function_privilege('service_role', 'advance_simulation_day_core(uuid,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private simulation functions expose client or service execution';
  END IF;
END $$;
SET ROLE authenticated;
SELECT pg_temp.expect_error($q$SELECT get_simulation_team_rating(
  '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$,
  'permission denied for function get_simulation_team_rating');
SELECT pg_temp.expect_error($q$SELECT advance_simulation_day_core(
  '40000000-0000-4000-8000-000000000002', '2026-10-04')$q$,
  'permission denied for function advance_simulation_day_core');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.expect_error($q$SELECT get_simulation_team_rating(
  '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$,
  'permission denied for function get_simulation_team_rating');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.expect_error($q$SELECT get_simulation_team_rating(
  '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$,
  'permission denied for function get_simulation_team_rating');
RESET ROLE;
ROLLBACK;
