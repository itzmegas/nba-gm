BEGIN;

CREATE OR REPLACE FUNCTION initialize_game_schedule(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;

  WITH teams_ordered AS (SELECT id, row_number() OVER (ORDER BY nba_id) - 1 AS slot FROM teams),
  rounds AS (SELECT c, r, 0 AS home_slot, 1 + r % 29 AS away_slot FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r)
    UNION ALL SELECT c, r, 1 + (r + k) % 29, 1 + (r - k + 29) % 29 FROM generate_series(0, 1) AS cycles(c) CROSS JOIN generate_series(0, 28) AS round_values(r) CROSS JOIN generate_series(1, 14) AS pairs(k))
  INSERT INTO scheduled_games (game_id, game_date, home_team_id, away_team_id)
  SELECT p_game_id, v_game.simulation_date + 1 + (((c * 29 + r) * (make_date(v_game.season_year + 1, 4, 15) - v_game.simulation_date - 1) / 57)::INTEGER),
    home.id, away.id
  FROM rounds
  JOIN teams_ordered home ON home.slot = CASE WHEN c = 0 THEN home_slot ELSE away_slot END
  JOIN teams_ordered away ON away.slot = CASE WHEN c = 0 THEN away_slot ELSE home_slot END
  ON CONFLICT DO NOTHING;

  INSERT INTO league_standings (game_id, team_id)
  SELECT p_game_id, id FROM teams ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION initialize_game_schedule(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION initialize_game_schedule(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (
  new_date DATE, season_complete BOOLEAN, result_id UUID, home_team_id UUID,
  away_team_id UUID, home_score SMALLINT, away_score SMALLINT, winner_team_id UUID,
  standing_team_id UUID, wins INTEGER, losses INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE; v_new_date DATE; v_match scheduled_games%ROWTYPE;
  v_home_rating SMALLINT; v_away_rating SMALLINT; v_home_score SMALLINT;
  v_away_score SMALLINT; v_winner UUID; v_seed BIGINT; v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF v_game.simulation_date IS DISTINCT FROM p_expected_date THEN
    new_date := v_game.simulation_date; season_complete := v_game.simulation_date >= make_date(v_game.season_year + 1, 4, 15); RETURN NEXT; RETURN;
  END IF;
  v_new_date := v_game.simulation_date + 1;
  IF v_new_date > make_date(v_game.season_year + 1, 4, 15) THEN new_date := v_game.simulation_date; season_complete := true; RETURN NEXT; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM scheduled_games WHERE game_id = p_game_id) THEN PERFORM initialize_game_schedule(p_game_id); END IF;
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
