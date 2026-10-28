BEGIN;

CREATE TABLE public.postseason_play_in_games (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('East', 'West')),
  stage TEXT NOT NULL CHECK (stage IN ('seven_eight', 'nine_ten', 'eighth_seed')),
  scheduled_game_id UUID NOT NULL UNIQUE,
  PRIMARY KEY (game_id, season_year, conference, stage),
  FOREIGN KEY (game_id, scheduled_game_id) REFERENCES public.scheduled_games(game_id, id) ON DELETE CASCADE
);
CREATE TABLE public.postseason_playoff_seeds (
  game_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  team_id UUID NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('East', 'West')),
  seed INTEGER NOT NULL CHECK (seed BETWEEN 1 AND 8),
  PRIMARY KEY (game_id, season_year, conference, seed),
  UNIQUE (game_id, season_year, team_id),
  FOREIGN KEY (game_id, season_year, team_id)
    REFERENCES public.postseason_qualifications(game_id, season_year, team_id) ON DELETE CASCADE
);
ALTER TABLE public.postseason_play_in_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postseason_playoff_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY play_in_owner ON public.postseason_play_in_games FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
CREATE POLICY playoff_seeds_owner ON public.postseason_playoff_seeds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid() AND g.deleted_at IS NULL));
REVOKE ALL ON public.postseason_play_in_games, public.postseason_playoff_seeds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.postseason_play_in_games, public.postseason_playoff_seeds TO authenticated;

CREATE FUNCTION public.prepare_play_in(p_game_id UUID) RETURNS VOID
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; conf TEXT; pairing INTEGER; home_id UUID; away_id UUID;
  fixture_id UUID; first_game public.scheduled_games%ROWTYPE; second_game public.scheduled_games%ROWTYPE;
  last_game public.scheduled_games%ROWTYPE;
