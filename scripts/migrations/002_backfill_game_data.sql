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
--
-- Behavior:
--   seed_game_data(p_game_id, p_team_id)
--     1) Seeds `game_player_states` from canonical league mapping (`players.team_id`).
--     2) Assigns contracts to this game (only contracts whose player is in game_player_states).
--
-- IMPORTANT: These functions use SECURITY DEFINER so they execute with
-- the privilege of the function owner (postgres), bypassing RLS.
-- This is necessary because:
--   - The user creating a game needs to INSERT into game_player_states
--     and UPDATE contracts that don't yet have a game_id (which RLS blocks).
--   - The integrity guard in seed_game_data verifies the game belongs to
--     the calling user before proceeding.
--
-- Rollback behavior (function included below):
--   rollback_seed_game_data(p_game_id)
--     - DELETE FROM game_player_states WHERE game_id = p_game_id;
--     - UPDATE contracts SET game_id = NULL WHERE game_id = p_game_id;

BEGIN;

CREATE OR REPLACE FUNCTION seed_game_data(p_game_id UUID, p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Integrity guard: ensure the game exists and matches selected team.
  IF NOT EXISTS (
    SELECT 1
    FROM games g
    WHERE g.id = p_game_id
      AND g.selected_team_id = p_team_id
  ) THEN
    RAISE EXCEPTION
      'seed_game_data aborted: game % does not exist or does not match selected_team_id %',
      p_game_id,
      p_team_id;
  END IF;

  -- 1) Seed one state row per player based on real-world team assignment.
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

  -- 2) Assign contracts to this game.
  --    Only contracts whose player is in this game's player states,
  --    and that don't already belong to another game.
  UPDATE contracts c
  SET
    game_id = p_game_id,
    updated_at = now()
  WHERE c.game_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM game_player_states gps
      WHERE gps.game_id = p_game_id
        AND gps.player_id = c.player_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION rollback_seed_game_data(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM game_player_states
  WHERE game_id = p_game_id;

  UPDATE contracts
  SET
    game_id = NULL,
    updated_at = now()
  WHERE game_id = p_game_id;
END;
$$;

COMMIT;

-- Usage example (manual run):
--   SELECT seed_game_data('<game_uuid>', '<selected_team_uuid>');
-- Rollback example:
--   SELECT rollback_seed_game_data('<game_uuid>');