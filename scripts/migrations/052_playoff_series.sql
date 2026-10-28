BEGIN;

CREATE TABLE public.postseason_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 4),
  conference TEXT NOT NULL CHECK (conference IN ('East', 'West', 'Finals')),
  bracket_slot INTEGER NOT NULL CHECK (bracket_slot BETWEEN 1 AND 4),
  home_team_id UUID NOT NULL,
  away_team_id UUID NOT NULL,
  home_wins INTEGER NOT NULL DEFAULT 0 CHECK (home_wins BETWEEN 0 AND 4),
  away_wins INTEGER NOT NULL DEFAULT 0 CHECK (away_wins BETWEEN 0 AND 4),
  winner_team_id UUID,
  UNIQUE (game_id, id),
  UNIQUE (game_id, season_year, round, conference, bracket_slot),
  FOREIGN KEY (game_id, season_year, home_team_id)
    REFERENCES public.postseason_playoff_seeds(game_id, season_year, team_id),
  FOREIGN KEY (game_id, season_year, away_team_id)
    REFERENCES public.postseason_playoff_seeds(game_id, season_year, team_id),
  CHECK (home_team_id <> away_team_id),
  CHECK ((round = 4 AND conference = 'Finals' AND bracket_slot = 1)
    OR (round < 4 AND conference <> 'Finals' AND bracket_slot <= power(2, 3 - round))),
  CHECK ((winner_team_id IS NULL AND home_wins < 4 AND away_wins < 4)
    OR (winner_team_id IS NOT NULL AND winner_team_id = home_team_id AND home_wins = 4 AND away_wins < 4)
    OR (winner_team_id IS NOT NULL AND winner_team_id = away_team_id AND away_wins = 4 AND home_wins < 4))
);
CREATE TABLE public.postseason_series_games (
  game_id UUID NOT NULL,
  series_id UUID NOT NULL,
  game_number INTEGER NOT NULL CHECK (game_number BETWEEN 1 AND 7),
  scheduled_game_id UUID NOT NULL UNIQUE,
  PRIMARY KEY (series_id, game_number),
  FOREIGN KEY (game_id, series_id) REFERENCES public.postseason_series(game_id, id) ON DELETE CASCADE,
  FOREIGN KEY (game_id, scheduled_game_id) REFERENCES public.scheduled_games(game_id, id) ON DELETE CASCADE
);
CREATE TABLE public.postseason_results (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  finals_series_id UUID NOT NULL,
  champion_team_id UUID NOT NULL,
  runner_up_team_id UUID NOT NULL,
  completed_on DATE NOT NULL,
  PRIMARY KEY (game_id, season_year),
  FOREIGN KEY (game_id, finals_series_id) REFERENCES public.postseason_series(game_id, id),
  FOREIGN KEY (game_id, season_year, champion_team_id)
    REFERENCES public.postseason_playoff_seeds(game_id, season_year, team_id),
  FOREIGN KEY (game_id, season_year, runner_up_team_id)
    REFERENCES public.postseason_playoff_seeds(game_id, season_year, team_id),
  CHECK (champion_team_id <> runner_up_team_id)
);
ALTER TABLE public.postseason_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postseason_series_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postseason_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY series_owner ON public.postseason_series FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
CREATE POLICY series_games_owner ON public.postseason_series_games FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
CREATE POLICY postseason_results_owner ON public.postseason_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
REVOKE ALL ON public.postseason_series, public.postseason_series_games, public.postseason_results
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.postseason_series, public.postseason_series_games, public.postseason_results TO authenticated;

CREATE FUNCTION public.prepare_playoffs(p_game_id UUID) RETURNS VOID
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; s public.postseason_series%ROWTYPE;
  r INTEGER; conf TEXT; slot INTEGER; home_id UUID; away_id UUID; candidate UUID[];
  seed_a INTEGER; seed_b INTEGER; hw INTEGER; aw INTEGER; n INTEGER;
  fixture_id UUID; last_date DATE; round_end DATE;