BEGIN
  SELECT * INTO STRICT g FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF (SELECT count(*) FROM public.postseason_qualifications q
    WHERE q.game_id = g.id AND q.season_year = g.season_year) <> 30
  THEN RAISE EXCEPTION 'Frozen regular-season qualification required'; END IF;
  INSERT INTO public.postseason_playoff_seeds(game_id, season_year, team_id, conference, seed)
    SELECT q.game_id, q.season_year, q.team_id, q.conference, q.seed
    FROM public.postseason_qualifications q WHERE q.game_id = g.id AND q.season_year = g.season_year AND q.seed <= 6
    ON CONFLICT DO NOTHING;
  FOREACH conf IN ARRAY ARRAY['East', 'West'] LOOP
    FOREACH pairing IN ARRAY ARRAY[7, 9] LOOP
      IF NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p WHERE p.game_id = g.id
        AND p.season_year = g.season_year AND p.conference = conf
        AND p.stage = CASE WHEN pairing = 7 THEN 'seven_eight' ELSE 'nine_ten' END) THEN
        SELECT q.team_id INTO STRICT home_id FROM public.postseason_qualifications q
          WHERE q.game_id = g.id AND q.season_year = g.season_year AND q.conference = conf AND q.seed = pairing;
        SELECT q.team_id INTO STRICT away_id FROM public.postseason_qualifications q
          WHERE q.game_id = g.id AND q.season_year = g.season_year AND q.conference = conf AND q.seed = pairing + 1;
        INSERT INTO public.scheduled_games(game_id, season_year, competition_phase, game_date, home_team_id, away_team_id)
          VALUES (g.id, g.season_year, 'play_in', g.simulation_date + 2, home_id, away_id) RETURNING id INTO fixture_id;
        INSERT INTO public.postseason_play_in_games VALUES (g.id, g.season_year, conf,
          CASE WHEN pairing = 7 THEN 'seven_eight' ELSE 'nine_ten' END, fixture_id);
      END IF;
    END LOOP;
    SELECT f.* INTO STRICT first_game FROM public.scheduled_games f JOIN public.postseason_play_in_games p
      ON p.scheduled_game_id = f.id WHERE p.game_id = g.id AND p.season_year = g.season_year
        AND p.conference = conf AND p.stage = 'seven_eight';
    SELECT f.* INTO STRICT second_game FROM public.scheduled_games f JOIN public.postseason_play_in_games p
      ON p.scheduled_game_id = f.id WHERE p.game_id = g.id AND p.season_year = g.season_year
        AND p.conference = conf AND p.stage = 'nine_ten';
    IF first_game.status <> 'completed' OR second_game.status <> 'completed' THEN CONTINUE; END IF;
    INSERT INTO public.postseason_playoff_seeds VALUES (g.id, g.season_year, first_game.winner_team_id, conf, 7)
      ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.postseason_play_in_games p WHERE p.game_id = g.id
      AND p.season_year = g.season_year AND p.conference = conf AND p.stage = 'eighth_seed') THEN
      home_id := CASE WHEN first_game.winner_team_id = first_game.home_team_id
        THEN first_game.away_team_id ELSE first_game.home_team_id END;
      INSERT INTO public.scheduled_games(game_id, season_year, competition_phase, game_date, home_team_id, away_team_id)
        VALUES (g.id, g.season_year, 'play_in', greatest(first_game.game_date, second_game.game_date) + 2,
          home_id, second_game.winner_team_id) RETURNING id INTO fixture_id;
      INSERT INTO public.postseason_play_in_games VALUES (g.id, g.season_year, conf, 'eighth_seed', fixture_id);
    END IF;
    SELECT f.* INTO STRICT last_game FROM public.scheduled_games f JOIN public.postseason_play_in_games p
      ON p.scheduled_game_id = f.id WHERE p.game_id = g.id AND p.season_year = g.season_year
        AND p.conference = conf AND p.stage = 'eighth_seed';
    IF last_game.status = 'completed' THEN
      INSERT INTO public.postseason_playoff_seeds VALUES (g.id, g.season_year, last_game.winner_team_id, conf, 8)
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_play_in(UUID) FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.advance_simulation_day(UUID, DATE) RENAME TO advance_qualification_day;
REVOKE ALL ON FUNCTION public.advance_qualification_day(UUID, DATE) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.advance_simulation_day(p_game_id UUID, p_expected_date DATE)
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
  -- shortcut: stop at sixteen playoff seeds; replace when playoff-series progression is installed.
  season_complete := (SELECT count(*) = 16 FROM public.postseason_playoff_seeds s
    WHERE s.game_id = g.id AND s.season_year = g.season_year);
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
  new_date := g.simulation_date + 1;
  IF EXISTS (SELECT 1 FROM public.scheduled_games fixture JOIN public.postseason_play_in_games p
    ON p.scheduled_game_id = fixture.id WHERE p.game_id = g.id AND p.season_year = g.season_year
    AND fixture.status = 'scheduled' AND fixture.game_date < new_date)
  THEN RAISE EXCEPTION 'Play-in schedule is behind the simulation clock'; END IF;
  FOR f IN SELECT fixture.* FROM public.scheduled_games fixture JOIN public.postseason_play_in_games p
    ON p.scheduled_game_id = fixture.id WHERE p.game_id = g.id AND p.season_year = g.season_year
    AND fixture.game_date = new_date AND fixture.status = 'scheduled' ORDER BY fixture.id FOR UPDATE OF fixture
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
  season_complete := (SELECT count(*) = 16 FROM public.postseason_playoff_seeds s
    WHERE s.game_id = g.id AND s.season_year = g.season_year);
  FOREACH f IN ARRAY matches LOOP
    result_id := f.id; home_team_id := f.home_team_id; away_team_id := f.away_team_id;
    home_score := f.home_score; away_score := f.away_score; winner_team_id := f.winner_team_id;
    RETURN NEXT;
  END LOOP;
  IF cardinality(matches) = 0 THEN RETURN NEXT; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_simulation_day(UUID, DATE) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advance_simulation_day(UUID, DATE) TO authenticated;

COMMIT;
