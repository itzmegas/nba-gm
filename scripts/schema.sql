-- NBA GM Simulator: "GM"
-- Initial SQL Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nba_id INTEGER UNIQUE NOT NULL, -- Official NBA ID from API
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    conference TEXT,
    division TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nba_id INTEGER UNIQUE, -- Official NBA ID when known
    espn_id INTEGER UNIQUE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    position TEXT,
    height TEXT,
    weight TEXT,
    jersey_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Contracts Table (Simplification of NBA CBA)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    game_id UUID NOT NULL,
    start_year INTEGER NOT NULL, -- e.g., 2024
    end_year INTEGER NOT NULL,   -- e.g., 2028
    salary_y1 BIGINT DEFAULT 0,
    salary_y2 BIGINT DEFAULT 0,
    salary_y3 BIGINT DEFAULT 0,
    salary_y4 BIGINT DEFAULT 0,
    salary_y5 BIGINT DEFAULT 0,
    is_player_option BOOLEAN DEFAULT false,
    is_team_option BOOLEAN DEFAULT false,
    is_guaranteed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Game status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
    CREATE TYPE game_status AS ENUM ('initializing', 'active', 'archived', 'deleted');
  END IF;
END
$$;

-- 5. Games Table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
    selected_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    season_year INTEGER NOT NULL,
    season_era_id TEXT NOT NULL DEFAULT 'modern'
      CHECK (season_era_id IN ('modern', 'lebron', 'jordan')),
    simulation_date DATE NOT NULL,
    status game_status NOT NULL DEFAULT 'initializing',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT games_deleted_status_check CHECK (
      (status = 'deleted' AND deleted_at IS NOT NULL)
      OR
      (status <> 'deleted' AND deleted_at IS NULL)
    )
);

-- Add game FK for existing environments
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS game_id UUID;

ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_game_id_fkey;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_game_id_fkey
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE;

-- 6. Game Player States Table
CREATE TABLE IF NOT EXISTS game_player_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    morale SMALLINT NOT NULL DEFAULT 50 CHECK (morale BETWEEN 0 AND 100),
    fatigue SMALLINT NOT NULL DEFAULT 0 CHECK (fatigue BETWEEN 0 AND 100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_injured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT game_player_states_game_player_unique UNIQUE (game_id, player_id)
);

-- 7. Historical era snapshot templates (multi-era: 2010, 1995, etc.)
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

-- Current roster refresh staging and atomic promotion.
CREATE TABLE IF NOT EXISTS roster_refresh_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'success', 'failed')),
    expected_team_count INTEGER NOT NULL,
    completed_team_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roster_refresh_staging (
    run_id UUID REFERENCES roster_refresh_runs(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('espn')),
    player_source_id INTEGER NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT roster_refresh_staging_run_player_unique
      UNIQUE (run_id, provider, player_source_id)
);

