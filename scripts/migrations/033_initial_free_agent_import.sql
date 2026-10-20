BEGIN;

CREATE TABLE public.free_agency_imports (
  game_id UUID PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  enrolled_count INTEGER NOT NULL CHECK (enrolled_count >= 0),
  skipped_count INTEGER NOT NULL CHECK (skipped_count >= 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.free_agency_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_agency_imports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.free_agency_imports TO authenticated;
CREATE POLICY free_agency_imports_owner_read ON public.free_agency_imports
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
      AND g.deleted_at IS NULL
  ));

CREATE FUNCTION public.import_initial_free_agents(p_game_id UUID, p_owner_id UUID, p_snapshot JSONB)
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
  -- Serialize with global roster promotion and other imports before resolving identities.
  PERFORM pg_advisory_xact_lock(hashtextextended('current-roster', 0));
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = p_owner_id
    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR g.status <> 'active' OR g.season_era_id <> 'modern' OR g.season_year <> 2026
    OR NOT EXISTS (SELECT 1 FROM public.game_contract_materializations WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION 'Owned active materialized modern 2026 game required';
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
    -- Options and restricted/two-way agreements require unsupported transaction rules.
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
      -- An ESPN-only identity must be reconciled, never duplicated or rebound by name alone.
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
REVOKE ALL ON FUNCTION public.import_initial_free_agents(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_initial_free_agents(UUID, UUID, JSONB) TO service_role;

COMMIT;
