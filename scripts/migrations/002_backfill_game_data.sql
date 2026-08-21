-- Migration 002: Backfill / seed data for new games
--
-- Purpose:
--   Define a reusable seeding function for Phase 2 of game-model migration.
--   In this project stage, "backfill" means seeding data when a user creates
--   their first game (fresh project, no legacy production data).
--
-- Prerequisites:
--   - `games`, `players`, `contracts`, and `game_player_states` tables exist.
--   - Phase 1 schema is already present in `scripts/schema.sql`.
--   - Historical template tables exist when historical snapshots are enabled.
--
-- Behavior:
--   seed_game_data(p_game_id, p_team_id)
--     1) Reads the created game's `season_year`.
--     2) Seeds from historical templates when that season has a snapshot.
--     3) Falls back to current canonical team assignments and unscoped seed
--        contracts when no historical snapshot exists.
--
-- IMPORTANT: These functions use SECURITY DEFINER so they execute with
-- the privilege of the function owner (postgres), bypassing RLS.
-- This is necessary because:
--   - The user creating a game needs to INSERT into game_player_states
--     and INSERT game-scoped contract copies.
--   - The integrity guard in seed_game_data verifies the game matches the
--     selected team before proceeding.
--
-- Rollback behavior (function included below):
--   rollback_seed_game_data(p_game_id)
--     - DELETE FROM contracts WHERE game_id = p_game_id;
--     - DELETE FROM game_player_states WHERE game_id = p_game_id;

BEGIN;

CREATE OR REPLACE FUNCTION seed_game_data(p_game_id UUID, p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_year INTEGER;
  v_has_historical_templates BOOLEAN;
BEGIN
  -- Integrity guard: ensure the game exists and matches selected team.
  SELECT g.season_year
  INTO v_season_year
  FROM games g
  WHERE g.id = p_game_id
    AND g.selected_team_id = p_team_id
    AND g.user_id = auth.uid();

  IF v_season_year IS NULL THEN
    RAISE EXCEPTION
      'seed_game_data aborted: game % does not exist, is not owned by the caller, or does not match selected_team_id %',
      p_game_id,
      p_team_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM historical_roster_templates hrt
    WHERE hrt.season_year = v_season_year
  )
  INTO v_has_historical_templates;

  IF v_season_year = 2010 AND NOT v_has_historical_templates THEN
    RAISE EXCEPTION
      'seed_game_data aborted: historical templates for season % are not loaded',
      v_season_year;
  END IF;

  IF v_has_historical_templates THEN
    -- 1) Seed one state row per player from the historical roster snapshot.
    INSERT INTO game_player_states (
      game_id,
      player_id,
      team_id,
      is_active
    )
    SELECT
      p_game_id,
      hrt.player_id,
      hrt.team_id,
      hrt.is_active
    FROM historical_roster_templates hrt
    WHERE hrt.season_year = v_season_year
    ON CONFLICT (game_id, player_id)
    DO UPDATE
    SET
      team_id = EXCLUDED.team_id,
      is_active = EXCLUDED.is_active,
      updated_at = now();

    -- 2) Copy approximate historical contract templates into this game scope.
    INSERT INTO contracts (
      game_id,
      player_id,
      team_id,
      start_year,
      end_year,
      salary_y1,
      salary_y2,
      salary_y3,
      salary_y4,
      salary_y5,
      is_player_option,
      is_team_option,
      is_guaranteed
    )
    SELECT
      p_game_id,
      hct.player_id,
      hct.team_id,
      hct.start_year,
      hct.end_year,
      hct.salary_y1,
      hct.salary_y2,
      hct.salary_y3,
      hct.salary_y4,
      hct.salary_y5,
      hct.is_player_option,
      hct.is_team_option,
      hct.is_guaranteed
    FROM historical_contract_templates hct
    WHERE hct.season_year = v_season_year
      AND EXISTS (
        SELECT 1
        FROM game_player_states gps
        WHERE gps.game_id = p_game_id
          AND gps.player_id = hct.player_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM contracts c
        WHERE c.game_id = p_game_id
          AND c.player_id = hct.player_id
      );
  ELSE
    -- 1) Fallback: seed one state row per player based on current canonical team assignment.
    INSERT INTO game_player_states (
      game_id,
      player_id,
      team_id
    )
    SELECT
      p_game_id,
      p.id,
      p.team_id
    FROM players p
    WHERE p.team_id IS NOT NULL
    ON CONFLICT (game_id, player_id)
    DO UPDATE
    SET
      team_id = EXCLUDED.team_id,
      updated_at = now();

    -- 2) Fallback: copy unscoped seed contracts into this game scope.
    INSERT INTO contracts (
      game_id,
      player_id,
      team_id,
      start_year,
      end_year,
      salary_y1,
      salary_y2,
      salary_y3,
      salary_y4,
      salary_y5,
      is_player_option,
      is_team_option,
      is_guaranteed
    )
    SELECT
      p_game_id,
      c.player_id,
      c.team_id,
      c.start_year,
      c.end_year,
      c.salary_y1,
      c.salary_y2,
      c.salary_y3,
      c.salary_y4,
      c.salary_y5,
      c.is_player_option,
      c.is_team_option,
      c.is_guaranteed
    FROM contracts c
    WHERE c.game_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM game_player_states gps
        WHERE gps.game_id = p_game_id
          AND gps.player_id = c.player_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM contracts existing_contract
        WHERE existing_contract.game_id = p_game_id
          AND existing_contract.player_id = c.player_id
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION rollback_seed_game_data(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM games g
    WHERE g.id = p_game_id
      AND g.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'rollback_seed_game_data aborted: game % is not owned by the caller', p_game_id;
  END IF;

  DELETE FROM contracts
  WHERE game_id = p_game_id;

  DELETE FROM game_player_states
  WHERE game_id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION seed_game_data(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_game_data(UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION rollback_seed_game_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rollback_seed_game_data(UUID) TO authenticated;

COMMIT;

-- Usage example (manual run):
--   SELECT seed_game_data('<game_uuid>', '<selected_team_uuid>');
-- Rollback example:
--   SELECT rollback_seed_game_data('<game_uuid>');