CREATE TABLE IF NOT EXISTS career_saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT NOT NULL,
    college TEXT NOT NULL,
    current_age SMALLINT NOT NULL DEFAULT 18 CHECK (current_age >= 18),
    current_overall SMALLINT NOT NULL CHECK (current_overall BETWEEN 40 AND 99),
    events_resolved SMALLINT NOT NULL DEFAULT 0 CHECK (events_resolved >= 0),
    stage TEXT NOT NULL DEFAULT 'college'
      CHECK (stage IN ('college', 'draft', 'nba', 'retired')),
    current_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    pending_event JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_player_id ON contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_contracts_team_id ON contracts(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_id ON contracts(game_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_team_id ON contracts(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_player_id ON contracts(game_id, player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_game_player_unique
  ON contracts(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_user_status ON games(user_id, status);
CREATE INDEX IF NOT EXISTS idx_game_player_states_game_id ON game_player_states(game_id);
CREATE INDEX IF NOT EXISTS idx_game_player_states_game_team_id ON game_player_states(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_game_player_states_game_player_id ON game_player_states(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_historical_roster_templates_season_year ON historical_roster_templates(season_year);
CREATE INDEX IF NOT EXISTS idx_historical_roster_templates_team_id ON historical_roster_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_historical_contract_templates_season_year ON historical_contract_templates(season_year);
CREATE INDEX IF NOT EXISTS idx_historical_contract_templates_team_id ON historical_contract_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_career_saves_user_id ON career_saves(user_id);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_refresh_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_refresh_staging ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE roster_refresh_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE roster_refresh_staging FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS career_saves_all_owner ON career_saves; CREATE POLICY career_saves_all_owner
  ON career_saves
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Games owner policies
DROP POLICY IF EXISTS games_select_owner ON games;
CREATE POLICY games_select_owner
  ON games
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS games_insert_owner ON games;
CREATE POLICY games_insert_owner
  ON games
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS games_update_owner ON games;
CREATE POLICY games_update_owner
  ON games
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS games_delete_owner ON games;
CREATE POLICY games_delete_owner
  ON games
  FOR DELETE
  USING (user_id = auth.uid());

-- Game player states ownership-through-game policies
DROP POLICY IF EXISTS game_player_states_select_owner ON game_player_states;
CREATE POLICY game_player_states_select_owner
  ON game_player_states
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = game_player_states.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS game_player_states_insert_owner ON game_player_states;
CREATE POLICY game_player_states_insert_owner
  ON game_player_states
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = game_player_states.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS game_player_states_update_owner ON game_player_states;
CREATE POLICY game_player_states_update_owner
  ON game_player_states
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = game_player_states.game_id
        AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = game_player_states.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS game_player_states_delete_owner ON game_player_states;
CREATE POLICY game_player_states_delete_owner
  ON game_player_states
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = game_player_states.game_id
        AND g.user_id = auth.uid()
    )
  );

-- Contracts ownership-through-game policies
DROP POLICY IF EXISTS contracts_select_owner ON contracts;
CREATE POLICY contracts_select_owner
  ON contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = contracts.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contracts_insert_owner ON contracts;
CREATE POLICY contracts_insert_owner
  ON contracts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = contracts.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contracts_update_owner ON contracts;
CREATE POLICY contracts_update_owner
  ON contracts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = contracts.game_id
        AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = contracts.game_id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contracts_delete_owner ON contracts;
CREATE POLICY contracts_delete_owner
  ON contracts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM games g
      WHERE g.id = contracts.game_id
        AND g.user_id = auth.uid()
    )
  );

-- Static catalog tables: authenticated read-only
DROP POLICY IF EXISTS teams_read_authenticated ON teams;
CREATE POLICY teams_read_authenticated
  ON teams
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS players_read_authenticated ON players;
CREATE POLICY players_read_authenticated
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Snapshot source rosters and contracts once; retries never overwrite game-owned state.
CREATE OR REPLACE FUNCTION seed_game_data(p_game_id UUID, p_team_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_season_year INTEGER;
  v_has_historical_templates BOOLEAN;
  v_roster_count INTEGER;
  v_contract_count INTEGER;
BEGIN
  SELECT g.season_year INTO v_season_year
  FROM games g
  WHERE g.id = p_game_id
    AND g.selected_team_id = p_team_id
    AND g.user_id = auth.uid()
    AND g.status = 'initializing'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seed_game_data aborted: game is not initializing, not owned by the caller, or selected team does not match';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM historical_roster_templates WHERE season_year = v_season_year
  ) INTO v_has_historical_templates;
  IF v_season_year IN (2010, 1995) AND NOT v_has_historical_templates THEN
    RAISE EXCEPTION 'seed_game_data aborted: historical templates for season % are not loaded', v_season_year;
  END IF;

  IF v_has_historical_templates THEN
    INSERT INTO game_player_states (game_id, player_id, team_id, is_active)
    SELECT p_game_id, player_id, team_id, is_active
    FROM historical_roster_templates
    WHERE season_year = v_season_year
    ON CONFLICT (game_id, player_id) DO NOTHING;

    INSERT INTO contracts (
      game_id, player_id, team_id, start_year, end_year,
      salary_y1, salary_y2, salary_y3, salary_y4, salary_y5,
      is_player_option, is_team_option, is_guaranteed
    )
    SELECT
      p_game_id, player_id, team_id, start_year, end_year,
      salary_y1, salary_y2, salary_y3, salary_y4, salary_y5,
      is_player_option, is_team_option, is_guaranteed
    FROM historical_contract_templates
    WHERE season_year = v_season_year
    ON CONFLICT (game_id, player_id) DO NOTHING;
  ELSE
    INSERT INTO game_player_states (game_id, player_id, team_id)
    SELECT p_game_id, id, team_id FROM players WHERE team_id IS NOT NULL
    ON CONFLICT (game_id, player_id) DO NOTHING;

    INSERT INTO contracts (
      game_id, player_id, team_id, start_year, end_year,
      salary_y1, salary_y2, salary_y3, salary_y4, salary_y5,
      is_player_option, is_team_option, is_guaranteed
    )
    SELECT
      p_game_id, ranked.player_id, ranked.team_id, v_season_year, v_season_year + 4,
      ranked.salary, round(ranked.salary * 1.05), round(ranked.salary * 1.1025),
      round(ranked.salary * 1.157625), round(ranked.salary * 1.21550625),
      false, false, true
    FROM (
      SELECT
        p.id AS player_id,
        p.team_id,
        CASE
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) = 1 THEN 45000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 3 THEN 30000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 6 THEN 15000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 10 THEN 7000000
          ELSE 2000000
        END AS salary
      FROM players p
      WHERE p.team_id IS NOT NULL
    ) ranked
    ON CONFLICT (game_id, player_id) DO NOTHING;
  END IF;

  SELECT count(*) INTO v_roster_count FROM game_player_states WHERE game_id = p_game_id;
  SELECT count(*) INTO v_contract_count FROM contracts WHERE game_id = p_game_id;
  IF v_roster_count = 0 OR v_contract_count <> v_roster_count THEN
    RAISE EXCEPTION 'seed_game_data aborted: incomplete snapshot (% roster rows, % contracts)', v_roster_count, v_contract_count;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION seed_game_data(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_game_data(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION promote_current_roster(p_run_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected_team_count INTEGER;
  v_staged_team_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('current-roster', 0));
  SELECT expected_team_count INTO v_expected_team_count
  FROM roster_refresh_runs WHERE id = p_run_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Roster refresh run is missing or not pending'; END IF;
  SELECT count(DISTINCT team_id) INTO v_staged_team_count
  FROM roster_refresh_staging WHERE run_id = p_run_id;
  IF v_staged_team_count <> v_expected_team_count
     OR EXISTS (SELECT 1 FROM teams t WHERE NOT EXISTS (
       SELECT 1 FROM roster_refresh_staging s WHERE s.run_id = p_run_id AND s.team_id = t.id
     ))
     OR EXISTS (SELECT 1 FROM roster_refresh_staging s WHERE s.run_id = p_run_id
       AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = s.team_id)) THEN
    RAISE EXCEPTION 'Roster refresh run does not contain the complete team set';
  END IF;
  UPDATE players p
  SET espn_id = s.player_source_id, updated_at = now()
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn' AND p.espn_id IS NULL
    AND lower(p.full_name) = lower(s.payload->>'full_name');
  INSERT INTO players (
    espn_id, team_id, first_name, last_name, full_name, position,
    height, weight, jersey_number, is_active
  )
  SELECT
    s.player_source_id, s.team_id, s.payload->>'first_name', s.payload->>'last_name',
    s.payload->>'full_name', s.payload->>'position', s.payload->>'height',
    s.payload->>'weight', s.payload->>'jersey_number', true
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn'
    AND NOT EXISTS (SELECT 1 FROM players p WHERE p.espn_id = s.player_source_id);
  UPDATE players SET team_id = NULL, is_active = false, updated_at = now()
  WHERE team_id IS NOT NULL;
  UPDATE players p SET team_id = s.team_id, is_active = true, updated_at = now(),
    first_name = s.payload->>'first_name', last_name = s.payload->>'last_name',
    full_name = s.payload->>'full_name', position = s.payload->>'position',
    height = s.payload->>'height', weight = s.payload->>'weight',
    jersey_number = s.payload->>'jersey_number'
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn'
    AND p.espn_id = s.player_source_id;
  UPDATE roster_refresh_runs SET status = 'success', completed_team_count = v_staged_team_count,
    updated_at = now() WHERE id = p_run_id;
END;
$$;
REVOKE ALL ON FUNCTION promote_current_roster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_current_roster(UUID) TO service_role;

-- 8. Transaction assets and immutable trade history.
CREATE TABLE IF NOT EXISTS draft_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_year INTEGER NOT NULL,
    draft_round SMALLINT NOT NULL CHECK (draft_round IN (1, 2)),
    original_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    protection TEXT CHECK (protection IS NULL OR char_length(trim(protection)) > 0),
    UNIQUE (draft_year, draft_round, original_team_id)
);

ALTER TABLE draft_picks DROP CONSTRAINT IF EXISTS draft_picks_draft_year_check;
ALTER TABLE draft_picks ADD CONSTRAINT draft_picks_draft_year_check CHECK (draft_year >= 1947);

CREATE TABLE IF NOT EXISTS game_pick_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    draft_pick_id UUID REFERENCES draft_picks(id) ON DELETE RESTRICT NOT NULL,
    owner_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    is_transferable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (game_id, draft_pick_id)
);

CREATE TABLE IF NOT EXISTS executed_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE RESTRICT NOT NULL,
    team_a_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    team_b_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT executed_trades_distinct_teams CHECK (team_a_id <> team_b_id)
);

