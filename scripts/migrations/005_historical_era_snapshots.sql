-- Migration 005: Historical era snapshots
--
-- Purpose:
--   Add immutable historical roster and contract template tables, then update
--   seed_game_data so a new game can copy season-specific templates when they
--   exist. The modern/default path remains a safe fallback based on current
--   canonical player team assignments and unscoped contract seed rows.
--
-- Rollback:
--   DROP TABLE historical_contract_templates;
--   DROP TABLE historical_roster_templates;
--   Recreate the previous seed_game_data and rollback_seed_game_data definitions
--   from scripts/migrations/002_backfill_game_data.sql before this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS historical_roster_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year INTEGER NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    position TEXT,
    jersey_number TEXT,
    roster_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT historical_roster_templates_season_player_unique UNIQUE (season_year, player_id)
);

CREATE TABLE IF NOT EXISTS historical_contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year INTEGER NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    salary_y1 BIGINT DEFAULT 0,
    salary_y2 BIGINT DEFAULT 0,
    salary_y3 BIGINT DEFAULT 0,
    salary_y4 BIGINT DEFAULT 0,
    salary_y5 BIGINT DEFAULT 0,
    is_player_option BOOLEAN DEFAULT false,
    is_team_option BOOLEAN DEFAULT false,
    is_guaranteed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT historical_contract_templates_year_check CHECK (end_year >= start_year),
    CONSTRAINT historical_contract_templates_season_player_unique UNIQUE (season_year, player_id)
);

CREATE INDEX IF NOT EXISTS idx_historical_roster_templates_season_year
  ON historical_roster_templates(season_year);
CREATE INDEX IF NOT EXISTS idx_historical_roster_templates_team_id
  ON historical_roster_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_historical_contract_templates_season_year
  ON historical_contract_templates(season_year);
CREATE INDEX IF NOT EXISTS idx_historical_contract_templates_team_id
  ON historical_contract_templates(team_id);

ALTER TABLE historical_roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historical_roster_templates_read_authenticated ON historical_roster_templates;
CREATE POLICY historical_roster_templates_read_authenticated
  ON historical_roster_templates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS historical_contract_templates_read_authenticated ON historical_contract_templates;
CREATE POLICY historical_contract_templates_read_authenticated
  ON historical_contract_templates
  FOR SELECT
  TO authenticated
  USING (true);

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
