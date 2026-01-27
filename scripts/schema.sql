-- NBA GM Simulator: "The Association"
-- Initial SQL Schema

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_player_id ON contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_contracts_team_id ON contracts(team_id);