CREATE TABLE IF NOT EXISTS trade_asset_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_trade_id UUID REFERENCES executed_trades(id) ON DELETE RESTRICT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('player', 'pick')),
    asset_id UUID NOT NULL,
    from_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    to_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT trade_asset_snapshots_distinct_teams CHECK (from_team_id <> to_team_id)
);

CREATE INDEX IF NOT EXISTS idx_game_pick_inventory_game_owner
  ON game_pick_inventory(game_id, owner_team_id);
CREATE INDEX IF NOT EXISTS idx_executed_trades_game_executed_at
  ON executed_trades(game_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_asset_snapshots_trade
  ON trade_asset_snapshots(executed_trade_id);

ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_pick_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE executed_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_asset_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_picks_read_authenticated ON draft_picks;
CREATE POLICY draft_picks_read_authenticated ON draft_picks
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS game_pick_inventory_owner ON game_pick_inventory;
CREATE POLICY game_pick_inventory_owner ON game_pick_inventory
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = game_pick_inventory.game_id AND g.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS executed_trades_owner ON executed_trades;
CREATE POLICY executed_trades_owner ON executed_trades
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = executed_trades.game_id AND g.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS trade_asset_snapshots_owner ON trade_asset_snapshots;
CREATE POLICY trade_asset_snapshots_owner ON trade_asset_snapshots
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1
    FROM executed_trades t JOIN games g ON g.id = t.game_id
    WHERE t.id = trade_asset_snapshots.executed_trade_id AND g.user_id = auth.uid()
  ));

