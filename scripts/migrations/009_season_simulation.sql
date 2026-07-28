BEGIN;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS base_rating SMALLINT NOT NULL DEFAULT 75;
UPDATE teams SET base_rating = 65 + mod(nba_id, 31) WHERE base_rating = 75;

CREATE TABLE IF NOT EXISTS scheduled_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  home_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
  home_score SMALLINT,
  away_score SMALLINT,
  winner_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_games_unique_matchup UNIQUE (game_id, game_date, home_team_id, away_team_id)
);

CREATE TABLE IF NOT EXISTS league_standings (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  PRIMARY KEY (game_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_games_next ON scheduled_games(game_id, game_date, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_games_team ON scheduled_games(game_id, home_team_id, away_team_id, game_date);
CREATE INDEX IF NOT EXISTS idx_league_standings_game ON league_standings(game_id, wins DESC, losses ASC);

ALTER TABLE scheduled_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_games_owner ON scheduled_games;
CREATE POLICY scheduled_games_owner ON scheduled_games FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = scheduled_games.game_id AND g.user_id = auth.uid()));

DROP POLICY IF EXISTS league_standings_owner ON league_standings;
CREATE POLICY league_standings_owner ON league_standings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = league_standings.game_id AND g.user_id = auth.uid()));

DROP FUNCTION IF EXISTS advance_simulation_day(UUID);

CREATE OR REPLACE FUNCTION advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (
  new_date DATE,
  season_complete BOOLEAN,
  result_id UUID,
  home_team_id UUID,
  away_team_id UUID,
  home_score SMALLINT,
  away_score SMALLINT,
  winner_team_id UUID,
  standing_team_id UUID,
  wins INTEGER,
  losses INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
  v_new_date DATE;
  v_match scheduled_games%ROWTYPE;
  v_home_rating SMALLINT;
  v_away_rating SMALLINT;
  v_home_score SMALLINT;
  v_away_score SMALLINT;
  v_winner UUID;
  v_seed BIGINT;
  v_count INTEGER := 0;
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
  IF v_new_date > make_date(v_game.season_year + 1, 4, 15) THEN
    new_date := v_game.simulation_date; season_complete := true; RETURN NEXT; RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM scheduled_games WHERE game_id = p_game_id) THEN
    WITH teams_ordered AS (SELECT id, row_number() OVER (ORDER BY nba_id) - 1 AS slot FROM teams),
    rounds AS (SELECT c, r, 0 AS home_slot, 1 + r % 29 AS away_slot FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r)
      UNION ALL SELECT c, r, 1 + (r + k) % 29, 1 + (r - k + 29) % 29 FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r) CROSS JOIN generate_series(1, 14) AS pairs(k))
    INSERT INTO scheduled_games (game_id, game_date, home_team_id, away_team_id)
    SELECT p_game_id, make_date(v_game.season_year, 10, 15) + (((c * 29 + r) * 182 / 57)::INTEGER),
      home.id, away.id
    FROM rounds
    JOIN teams_ordered home ON home.slot = CASE WHEN c = 0 THEN home_slot ELSE away_slot END
    JOIN teams_ordered away ON away.slot = CASE WHEN c = 0 THEN away_slot ELSE home_slot END;
    INSERT INTO league_standings (game_id, team_id)
    SELECT p_game_id, id FROM teams ON CONFLICT DO NOTHING;
  END IF;

  FOR v_match IN SELECT * FROM scheduled_games WHERE game_id = p_game_id AND game_date = v_new_date AND status = 'scheduled' FOR UPDATE LOOP
    SELECT base_rating INTO v_home_rating FROM teams WHERE id = v_match.home_team_id;
    SELECT base_rating INTO v_away_rating FROM teams WHERE id = v_match.away_team_id;
    v_seed := ('x' || substr(md5(p_game_id::TEXT || ':' || v_new_date::TEXT || ':' || v_match.home_team_id::TEXT || ':' || v_match.away_team_id::TEXT), 1, 8))::bit(32)::bigint;
    v_home_score := greatest(70, round(105 + (v_home_rating + 3 - 75) * 0.55 + (mod(abs(v_seed), 2400) / 100.0 - 12)));
    v_away_score := greatest(70, round(105 + (v_away_rating - 75) * 0.55 + (mod(abs(v_seed / 2400), 2400) / 100.0 - 12)));
    IF v_home_score = v_away_score THEN v_away_score := v_away_score - 1; END IF;
    v_winner := CASE WHEN v_home_score > v_away_score THEN v_match.home_team_id ELSE v_match.away_team_id END;

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
COMMIT;
