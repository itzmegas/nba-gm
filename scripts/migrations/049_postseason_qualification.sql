BEGIN;

CREATE TABLE public.postseason_qualifications (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  conference TEXT NOT NULL CHECK (conference IN ('East', 'West')),
  seed INTEGER NOT NULL CHECK (seed BETWEEN 1 AND 15),
  wins INTEGER NOT NULL CHECK (wins >= 0),
  losses INTEGER NOT NULL CHECK (losses >= 0),
  draw_order INTEGER NOT NULL CHECK (draw_order BETWEEN 1 AND 30),
  PRIMARY KEY (game_id, season_year, team_id),
  UNIQUE (game_id, season_year, conference, seed),
  UNIQUE (game_id, season_year, draw_order)
);
ALTER TABLE public.postseason_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY postseason_qualifications_owner ON public.postseason_qualifications
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
      AND g.deleted_at IS NULL
  ));
REVOKE ALL ON public.postseason_qualifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.postseason_qualifications TO authenticated;

-- SQL counterpart of qualifyPostseason; parity is tested against the domain service.
CREATE FUNCTION public.rank_postseason_group(p_group JSONB, p_results JSONB, p_criterion INTEGER DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE partitions JSONB; part JSONB; ranked JSONB := '[]';
BEGIN
  IF jsonb_array_length(p_group) < 2 THEN RETURN p_group; END IF;
  IF p_criterion > 4 THEN RAISE EXCEPTION 'Qualification lottery must be unique'; END IF;
  WITH metrics AS (
    SELECT t, CASE p_criterion
      WHEN 0 THEN (t->>'wins')::BIGINT
      WHEN 1 THEN (SELECT count(*) FROM jsonb_array_elements(p_results) r
        WHERE r->>'teamId' = t->>'teamId' AND (r->>'won')::BOOLEAN
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_group) o WHERE o->>'teamId' = r->>'opponentId'))
      WHEN 2 THEN (t->>'conferenceWins')::BIGINT
      WHEN 3 THEN (t->>'differential')::BIGINT
      ELSE -(t->>'drawOrder')::BIGINT END AS n,
      greatest(1, CASE p_criterion
        WHEN 0 THEN (t->>'wins')::BIGINT + (t->>'losses')::BIGINT
        WHEN 1 THEN (SELECT count(*) FROM jsonb_array_elements(p_results) r
          WHERE r->>'teamId' = t->>'teamId'
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_group) o WHERE o->>'teamId' = r->>'opponentId'))
        WHEN 2 THEN (t->>'conferenceGames')::BIGINT ELSE 1 END) AS d
    FROM jsonb_array_elements(p_group) t
  ), ordered AS (
    SELECT a.t, (SELECT count(*) FROM metrics b WHERE b.n * a.d > a.n * b.d) AS position
    FROM metrics a
  ), groups AS (
    SELECT position, jsonb_agg(t ORDER BY t->>'teamId') AS members FROM ordered GROUP BY position
  ) SELECT jsonb_agg(members ORDER BY position) INTO partitions FROM groups;
  IF jsonb_array_length(partitions) = 1 THEN
    RETURN public.rank_postseason_group(p_group, p_results, p_criterion + 1);
  END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(partitions) LOOP
    ranked := ranked || public.rank_postseason_group(part, p_results, 1);
  END LOOP;
  RETURN ranked;