-- Seed every game from the canonical pick catalog. Re-running is intentionally harmless.
CREATE OR REPLACE FUNCTION seed_game_pick_inventory(p_game_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_season_year INTEGER;
BEGIN
  SELECT season_year INTO v_season_year FROM games
  WHERE id = p_game_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found or access denied';
  END IF;
  INSERT INTO draft_picks (draft_year, draft_round, original_team_id)
  SELECT y.draft_year, r.draft_round, t.id
  FROM generate_series(v_season_year, v_season_year + 6) AS y(draft_year)
  CROSS JOIN (VALUES (1), (2)) AS r(draft_round)
  CROSS JOIN teams t
  ON CONFLICT (draft_year, draft_round, original_team_id) DO NOTHING;
  INSERT INTO game_pick_inventory (game_id, draft_pick_id, owner_team_id)
  SELECT p_game_id, p.id, p.original_team_id FROM draft_picks p
  WHERE p.draft_year BETWEEN v_season_year AND v_season_year + 6
  ON CONFLICT (game_id, draft_pick_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION seed_game_pick_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_game_pick_inventory(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION seed_game_pick_inventory_after_game()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_season_year INTEGER;
BEGIN
  SELECT season_year INTO v_season_year FROM games WHERE id = NEW.id;
  INSERT INTO draft_picks (draft_year, draft_round, original_team_id)
  SELECT y.draft_year, r.draft_round, t.id
  FROM generate_series(v_season_year, v_season_year + 6) AS y(draft_year)
  CROSS JOIN (VALUES (1), (2)) AS r(draft_round)
  CROSS JOIN teams t
  ON CONFLICT (draft_year, draft_round, original_team_id) DO NOTHING;
  INSERT INTO game_pick_inventory (game_id, draft_pick_id, owner_team_id)
  SELECT NEW.id, p.id, p.original_team_id FROM draft_picks p
  WHERE p.draft_year BETWEEN v_season_year AND v_season_year + 6
  ON CONFLICT (game_id, draft_pick_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS games_seed_pick_inventory ON games;
CREATE TRIGGER games_seed_pick_inventory
  AFTER INSERT ON games FOR EACH ROW EXECUTE FUNCTION seed_game_pick_inventory_after_game();
REVOKE ALL ON FUNCTION seed_game_pick_inventory_after_game() FROM PUBLIC;

-- Canonical first- and second-round picks for every existing game's seven-season window.
-- This is deliberately small and idempotent; future draft modeling can extend it.
INSERT INTO draft_picks (draft_year, draft_round, original_team_id)
SELECT y.draft_year, r.draft_round, t.id
FROM (SELECT DISTINCT season_year FROM games) g
CROSS JOIN LATERAL generate_series(g.season_year, g.season_year + 6) AS y(draft_year)
CROSS JOIN (VALUES (1), (2)) AS r(draft_round)
CROSS JOIN teams t
ON CONFLICT (draft_year, draft_round, original_team_id) DO NOTHING;

INSERT INTO game_pick_inventory (game_id, draft_pick_id, owner_team_id)
SELECT g.id, p.id, p.original_team_id
FROM games g
JOIN draft_picks p ON p.draft_year BETWEEN g.season_year AND g.season_year + 6
ON CONFLICT (game_id, draft_pick_id) DO NOTHING;

-- Trusted boundary: all ownership checks and writes happen under one row-locked transaction.
CREATE OR REPLACE FUNCTION execute_trade_transactional(
  p_game_id UUID,
  p_team_a_id UUID,
  p_team_b_id UUID,
  p_assets JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trade_id UUID;
  v_asset JSONB;
  v_type TEXT;
  v_id UUID;
  v_from UUID;
  v_to UUID;
  v_pick game_pick_inventory%ROWTYPE;
  v_state game_player_states%ROWTYPE;
  v_metadata JSONB;
  v_contract contracts%ROWTYPE;
  v_contract_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND user_id = auth.uid())
    OR p_team_a_id = p_team_b_id THEN
    RAISE EXCEPTION 'Game or participating teams are invalid';
  END IF;
  IF jsonb_typeof(p_assets) <> 'array' OR jsonb_array_length(p_assets) < 2 THEN
    RAISE EXCEPTION 'A trade requires assets from both teams';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assets) a WHERE NOT (a ? 'asset_type' AND a ? 'asset_id' AND a ? 'from_team_id'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_assets) a WHERE a->>'from_team_id' = p_team_a_id::TEXT) = 0
    OR (SELECT count(*) FROM jsonb_array_elements(p_assets) a WHERE a->>'from_team_id' = p_team_b_id::TEXT) = 0 THEN
    RAISE EXCEPTION 'Each team must send at least one asset';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_assets) a) <> (
    SELECT count(DISTINCT (a->>'asset_type') || ':' || (a->>'asset_id')) FROM jsonb_array_elements(p_assets) a
  ) THEN
    RAISE EXCEPTION 'Duplicate trade asset';
  END IF;

  INSERT INTO executed_trades (game_id, team_a_id, team_b_id)
  VALUES (p_game_id, p_team_a_id, p_team_b_id) RETURNING id INTO v_trade_id;

  FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets) LOOP
    v_type := v_asset->>'asset_type';
    v_id := (v_asset->>'asset_id')::UUID;
    v_from := (v_asset->>'from_team_id')::UUID;
    v_to := CASE WHEN v_from = p_team_a_id THEN p_team_b_id ELSE p_team_a_id END;
    IF v_from NOT IN (p_team_a_id, p_team_b_id) OR v_type NOT IN ('player', 'pick') THEN
      RAISE EXCEPTION 'Asset does not belong to this trade';
    END IF;
    IF v_type = 'player' THEN
      SELECT * INTO v_state FROM game_player_states
      WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE;
      IF NOT FOUND OR v_state.team_id IS DISTINCT FROM v_from THEN
        RAISE EXCEPTION 'Player ownership is stale or invalid';
      END IF;
      SELECT count(*) INTO v_contract_count FROM contracts
      WHERE game_id = p_game_id AND player_id = v_id;
      IF v_contract_count = 0 THEN
        RAISE EXCEPTION 'Player contract is missing';
      END IF;
      FOR v_contract IN SELECT * FROM contracts
        WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE LOOP
        IF v_contract.team_id IS DISTINCT FROM v_from THEN
          RAISE EXCEPTION 'Player contract ownership is stale or invalid';
        END IF;
      END LOOP;
      UPDATE game_player_states SET team_id = v_to, updated_at = now() WHERE id = v_state.id;
      UPDATE contracts SET team_id = v_to, updated_at = now()
      WHERE game_id = p_game_id AND player_id = v_id AND team_id = v_from;
      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> v_contract_count THEN
        RAISE EXCEPTION 'Player contract transfer was incomplete';
      END IF;
      v_metadata := jsonb_build_object('player_id', v_id);
    ELSE
      SELECT * INTO v_pick FROM game_pick_inventory
      WHERE game_id = p_game_id AND id = v_id FOR UPDATE;
      IF NOT FOUND OR v_pick.owner_team_id IS DISTINCT FROM v_from OR NOT v_pick.is_transferable THEN
        RAISE EXCEPTION 'Draft pick ownership is stale or invalid';
      END IF;
      SELECT jsonb_build_object('pick_id', p.id, 'draft_year', p.draft_year,
        'draft_round', p.draft_round, 'protection', p.protection,
        'original_team_id', p.original_team_id)
      INTO v_metadata FROM draft_picks p WHERE p.id = v_pick.draft_pick_id;
      UPDATE game_pick_inventory SET owner_team_id = v_to, updated_at = now() WHERE id = v_pick.id;
    END IF;
    INSERT INTO trade_asset_snapshots (executed_trade_id, asset_type, asset_id, from_team_id, to_team_id, metadata)
    VALUES (v_trade_id, v_type, v_id, v_from, v_to, coalesce(v_metadata, '{}'::jsonb));
  END LOOP;
  RETURN v_trade_id;
