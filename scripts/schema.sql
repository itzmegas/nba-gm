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
    nba_id INTEGER UNIQUE NOT NULL, -- Official NBA ID from API
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
    game_id UUID,
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

-- 7. Historical template tables
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_player_id ON contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_contracts_team_id ON contracts(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_id ON contracts(game_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_team_id ON contracts(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_game_player_id ON contracts(game_id, player_id);
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

-- RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_player_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

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
