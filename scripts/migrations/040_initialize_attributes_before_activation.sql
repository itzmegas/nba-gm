BEGIN;

CREATE OR REPLACE FUNCTION enroll_simulated_free_agents(p_game_id UUID, p_player_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF p_player_ids IS NULL OR cardinality(p_player_ids) = 0
     OR cardinality(ARRAY(SELECT DISTINCT unnest(p_player_ids))) <> cardinality(p_player_ids) THEN
    RAISE EXCEPTION 'Explicit unique player ids are required';
  END IF;
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_game.status NOT IN ('active', 'initializing') OR v_game.season_era_id <> 'modern'
     OR v_game.deleted_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM game_contract_materializations WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION 'Initializing or active game with materialized contract coverage required';
  END IF;
  FOREACH v_player_id IN ARRAY p_player_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM players p WHERE p.id = v_player_id AND p.is_active)
       OR EXISTS (SELECT 1 FROM contracts c WHERE c.game_id = p_game_id AND c.player_id = v_player_id)
       OR EXISTS (SELECT 1 FROM game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = v_player_id) THEN
      RAISE EXCEPTION 'Player is inactive or has a current game agreement';
    END IF;
    INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
    VALUES (p_game_id, v_player_id, NULL, true)
    ON CONFLICT (game_id, player_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM game_player_states s WHERE s.game_id = p_game_id
      AND s.player_id = v_player_id AND s.team_id IS NULL AND s.is_active) THEN
      RAISE EXCEPTION 'Player is not active and teamless in this game';
    END IF;
    INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
    VALUES (p_game_id, v_player_id, 'simulation-bootstrap-enrollment')
    ON CONFLICT (game_id, player_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_initial_free_agents(
  p_game_id UUID, p_owner_id UUID, p_snapshot JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE;
  prior public.free_agency_imports%ROWTYPE;
  candidate JSONB;
  player public.players%ROWTYPE;
  enrolled INTEGER := 0;
  skipped INTEGER := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('current-roster', 0));
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = p_owner_id
    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR g.status NOT IN ('active', 'initializing') OR g.season_era_id <> 'modern'
    OR g.season_year <> 2026
    OR NOT EXISTS (SELECT 1 FROM public.game_contract_materializations WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION 'Owned initializing or active materialized modern 2026 game required';
  END IF;
  SELECT * INTO prior FROM public.free_agency_imports WHERE game_id = p_game_id;
  IF FOUND THEN
    RETURN jsonb_build_object('enrolled_count', prior.enrolled_count, 'skipped_count', prior.skipped_count);
  END IF;
  IF p_snapshot IS NULL
    OR p_snapshot->>'sourceUrl' IS DISTINCT FROM 'https://www.nba.com/players/free-agent-tracker/2026'
    OR p_snapshot->>'seasonYear' IS DISTINCT FROM '2026'
    OR jsonb_typeof(p_snapshot->'players') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Validated NBA tracker snapshot required';
  END IF;
  IF jsonb_array_length(p_snapshot->'players') NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid NBA tracker size';
  END IF;
  FOR candidate IN SELECT value FROM jsonb_array_elements(p_snapshot->'players') LOOP
    IF candidate->>'season' IS DISTINCT FROM '2026'
      OR candidate->>'type' IS DISTINCT FROM 'ufa' OR candidate->>'newTeamId' IS DISTINCT FROM '0'
      OR candidate->>'isPlayerOption' IS DISTINCT FROM 'false'
      OR candidate->>'isTeamOption' IS DISTINCT FROM 'false'
      OR candidate->>'isEarlyTerminationOption' IS DISTINCT FROM 'false'
      OR candidate->>'isTwoWayFreeAgent' IS DISTINCT FROM 'false' THEN
      CONTINUE;
    END IF;
    IF (candidate->>'playerId')::INTEGER <= 0 OR (candidate->>'exp')::INTEGER NOT BETWEEN 0 AND 99
      OR NULLIF(trim(candidate->>'playerFirstName'), '') IS NULL
      OR NULLIF(trim(candidate->>'playerLastName'), '') IS NULL
      OR NULLIF(trim(candidate->>'playerDisplayName'), '') IS NULL
      OR candidate->>'position' !~ '^[GFC](-[GFC])?$' THEN
      RAISE EXCEPTION 'Invalid NBA tracker player';
    END IF;
    SELECT * INTO player FROM public.players WHERE nba_id = (candidate->>'playerId')::INTEGER;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.players p
        WHERE lower(p.full_name) = lower(candidate->>'playerDisplayName')) THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.players(nba_id, first_name, last_name, full_name, position, years_of_experience, is_active)
      VALUES ((candidate->>'playerId')::INTEGER, candidate->>'playerFirstName', candidate->>'playerLastName',
        candidate->>'playerDisplayName', candidate->>'position', (candidate->>'exp')::SMALLINT, true)
      RETURNING * INTO player;
    END IF;
    IF player.team_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id
        AND s.player_id = player.id AND (s.team_id IS NOT NULL OR NOT s.is_active))
      OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = player.id)
      OR EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = player.id)
      OR EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = player.id) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;
    UPDATE public.players SET is_active = true,
      years_of_experience = COALESCE(years_of_experience, (candidate->>'exp')::SMALLINT)
    WHERE id = player.id;
    PERFORM public.enroll_simulated_free_agents(p_game_id, ARRAY[player.id]);
    enrolled := enrolled + 1;
  END LOOP;
  INSERT INTO public.free_agency_imports(game_id, snapshot, enrolled_count, skipped_count)
  VALUES (p_game_id, p_snapshot, enrolled, skipped);
  RETURN jsonb_build_object('enrolled_count', enrolled, 'skipped_count', skipped);
END;
$$;

REVOKE ALL ON FUNCTION enroll_simulated_free_agents(UUID, UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enroll_simulated_free_agents(UUID, UUID[]) TO service_role;
REVOKE ALL ON FUNCTION public.import_initial_free_agents(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_initial_free_agents(UUID, UUID, JSONB) TO service_role;

COMMIT;