END;
$$;
REVOKE ALL ON FUNCTION execute_trade_transactional(UUID, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_trade_transactional(UUID, UUID, UUID, JSONB) TO authenticated;

-- 9. Season simulation schedule, standings, and atomic day advancement.
-- Keep this block synchronized with migrations/009_season_simulation.sql.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS base_rating SMALLINT NOT NULL DEFAULT 75;
CREATE TABLE IF NOT EXISTS scheduled_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_date DATE NOT NULL, home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
  home_score SMALLINT, away_score SMALLINT, winner_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (game_id, game_date, home_team_id, away_team_id)
);
CREATE TABLE IF NOT EXISTS league_standings (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE, team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0), losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0), PRIMARY KEY (game_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_scheduled_games_next ON scheduled_games(game_id, game_date, status);
CREATE INDEX IF NOT EXISTS idx_league_standings_game ON league_standings(game_id, wins DESC, losses ASC);
ALTER TABLE scheduled_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_games_owner ON scheduled_games;
CREATE POLICY scheduled_games_owner ON scheduled_games FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM games g WHERE g.id = scheduled_games.game_id AND g.user_id = auth.uid()));
DROP POLICY IF EXISTS league_standings_owner ON league_standings;
CREATE POLICY league_standings_owner ON league_standings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM games g WHERE g.id = league_standings.game_id AND g.user_id = auth.uid()));

