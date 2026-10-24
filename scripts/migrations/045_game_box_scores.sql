BEGIN;

CREATE FUNCTION public.is_valid_game_box_score(p_result JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  row JSONB;
  field TEXT;
  side TEXT;
  elapsed INTEGER;
BEGIN
  IF p_result->>'engineVersion' IS DISTINCT FROM 'possessions-v1'
     OR jsonb_typeof(p_result->'overtimes') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_result->'homeScore') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_result->'awayScore') IS DISTINCT FROM 'number'
     OR (p_result->>'overtimes') !~ '^[0-9]+$'
     OR (p_result->>'homeScore') !~ '^[0-9]+$'
     OR (p_result->>'awayScore') !~ '^[0-9]+$'
     OR jsonb_typeof(p_result->'players') IS DISTINCT FROM 'array'
     OR NOT (p_result ?& ARRAY['overtimes','homeScore','awayScore','players']) THEN RETURN false; END IF;
  elapsed := 2880 + 300 * (p_result->>'overtimes')::INTEGER;
  IF (p_result->>'overtimes')::INTEGER NOT BETWEEN 0 AND 20
     OR (p_result->>'homeScore')::INTEGER = (p_result->>'awayScore')::INTEGER THEN RETURN false; END IF;
  FOR row IN SELECT * FROM jsonb_array_elements(p_result->'players') LOOP
    PERFORM (row->>'playerId')::UUID;
    IF nullif(row->>'playerId','') IS NULL OR nullif(row->>'playerName','') IS NULL
       OR row->>'side' IS NULL OR row->>'side' NOT IN ('home','away') THEN RETURN false; END IF;
    FOREACH field IN ARRAY ARRAY['seconds','fieldGoalsMade','fieldGoalsAttempted',
      'threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted',
      'offensiveRebounds','defensiveRebounds','assists','steals','blocks','turnovers','personalFouls','points'] LOOP
      IF NOT (row ? field) OR jsonb_typeof(row->field) IS DISTINCT FROM 'number'
        OR row->>field !~ '^[0-9]+$' THEN RETURN false; END IF;
    END LOOP;
    IF (row->>'seconds')::INTEGER > elapsed
      OR (row->>'fieldGoalsMade')::INTEGER > (row->>'fieldGoalsAttempted')::INTEGER
      OR (row->>'threePointersMade')::INTEGER > (row->>'threePointersAttempted')::INTEGER
      OR (row->>'threePointersMade')::INTEGER > (row->>'fieldGoalsMade')::INTEGER
      OR (row->>'threePointersAttempted')::INTEGER > (row->>'fieldGoalsAttempted')::INTEGER
      OR (row->>'fieldGoalsMade')::INTEGER - (row->>'threePointersMade')::INTEGER
        > (row->>'fieldGoalsAttempted')::INTEGER - (row->>'threePointersAttempted')::INTEGER
      OR (row->>'freeThrowsMade')::INTEGER > (row->>'freeThrowsAttempted')::INTEGER
      OR (row->>'points')::INTEGER <> 2*(row->>'fieldGoalsMade')::INTEGER
        + (row->>'threePointersMade')::INTEGER + (row->>'freeThrowsMade')::INTEGER THEN RETURN false; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT r->>'playerId') <> count(*) FROM jsonb_array_elements(p_result->'players') r)
    THEN RETURN false; END IF;
  FOREACH side IN ARRAY ARRAY['home','away'] LOOP
    IF (SELECT count(*) NOT BETWEEN 5 AND 15 OR sum((r->>'seconds')::INTEGER) <> elapsed * 5
      OR sum((r->>'points')::INTEGER) <> (p_result->>(side || 'Score'))::INTEGER
      OR sum((r->>'assists')::INTEGER) > sum((r->>'fieldGoalsMade')::INTEGER)
      FROM jsonb_array_elements(p_result->'players') r WHERE r->>'side' = side) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.is_valid_game_box_score(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE UNIQUE INDEX scheduled_games_game_id_id_key ON public.scheduled_games(game_id, id);
CREATE TABLE public.game_box_scores (
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  scheduled_game_id UUID PRIMARY KEY,
  payload JSONB NOT NULL CHECK (public.is_valid_game_box_score(payload)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (game_id, scheduled_game_id) REFERENCES public.scheduled_games(game_id, id) ON DELETE CASCADE
);
CREATE INDEX game_box_scores_game_id_idx ON public.game_box_scores(game_id);
ALTER TABLE public.game_box_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_box_scores FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_box_scores TO authenticated, service_role;
CREATE POLICY game_box_scores_owner_read ON public.game_box_scores
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
      AND g.deleted_at IS NULL
  ));