END;
$$;
REVOKE ALL ON FUNCTION public.rank_postseason_group(JSONB, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.freeze_postseason_qualification(p_game_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; participants JSONB; results JSONB; conf TEXT; ranked JSONB;
BEGIN
  SELECT * INTO STRICT g FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.postseason_qualifications q
    WHERE q.game_id = g.id AND q.season_year = g.season_year) THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.scheduled_games f WHERE f.game_id = g.id
      AND f.season_year = g.season_year AND f.competition_phase = 'regular_season')
    OR EXISTS (SELECT 1 FROM public.scheduled_games f WHERE f.game_id = g.id
      AND f.season_year = g.season_year AND f.competition_phase = 'regular_season'
      AND f.status <> 'completed') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.scheduled_games f WHERE f.game_id = g.id
    AND f.season_year = g.season_year AND f.competition_phase = 'regular_season'
    AND (f.game_date > g.simulation_date OR f.home_score IS NULL OR f.away_score IS NULL
      OR f.home_score = f.away_score OR f.winner_team_id IS DISTINCT FROM
        CASE WHEN f.home_score > f.away_score THEN f.home_team_id ELSE f.away_team_id END))
  THEN RAISE EXCEPTION 'Regular-season results are incomplete or inconsistent'; END IF;
  IF (SELECT count(*) FROM public.league_standings s JOIN public.teams t ON t.id = s.team_id
    WHERE s.game_id = g.id) <> 30
    OR EXISTS (SELECT 1 FROM public.league_standings s JOIN public.teams t ON t.id = s.team_id
      WHERE s.game_id = g.id AND (t.conference IS NULL OR t.conference NOT IN ('East', 'West')))
    OR (SELECT count(*) FROM public.league_standings s JOIN public.teams t ON t.id = s.team_id
      WHERE s.game_id = g.id AND t.conference = 'East') <> 15
  THEN RAISE EXCEPTION 'Qualification requires 15 teams in each conference'; END IF;

  WITH appearances AS (
    SELECT f.home_team_id AS team_id, f.away_team_id AS opponent_id,
      f.home_score > f.away_score AS won, f.home_score - f.away_score AS differential
    FROM public.scheduled_games f WHERE f.game_id = g.id AND f.season_year = g.season_year
      AND f.competition_phase = 'regular_season'
    UNION ALL
    SELECT f.away_team_id, f.home_team_id, f.away_score > f.home_score, f.away_score - f.home_score
    FROM public.scheduled_games f WHERE f.game_id = g.id AND f.season_year = g.season_year
      AND f.competition_phase = 'regular_season'
  ), records AS (
    SELECT s.team_id, t.conference, s.wins, s.losses,
      row_number() OVER (ORDER BY md5(g.id::TEXT || ':' || g.season_year || ':' || s.team_id), s.team_id) AS draw_order,
      count(a.team_id) AS games, count(*) FILTER (WHERE a.won) AS actual_wins,
      count(*) FILTER (WHERE a.won AND opponent.conference = t.conference) AS conference_wins,
      count(*) FILTER (WHERE opponent.conference = t.conference) AS conference_games,
      coalesce(sum(a.differential), 0) AS differential
    FROM public.league_standings s JOIN public.teams t ON t.id = s.team_id
    LEFT JOIN appearances a ON a.team_id = s.team_id
    LEFT JOIN public.teams opponent ON opponent.id = a.opponent_id
    WHERE s.game_id = g.id GROUP BY s.team_id, t.conference, s.wins, s.losses
  ) SELECT (SELECT coalesce(jsonb_agg(jsonb_build_object('teamId', team_id,
      'opponentId', opponent_id, 'won', won)), '[]') FROM appearances),
    jsonb_agg(jsonb_build_object('teamId', team_id, 'conference', conference,
      'wins', wins, 'losses', losses, 'drawOrder', draw_order,
      'conferenceWins', conference_wins, 'conferenceGames', conference_games,
      'differential', differential, 'games', games, 'actualWins', actual_wins))
    INTO results, participants FROM records;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(participants) t
    WHERE (t->>'wins')::INTEGER <> (t->>'actualWins')::INTEGER
      OR (t->>'wins')::INTEGER + (t->>'losses')::INTEGER <> (t->>'games')::INTEGER)
  THEN RAISE EXCEPTION 'Standings do not match stored regular-season results'; END IF;

  FOREACH conf IN ARRAY ARRAY['East', 'West'] LOOP
    SELECT public.rank_postseason_group(jsonb_agg(t), results) INTO ranked
      FROM jsonb_array_elements(participants) t WHERE t->>'conference' = conf;
    INSERT INTO public.postseason_qualifications(game_id, season_year, team_id, conference, seed, wins, losses, draw_order)
    SELECT g.id, g.season_year, (t->>'teamId')::UUID, conf, position,
      (t->>'wins')::INTEGER, (t->>'losses')::INTEGER, (t->>'drawOrder')::INTEGER
    FROM jsonb_array_elements(ranked) WITH ORDINALITY AS ranked_teams(t, position);
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.freeze_postseason_qualification(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

-- Keep the existing sports/market transaction; freeze only after its complete result.
ALTER FUNCTION public.advance_simulation_day(UUID, DATE) RENAME TO advance_regular_season_day;
REVOKE ALL ON FUNCTION public.advance_regular_season_day(UUID, DATE)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (
  new_date DATE, season_complete BOOLEAN, result_id UUID, home_team_id UUID,
  away_team_id UUID, home_score SMALLINT, away_score SMALLINT, winner_team_id UUID,
  standing_team_id UUID, wins INTEGER, losses INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; r RECORD; closed BOOLEAN; checked BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF g.simulation_date IS DISTINCT FROM p_expected_date THEN
    new_date := g.simulation_date;
    season_complete := EXISTS (SELECT 1 FROM public.postseason_qualifications q
      WHERE q.game_id = g.id AND q.season_year = g.season_year);
    RETURN NEXT; RETURN;
  END IF;
  IF public.freeze_postseason_qualification(g.id) THEN
    new_date := g.simulation_date; season_complete := true; RETURN NEXT; RETURN;
  END IF;
  IF g.simulation_date >= make_date(g.season_year + 1, 4, 15) THEN
    RAISE EXCEPTION 'Regular-season schedule is incomplete at the simulation boundary';
  END IF;
  FOR r IN SELECT * FROM public.advance_regular_season_day(p_game_id, p_expected_date) LOOP
    IF NOT checked THEN
      closed := public.freeze_postseason_qualification(g.id);
      checked := true;
    END IF;
    RETURN QUERY SELECT r.new_date, closed, r.result_id, r.home_team_id, r.away_team_id,
      r.home_score, r.away_score, r.winner_team_id, r.standing_team_id, r.wins, r.losses;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_simulation_day(UUID, DATE) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advance_simulation_day(UUID, DATE) TO authenticated;

COMMIT;