DROP FUNCTION IF EXISTS advance_simulation_day(UUID);
CREATE OR REPLACE FUNCTION initialize_game_schedule(p_game_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  WITH teams_ordered AS (SELECT id, row_number() OVER (ORDER BY nba_id) - 1 AS slot FROM teams),
  rounds AS (SELECT c, r, 0 AS home_slot, 1 + r % 29 AS away_slot FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r)
    UNION ALL SELECT c, r, 1 + (r + k) % 29, 1 + (r - k + 29) % 29 FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r) CROSS JOIN generate_series(1, 14) AS pairs(k))
  INSERT INTO scheduled_games (game_id, game_date, home_team_id, away_team_id)
  SELECT p_game_id, v_game.simulation_date + 1 + (((c * 29 + r) * (make_date(v_game.season_year + 1, 4, 15) - v_game.simulation_date - 1) / 57)::INTEGER), home.id, away.id
  FROM rounds
  JOIN teams_ordered home ON home.slot = CASE WHEN c = 0 THEN home_slot ELSE away_slot END
  JOIN teams_ordered away ON away.slot = CASE WHEN c = 0 THEN away_slot ELSE home_slot END
  ON CONFLICT DO NOTHING;
  INSERT INTO league_standings (game_id, team_id) SELECT p_game_id, id FROM teams ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION initialize_game_schedule(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION initialize_game_schedule(UUID) TO authenticated;
CREATE OR REPLACE FUNCTION advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (new_date DATE, season_complete BOOLEAN, result_id UUID, home_team_id UUID, away_team_id UUID, home_score SMALLINT, away_score SMALLINT, winner_team_id UUID, standing_team_id UUID, wins INTEGER, losses INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game games%ROWTYPE; v_new_date DATE; v_match scheduled_games%ROWTYPE; v_home_rating SMALLINT; v_away_rating SMALLINT; v_home_score SMALLINT; v_away_score SMALLINT; v_winner UUID; v_seed BIGINT; v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF v_game.simulation_date IS DISTINCT FROM p_expected_date THEN
    new_date := v_game.simulation_date;
    season_complete := v_game.simulation_date >= make_date(v_game.season_year + 1, 4, 15);
    RETURN NEXT;
    RETURN;
  END IF;
  v_new_date := v_game.simulation_date + 1;
  IF v_new_date > make_date(v_game.season_year + 1, 4, 15) THEN new_date := v_game.simulation_date; season_complete := true; RETURN NEXT; RETURN; END IF;
   IF NOT EXISTS (SELECT 1 FROM scheduled_games WHERE game_id = p_game_id) THEN
     PERFORM initialize_game_schedule(p_game_id);
  END IF;
  FOR v_match IN SELECT * FROM scheduled_games WHERE game_id = p_game_id AND game_date = v_new_date AND status = 'scheduled' FOR UPDATE LOOP
    SELECT base_rating INTO v_home_rating FROM teams WHERE id = v_match.home_team_id; SELECT base_rating INTO v_away_rating FROM teams WHERE id = v_match.away_team_id;
    v_seed := ('x' || substr(md5(p_game_id::TEXT || ':' || v_new_date::TEXT || ':' || v_match.home_team_id::TEXT || ':' || v_match.away_team_id::TEXT), 1, 8))::bit(32)::bigint;
    v_home_score := greatest(70, round(105 + (v_home_rating + 3 - 75) * 0.55 + (mod(abs(v_seed), 2400) / 100.0 - 12))); v_away_score := greatest(70, round(105 + (v_away_rating - 75) * 0.55 + (mod(abs(v_seed / 2400), 2400) / 100.0 - 12)));
    IF v_home_score = v_away_score THEN v_away_score := v_away_score - 1; END IF; v_winner := CASE WHEN v_home_score > v_away_score THEN v_match.home_team_id ELSE v_match.away_team_id END;
    UPDATE scheduled_games SET status = 'completed', home_score = v_home_score, away_score = v_away_score, winner_team_id = v_winner WHERE id = v_match.id;
    UPDATE league_standings SET wins = league_standings.wins + CASE WHEN team_id = v_winner THEN 1 ELSE 0 END, losses = league_standings.losses + CASE WHEN team_id <> v_winner AND team_id IN (v_match.home_team_id, v_match.away_team_id) THEN 1 ELSE 0 END WHERE game_id = p_game_id AND team_id IN (v_match.home_team_id, v_match.away_team_id);
    new_date := v_new_date; season_complete := false; result_id := v_match.id; home_team_id := v_match.home_team_id; away_team_id := v_match.away_team_id; home_score := v_home_score; away_score := v_away_score; winner_team_id := v_winner; standing_team_id := NULL; wins := NULL; losses := NULL; v_count := v_count + 1; RETURN NEXT;
  END LOOP;
  UPDATE games SET simulation_date = v_new_date, updated_at = now() WHERE id = p_game_id;
  IF v_count = 0 THEN new_date := v_new_date; season_complete := false; RETURN NEXT; END IF;
END;
$$;
REVOKE ALL ON FUNCTION advance_simulation_day(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_simulation_day(UUID, DATE) TO authenticated;
