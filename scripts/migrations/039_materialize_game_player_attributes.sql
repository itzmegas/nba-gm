BEGIN;

CREATE OR REPLACE FUNCTION public.materialize_game_player_attributes(
  p_game_id UUID,
  p_owner_id UUID,
  p_season_year INTEGER,
  p_source_version_id UUID,
  p_rows JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_source public.player_rating_source_versions%ROWTYPE;
  v_header public.game_attribute_materializations%ROWTYPE;
  v_row JSONB;
  v_source_player JSONB;
  v_player_id UUID;
  v_origin TEXT;
  v_match_method TEXT;
  v_source_slug TEXT;
  v_source_overall SMALLINT;
  v_generator_version TEXT;
  v_expected_count INTEGER;
  v_count INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_game_id IS NULL OR p_owner_id IS NULL OR p_source_version_id IS NULL
     OR p_season_year IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Invalid player attribute materialization input';
  END IF;

  SELECT * INTO v_game FROM public.games
    WHERE id = p_game_id AND user_id = p_owner_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_game.status <> 'initializing' OR v_game.season_era_id <> 'modern'
     OR v_game.season_year <> p_season_year THEN
    RAISE EXCEPTION 'Owned initializing modern game required';
  END IF;
  SELECT * INTO v_source FROM public.player_rating_source_versions
    WHERE id = p_source_version_id;
  IF NOT FOUND OR v_source.game_version <> '2K27'
     OR jsonb_typeof(v_source.payload->'players') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Validated current player rating source required';
  END IF;
  SELECT count(*)::INTEGER INTO v_expected_count FROM public.game_player_states
    WHERE game_id = p_game_id;
  IF v_expected_count <> jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'Player attribute coverage does not match game roster';
  END IF;

  SELECT * INTO v_header FROM public.game_attribute_materializations
    WHERE game_id = p_game_id AND season_year = p_season_year FOR UPDATE;
  IF FOUND THEN
    IF v_header.source_version_id <> p_source_version_id
       OR v_header.player_count <> v_expected_count THEN
      RAISE EXCEPTION 'Attribute materialization retry changed its source or coverage';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_rows) AS input(
        "playerId" UUID, origin TEXT, "matchMethod" TEXT, attributes JSONB,
        "sourceSlug" TEXT, "sourceOverall" SMALLINT, "generatorVersion" TEXT,
        "identityEvidence" JSONB
      )
      LEFT JOIN public.game_player_attributes existing
        ON existing.game_id = p_game_id AND existing.season_year = p_season_year
       AND existing.player_id = input."playerId"
      WHERE existing.player_id IS NULL
         OR existing.origin IS DISTINCT FROM input.origin
         OR existing.match_method IS DISTINCT FROM input."matchMethod"
         OR existing.attributes IS DISTINCT FROM input.attributes
         OR existing.source_slug IS DISTINCT FROM input."sourceSlug"
         OR existing.source_overall IS DISTINCT FROM input."sourceOverall"
         OR existing.generator_version IS DISTINCT FROM input."generatorVersion"
         OR existing.identity_evidence IS DISTINCT FROM input."identityEvidence"
    ) OR (
      SELECT count(*) FROM public.game_player_attributes
      WHERE game_id = p_game_id AND season_year = p_season_year
    ) <> v_expected_count THEN
      RAISE EXCEPTION 'Attribute materialization retry changed its payload';
    END IF;
    RETURN jsonb_build_object('status', 'already-materialized', 'playerCount', v_expected_count,
      'sourceVersionId', p_source_version_id);
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_player_id := NULLIF(v_row->>'playerId', '')::UUID;
    v_origin := v_row->>'origin';
    v_match_method := v_row->>'matchMethod';
    v_source_slug := NULLIF(v_row->>'sourceSlug', '');
    v_source_overall := NULLIF(v_row->>'sourceOverall', '')::SMALLINT;
    v_generator_version := NULLIF(v_row->>'generatorVersion', '');
    IF v_player_id IS NULL OR v_origin IS NULL OR v_match_method IS NULL
       OR jsonb_typeof(v_row->'attributes') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_row->'identityEvidence') IS DISTINCT FROM 'object'
       OR NOT public.is_valid_player_attributes(v_row->'attributes') THEN
      RAISE EXCEPTION 'Invalid player attribute row';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.game_player_states
      WHERE game_id = p_game_id AND player_id = v_player_id) THEN
      RAISE EXCEPTION 'Player does not belong to game roster';
    END IF;
    IF v_origin = 'nba2kapi' THEN
      IF v_source_slug IS NULL OR v_source_overall IS NULL OR v_generator_version IS NOT NULL
         OR v_match_method NOT IN ('name-and-team', 'name-and-height', 'reviewed-espn-alias') THEN
        RAISE EXCEPTION 'Invalid imported player attribute provenance';
      END IF;
      SELECT value INTO v_source_player FROM jsonb_array_elements(v_source.payload->'players')
        WHERE value->>'slug' = v_source_slug;
      IF v_source_player IS NULL
         OR (v_source_player->'attributes') IS DISTINCT FROM v_row->'attributes'
         OR (v_source_player->>'overall')::SMALLINT IS DISTINCT FROM v_source_overall THEN
        RAISE EXCEPTION 'Imported player attributes do not match source version';
      END IF;
    ELSIF v_origin = 'estimated' THEN
      IF v_source_slug IS NOT NULL OR v_source_overall IS NOT NULL
         OR v_generator_version IS DISTINCT FROM 'replacement-v1'
         OR v_match_method NOT IN ('missing-source', 'incomplete-attributes',
           'ambiguous-identity', 'uncorroborated-identity') THEN
        RAISE EXCEPTION 'Invalid estimated player attribute provenance';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown player attribute origin';
    END IF;
  END LOOP;

  INSERT INTO public.game_attribute_materializations(
    game_id, season_year, source_version_id, player_count
  ) VALUES (p_game_id, p_season_year, p_source_version_id, v_expected_count);
  INSERT INTO public.game_player_attributes(
    game_id, season_year, player_id, origin, match_method, attributes,
    source_slug, source_overall, generator_version, identity_evidence
  )
  SELECT p_game_id, p_season_year, input."playerId", input.origin, input."matchMethod",
    input.attributes, NULLIF(input."sourceSlug", ''), input."sourceOverall",
    NULLIF(input."generatorVersion", ''), input."identityEvidence"
  FROM jsonb_to_recordset(p_rows) AS input(
    "playerId" UUID, origin TEXT, "matchMethod" TEXT, attributes JSONB,
    "sourceSlug" TEXT, "sourceOverall" SMALLINT, "generatorVersion" TEXT,
    "identityEvidence" JSONB
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_expected_count THEN
    RAISE EXCEPTION 'Player attribute materialization inserted incomplete coverage';
  END IF;
  RETURN jsonb_build_object('status', 'materialized', 'playerCount', v_count,
    'sourceVersionId', p_source_version_id);
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_game_player_attributes(UUID, UUID, INTEGER, UUID, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.materialize_game_player_attributes(UUID, UUID, INTEGER, UUID, JSONB)
  TO service_role;

COMMIT;
