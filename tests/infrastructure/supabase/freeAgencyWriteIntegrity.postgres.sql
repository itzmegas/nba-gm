-- PRE_MIGRATION_023: confirm the valid unreferenced-row delete bypass exists.
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001', true);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_rows INTEGER;
BEGIN
  DELETE FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
    AND player_id = '30000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'Expected pre-023 direct delete negative control to affect one unreferenced row'; END IF;
  RAISE NOTICE 'RED negative control: pre-023 authenticated DELETE removed unreferenced roster row';
END $$;
SELECT 'RED: pre-023 authenticated DELETE removed an unreferenced roster row' AS guard_negative_control;
RESET ROLE;
INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001', true);

-- AFTER_MIGRATION_023
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
    VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000006',
      '20000000-0000-4000-8000-000000000002', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Direct roster insertion is not permitted' THEN
    RAISE EXCEPTION 'INSERT guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    DELETE FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000005';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Direct roster deletion is not permitted' THEN
    RAISE EXCEPTION 'Unreferenced DELETE guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Roster identity, ownership, and eligibility are authoritative' THEN
    RAISE EXCEPTION 'Team reassign guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE game_player_states SET is_active = false
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Roster identity, ownership, and eligibility are authoritative' THEN
    RAISE EXCEPTION 'is_active guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE game_player_states SET game_id = '40000000-0000-4000-8000-000000000002'
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Roster identity, ownership, and eligibility are authoritative' THEN
    RAISE EXCEPTION 'Owned-game reparent guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE game_player_states SET game_id = '40000000-0000-4000-8000-000000000003'
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Roster identity, ownership, and eligibility are authoritative' THEN
    RAISE EXCEPTION 'Unowned-game reparent guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE contracts SET salary_y1 = salary_y1 + 1
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Legacy contract identity and salary are authoritative' THEN
    RAISE EXCEPTION 'Legacy salary guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;

  v_state := NULL; v_message := NULL;
  BEGIN
    UPDATE games SET simulation_date = simulation_date + 1
    WHERE id = '40000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Game ownership, identity, and simulation clock are authoritative' THEN
    RAISE EXCEPTION 'Initializing-game clock guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;
SELECT 'GREEN: authenticated insert/delete/team/eligibility guard diagnostics matched exactly' AS direct_write_guard_proof;

-- A second authenticated owner must neither read nor call initialization for user one's game.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT; v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM game_player_states
  WHERE game_id = '40000000-0000-4000-8000-000000000001';
  IF v_count <> 0 THEN RAISE EXCEPTION 'User two read another owner game roster'; END IF;
  BEGIN
    PERFORM seed_game_data('40000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'seed_game_data aborted:%' THEN
    RAISE EXCEPTION 'User two initialization RPC denial mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;
SELECT 'GREEN: second owner read and initialization RPC were denied' AS owner_isolation_proof;
RESET ROLE;

-- The real authenticated creation/seed/activate path remains supported.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    PERFORM enroll_simulated_free_agents('40000000-0000-4000-8000-000000000001',
      ARRAY['30000000-0000-4000-8000-000000000005'::uuid]);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM '42501' OR v_message IS DISTINCT FROM 'permission denied for function enroll_simulated_free_agents' THEN
    RAISE EXCEPTION 'Authenticated bootstrap RPC denial mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    UPDATE game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
    WHERE game_id = '40000000-0000-4000-8000-000000000001'
      AND player_id = '30000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Roster identity, ownership, and eligibility are authoritative' THEN
    RAISE EXCEPTION 'Anonymous roster guard diagnostic mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);

INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001',
  'Authenticated creation path', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing');
SELECT seed_game_data('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001');
UPDATE games SET status = 'active' WHERE id = '40000000-0000-4000-8000-000000000004';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Authenticated seed RPC did not create roster state';
  END IF;
  BEGIN
    PERFORM rollback_seed_game_data('40000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message NOT LIKE 'rollback_seed_game_data aborted:% is not initializing' THEN
    RAISE EXCEPTION 'Active rollback RPC denial mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;
UPDATE games SET status = 'deleted', deleted_at = now()
WHERE id = '40000000-0000-4000-8000-000000000004';
UPDATE games SET status = 'active', deleted_at = NULL
WHERE id = '40000000-0000-4000-8000-000000000004';
DO $$
DECLARE v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    UPDATE games SET status = 'initializing'
    WHERE id = '40000000-0000-4000-8000-000000000004';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM 'Game ownership, identity, and simulation clock are authoritative' THEN
    RAISE EXCEPTION 'Soft-delete/reactivation reset guard mismatch: state %, message %', v_state, v_message;
  END IF;
END $$;

-- Initializing rollback remains valid, with both setup RPCs used under the real owner.
INSERT INTO games(id, user_id, name, selected_team_id, season_year, season_era_id, simulation_date, status)
VALUES ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
  'Initializing rollback path', '20000000-0000-4000-8000-000000000001', 2026, 'modern', '2026-10-02', 'initializing');
SELECT seed_game_data('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001');
SELECT rollback_seed_game_data('40000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM game_player_states WHERE game_id = '40000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'Initializing rollback left roster rows behind';
  END IF;
END $$;

UPDATE game_player_states SET morale = 61, fatigue = 12, is_injured = true
WHERE game_id = '40000000-0000-4000-8000-000000000001'
  AND player_id = '30000000-0000-4000-8000-000000000001';
UPDATE games SET name = 'Renamed after guard migration'
WHERE id = '40000000-0000-4000-8000-000000000001';
SELECT * FROM advance_simulation_day('40000000-0000-4000-8000-000000000001', '2026-10-02');
DO $$ BEGIN
  IF (SELECT simulation_date FROM games WHERE id = '40000000-0000-4000-8000-000000000001') <> '2026-10-03' THEN
    RAISE EXCEPTION 'Authorized day advancement did not update simulation date';
  END IF;
END $$;
SELECT 'GREEN: authenticated lifecycle, seed, rollback, rename, low-risk state and day advancement preserved' AS lifecycle_proof;
RESET ROLE;