CREATE FUNCTION public.simulate_fixture_box_score(p_fixture_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  fixture public.scheduled_games%ROWTYPE;
  career public.games%ROWTYPE;
  home JSONB;
  away JSONB;
  available INTEGER;
  result JSONB;
BEGIN
  SELECT * INTO fixture FROM public.scheduled_games WHERE id = p_fixture_id FOR UPDATE;
  SELECT * INTO career FROM public.games WHERE id = fixture.game_id AND user_id = auth.uid()
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  IF fixture.status <> 'scheduled' THEN RAISE EXCEPTION 'Fixture already completed'; END IF;
  -- Legacy careers keep their established score-only simulation; never backfill past results.
  IF career.season_era_id <> 'modern' OR NOT EXISTS (
    SELECT 1 FROM public.game_attribute_materializations
      WHERE game_id = career.id AND season_year = career.season_year
  ) THEN RETURN NULL; END IF;
  SELECT count(*) INTO available FROM public.game_player_states s
    WHERE s.game_id = career.id AND s.team_id IN (fixture.home_team_id, fixture.away_team_id)
      AND s.is_active AND NOT s.is_injured;
  SELECT jsonb_agg(jsonb_build_object('playerId', s.player_id, 'playerName', p.full_name,
    'attributes', a.attributes) ORDER BY
    ((a.attributes->>'closeShot')::INTEGER + (a.attributes->>'threePointShot')::INTEGER
      + (a.attributes->>'interiorDefense')::INTEGER) DESC, s.player_id)
    FILTER (WHERE s.team_id = fixture.home_team_id),
    jsonb_agg(jsonb_build_object('playerId', s.player_id, 'playerName', p.full_name,
    'attributes', a.attributes) ORDER BY
    ((a.attributes->>'closeShot')::INTEGER + (a.attributes->>'threePointShot')::INTEGER
      + (a.attributes->>'interiorDefense')::INTEGER) DESC, s.player_id)
    FILTER (WHERE s.team_id = fixture.away_team_id)
  INTO home, away FROM public.game_player_states s
    JOIN public.players p ON p.id = s.player_id
    JOIN public.game_player_attributes a ON a.game_id = s.game_id AND a.player_id = s.player_id
      AND a.season_year = career.season_year
    WHERE s.game_id = career.id AND s.team_id IN (fixture.home_team_id, fixture.away_team_id)
      AND s.is_active AND NOT s.is_injured;
  IF coalesce(jsonb_array_length(home),0) + coalesce(jsonb_array_length(away),0) <> available
    THEN RAISE EXCEPTION 'Player attribute coverage is incomplete'; END IF;
  IF coalesce(jsonb_array_length(home),0) < 5 OR coalesce(jsonb_array_length(away),0) < 5
    THEN RAISE EXCEPTION 'At least five available players per team are required'; END IF;
  -- A career roster can include extra two-way players; dress at most fifteen per fixture.
  SELECT jsonb_agg(r ORDER BY n) INTO home
    FROM jsonb_array_elements(home) WITH ORDINALITY AS r(r,n) WHERE n <= 15;
  SELECT jsonb_agg(r ORDER BY n) INTO away
    FROM jsonb_array_elements(away) WITH ORDINALITY AS r(r,n) WHERE n <= 15;
  result := public.simulate_possession_game(home, away,
    career.id::TEXT || ':' || fixture.game_date::TEXT || ':' || fixture.home_team_id::TEXT || ':' || fixture.away_team_id::TEXT);
  INSERT INTO public.game_box_scores(game_id, scheduled_game_id, payload)
    VALUES (career.id, fixture.id, result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.simulate_fixture_box_score(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