BEGIN
  SELECT * INTO STRICT g FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF (SELECT count(*) FROM public.postseason_playoff_seeds p
    WHERE p.game_id = g.id AND p.season_year = g.season_year) <> 16 THEN RETURN; END IF;

  FOR s IN SELECT * FROM public.postseason_series p
    WHERE p.game_id = g.id AND p.season_year = g.season_year AND p.winner_team_id IS NULL
  LOOP
    SELECT count(*) FILTER (WHERE f.winner_team_id = s.home_team_id),
      count(*) FILTER (WHERE f.winner_team_id = s.away_team_id) INTO hw, aw
      FROM public.postseason_series_games link JOIN public.scheduled_games f ON f.id = link.scheduled_game_id
      WHERE link.series_id = s.id AND f.status = 'completed';
    UPDATE public.postseason_series SET home_wins = hw, away_wins = aw,
      winner_team_id = CASE WHEN hw = 4 THEN s.home_team_id WHEN aw = 4 THEN s.away_team_id END
      WHERE id = s.id;
  END LOOP;

  FOR r IN 1..4 LOOP
    IF r > 1 AND (SELECT count(*) FROM public.postseason_series p WHERE p.game_id = g.id
      AND p.season_year = g.season_year AND p.round = r - 1 AND p.winner_team_id IS NOT NULL)
      <> power(2, 5 - r) THEN EXIT; END IF;
    FOREACH conf IN ARRAY CASE WHEN r = 4 THEN ARRAY['Finals'] ELSE ARRAY['East', 'West'] END LOOP
      FOR slot IN 1..CASE WHEN r = 4 THEN 1 ELSE power(2, 3 - r)::INTEGER END LOOP
        IF EXISTS (SELECT 1 FROM public.postseason_series p WHERE p.game_id = g.id
          AND p.season_year = g.season_year AND p.round = r AND p.conference = conf AND p.bracket_slot = slot)
          THEN CONTINUE; END IF;
        IF r = 1 THEN
          seed_a := (ARRAY[1,4,2,3])[slot]; seed_b := 9 - seed_a;
          SELECT p.team_id INTO STRICT home_id FROM public.postseason_playoff_seeds p
            WHERE p.game_id = g.id AND p.season_year = g.season_year AND p.conference = conf AND p.seed = seed_a;
          SELECT p.team_id INTO STRICT away_id FROM public.postseason_playoff_seeds p
            WHERE p.game_id = g.id AND p.season_year = g.season_year AND p.conference = conf AND p.seed = seed_b;
        ELSE
          SELECT array_agg(p.winner_team_id ORDER BY p.conference, p.bracket_slot) INTO candidate
            FROM public.postseason_series p WHERE p.game_id = g.id AND p.season_year = g.season_year
            AND p.round = r - 1 AND (r = 4 OR (p.conference = conf AND p.bracket_slot IN (slot * 2 - 1, slot * 2)));
          IF r < 4 THEN
            SELECT array_agg(p.team_id ORDER BY p.seed) INTO candidate FROM public.postseason_playoff_seeds p
              WHERE p.game_id = g.id AND p.season_year = g.season_year AND p.team_id = ANY(candidate);
          ELSE
            -- Finals use regular-season record, head-to-head, differential, then frozen lottery order.
            SELECT array_agg(q.team_id ORDER BY
              coalesce(q.wins::NUMERIC / nullif(q.wins + q.losses, 0), 0) DESC,
              (SELECT count(*) FROM public.scheduled_games f WHERE f.game_id = g.id AND f.season_year = g.season_year
                AND f.competition_phase = 'regular_season' AND f.status = 'completed' AND f.winner_team_id = q.team_id
                AND f.home_team_id = ANY(candidate) AND f.away_team_id = ANY(candidate)) DESC,
              (SELECT coalesce(sum(CASE WHEN f.home_team_id = q.team_id THEN f.home_score - f.away_score
                ELSE f.away_score - f.home_score END), 0) FROM public.scheduled_games f
                WHERE f.game_id = g.id AND f.season_year = g.season_year AND f.competition_phase = 'regular_season'
                AND f.status = 'completed' AND q.team_id IN (f.home_team_id, f.away_team_id)) DESC,
              q.draw_order) INTO candidate FROM public.postseason_qualifications q
              WHERE q.game_id = g.id AND q.season_year = g.season_year AND q.team_id = ANY(candidate);
          END IF;
          home_id := candidate[1]; away_id := candidate[2];
        END IF;
        INSERT INTO public.postseason_series(game_id, season_year, round, conference, bracket_slot, home_team_id, away_team_id)
          VALUES (g.id, g.season_year, r, conf, slot, home_id, away_id);
      END LOOP;
    END LOOP;
  END LOOP;

  FOR s IN SELECT * FROM public.postseason_series p WHERE p.game_id = g.id
    AND p.season_year = g.season_year AND p.winner_team_id IS NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.postseason_series_games link JOIN public.scheduled_games f
      ON f.id = link.scheduled_game_id WHERE link.series_id = s.id AND f.status = 'scheduled') THEN CONTINUE; END IF;
    SELECT count(*) + 1, max(f.game_date) INTO n, last_date FROM public.postseason_series_games link
      JOIN public.scheduled_games f ON f.id = link.scheduled_game_id WHERE link.series_id = s.id;
    IF n = 1 THEN
      SELECT max(f.game_date) INTO round_end FROM public.scheduled_games f WHERE f.game_id = g.id
        AND f.season_year = g.season_year AND (CASE WHEN s.round = 1 THEN f.competition_phase = 'play_in'
          ELSE EXISTS (SELECT 1 FROM public.postseason_series_games link JOIN public.postseason_series prev
            ON prev.id = link.series_id WHERE link.scheduled_game_id = f.id AND prev.round = s.round - 1) END);
      last_date := greatest(g.simulation_date, round_end);
    END IF;
    home_id := CASE WHEN n IN (1,2,5,7) THEN s.home_team_id ELSE s.away_team_id END;
    away_id := CASE WHEN n IN (1,2,5,7) THEN s.away_team_id ELSE s.home_team_id END;
    INSERT INTO public.scheduled_games(game_id, season_year, competition_phase, game_date, home_team_id, away_team_id)
      VALUES (g.id, g.season_year, 'playoffs', last_date + 2, home_id, away_id) RETURNING id INTO fixture_id;
    INSERT INTO public.postseason_series_games VALUES (g.id, s.id, n, fixture_id);
  END LOOP;

  INSERT INTO public.postseason_results(game_id, season_year, finals_series_id, champion_team_id, runner_up_team_id, completed_on)
    SELECT g.id, g.season_year, p.id, p.winner_team_id,
      CASE WHEN p.winner_team_id = p.home_team_id THEN p.away_team_id ELSE p.home_team_id END, g.simulation_date
    FROM public.postseason_series p WHERE p.game_id = g.id AND p.season_year = g.season_year
      AND p.round = 4 AND p.winner_team_id IS NOT NULL ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_playoffs(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (
  new_date DATE, season_complete BOOLEAN, result_id UUID, home_team_id UUID,
  away_team_id UUID, home_score SMALLINT, away_score SMALLINT, winner_team_id UUID,
  standing_team_id UUID, wins INTEGER, losses INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; r RECORD; f public.scheduled_games%ROWTYPE;
  matches public.scheduled_games[] := ARRAY[]::public.scheduled_games[];
  box_score JSONB; seed BIGINT; home_rating SMALLINT; away_rating SMALLINT; checked BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  season_complete := EXISTS (SELECT 1 FROM public.postseason_results p WHERE p.game_id = g.id AND p.season_year = g.season_year);
  IF g.simulation_date IS DISTINCT FROM p_expected_date OR season_complete THEN
    new_date := g.simulation_date; RETURN NEXT; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.postseason_qualifications q
    WHERE q.game_id = g.id AND q.season_year = g.season_year) THEN
    FOR r IN SELECT * FROM public.advance_qualification_day(p_game_id, p_expected_date) LOOP
      IF NOT checked AND EXISTS (SELECT 1 FROM public.postseason_qualifications q
        WHERE q.game_id = g.id AND q.season_year = g.season_year) THEN
        PERFORM public.prepare_play_in(g.id); checked := true;
      END IF;
      RETURN QUERY SELECT r.new_date, false, r.result_id, r.home_team_id, r.away_team_id,
        r.home_score, r.away_score, r.winner_team_id, r.standing_team_id, r.wins, r.losses;
    END LOOP;
    RETURN;
  END IF;
  PERFORM public.prepare_play_in(g.id);
  PERFORM public.prepare_playoffs(g.id);
  new_date := g.simulation_date + 1;
  IF EXISTS (SELECT 1 FROM public.scheduled_games fixture WHERE fixture.game_id = g.id
    AND fixture.season_year = g.season_year AND fixture.competition_phase IN ('play_in', 'playoffs')
    AND fixture.status = 'scheduled' AND fixture.game_date < new_date)
  THEN RAISE EXCEPTION 'Postseason schedule is behind the simulation clock'; END IF;
  FOR f IN SELECT fixture.* FROM public.scheduled_games fixture WHERE fixture.game_id = g.id
    AND fixture.season_year = g.season_year AND fixture.competition_phase IN ('play_in', 'playoffs')
    AND fixture.game_date = new_date AND fixture.status = 'scheduled' ORDER BY fixture.id FOR UPDATE
  LOOP
    box_score := public.simulate_fixture_box_score(f.id);
    IF box_score IS NOT NULL THEN
      f.home_score := (box_score->>'homeScore')::SMALLINT;
      f.away_score := (box_score->>'awayScore')::SMALLINT;
    ELSE
      home_rating := public.get_simulation_team_rating(g.id, f.home_team_id);
      away_rating := public.get_simulation_team_rating(g.id, f.away_team_id);
      seed := ('x' || substr(md5(g.id::TEXT || ':' || new_date::TEXT || ':' || f.home_team_id::TEXT || ':' || f.away_team_id::TEXT), 1, 8))::bit(32)::BIGINT;
      f.home_score := greatest(70, round(105 + (home_rating + 3 - 75) * 0.55 + (mod(abs(seed), 2400) / 100.0 - 12)));
      f.away_score := greatest(70, round(105 + (away_rating - 75) * 0.55 + (mod(abs(seed / 2400), 2400) / 100.0 - 12)));
      IF f.home_score = f.away_score THEN f.away_score := f.away_score - 1; END IF;
    END IF;
    f.winner_team_id := CASE WHEN f.home_score > f.away_score THEN f.home_team_id ELSE f.away_team_id END;
    UPDATE public.scheduled_games SET status = 'completed', home_score = f.home_score,
      away_score = f.away_score, winner_team_id = f.winner_team_id WHERE id = f.id;
    matches := array_append(matches, f);
  END LOOP;
  UPDATE public.games SET simulation_date = new_date, updated_at = now() WHERE id = g.id;
  PERFORM public.prepare_play_in(g.id);
  PERFORM public.prepare_playoffs(g.id);
  season_complete := EXISTS (SELECT 1 FROM public.postseason_results p WHERE p.game_id = g.id AND p.season_year = g.season_year);
  FOREACH f IN ARRAY matches LOOP
    result_id := f.id; home_team_id := f.home_team_id; away_team_id := f.away_team_id;
    home_score := f.home_score; away_score := f.away_score; winner_team_id := f.winner_team_id;
    RETURN NEXT;
  END LOOP;
  IF cardinality(matches) = 0 THEN RETURN NEXT; END IF;
END;
$$;

CREATE FUNCTION public.get_postseason_state(p_game_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; result JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  SELECT jsonb_build_object(
    'phase', CASE WHEN EXISTS (SELECT 1 FROM public.postseason_results p WHERE p.game_id = g.id AND p.season_year = g.season_year) THEN 'complete'
      WHEN (SELECT count(*) FROM public.postseason_playoff_seeds p WHERE p.game_id = g.id AND p.season_year = g.season_year) = 16 THEN 'playoffs'
      WHEN EXISTS (SELECT 1 FROM public.postseason_qualifications q WHERE q.game_id = g.id AND q.season_year = g.season_year) THEN 'play_in'
      ELSE 'regular_season' END,
    'championTeamId', (SELECT p.champion_team_id FROM public.postseason_results p WHERE p.game_id = g.id AND p.season_year = g.season_year),
    'runnerUpTeamId', (SELECT p.runner_up_team_id FROM public.postseason_results p WHERE p.game_id = g.id AND p.season_year = g.season_year),
    'qualification', coalesce((SELECT jsonb_agg(jsonb_build_object('teamId',q.team_id,'conference',q.conference,'seed',q.seed) ORDER BY q.conference,q.seed)
      FROM public.postseason_qualifications q WHERE q.game_id = g.id AND q.season_year = g.season_year),'[]'::JSONB),
    'playoffSeeds', coalesce((SELECT jsonb_agg(jsonb_build_object('teamId',p.team_id,'conference',p.conference,'seed',p.seed) ORDER BY p.conference,p.seed)
      FROM public.postseason_playoff_seeds p WHERE p.game_id = g.id AND p.season_year = g.season_year),'[]'::JSONB),
    'series', coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'round',p.round,'conference',p.conference,'bracketSlot',p.bracket_slot,
      'homeTeamId',p.home_team_id,'awayTeamId',p.away_team_id,'homeWins',p.home_wins,'awayWins',p.away_wins,'winnerTeamId',p.winner_team_id)
      ORDER BY p.round,p.conference,p.bracket_slot) FROM public.postseason_series p WHERE p.game_id = g.id AND p.season_year = g.season_year),'[]'::JSONB),
    'games', coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'seriesId',link.series_id,'stage',pi.stage,
      'conference',coalesce(p.conference,pi.conference),'gameNumber',link.game_number,'gameDate',f.game_date,
      'homeTeamId',f.home_team_id,'awayTeamId',f.away_team_id,'homeScore',f.home_score,'awayScore',f.away_score,
      'winnerTeamId',f.winner_team_id,'status',f.status) ORDER BY f.game_date,f.id)
      FROM public.scheduled_games f LEFT JOIN public.postseason_series_games link ON link.scheduled_game_id = f.id
      LEFT JOIN public.postseason_series p ON p.id = link.series_id
      LEFT JOIN public.postseason_play_in_games pi ON pi.scheduled_game_id = f.id
      WHERE f.game_id = g.id AND f.season_year = g.season_year AND (p.id IS NOT NULL OR pi.scheduled_game_id IS NOT NULL)),'[]'::JSONB)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_postseason_state(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_postseason_state(UUID) TO authenticated;

COMMIT;
