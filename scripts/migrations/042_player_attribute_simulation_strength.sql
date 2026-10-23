BEGIN;

CREATE OR REPLACE FUNCTION public.get_simulation_team_rating(p_game_id UUID, p_team_id UUID)
RETURNS SMALLINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE;
  base SMALLINT;
  available INTEGER;
  rated_available INTEGER;
  average_quality NUMERIC;
  quality_adjustment INTEGER := 0;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  SELECT t.base_rating INTO base FROM public.teams t WHERE t.id = p_team_id;
  IF base IS NULL THEN RAISE EXCEPTION 'Simulation team not found'; END IF;
  IF g.season_era_id <> 'modern'
     OR NOT EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id)
     OR NOT EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id) THEN
    RETURN base;
  END IF;
  SELECT count(*)::INTEGER INTO available FROM public.game_player_states s
  WHERE s.game_id = p_game_id AND s.team_id = p_team_id AND s.is_active AND NOT s.is_injured;
  SELECT count(*)::INTEGER,
    avg((a.attributes->>'closeShot')::NUMERIC + (a.attributes->>'midRangeShot')::NUMERIC
      + (a.attributes->>'threePointShot')::NUMERIC + (a.attributes->>'freeThrow')::NUMERIC
      + (a.attributes->>'drawFoul')::NUMERIC + (a.attributes->>'ballHandle')::NUMERIC
      + (a.attributes->>'passAccuracy')::NUMERIC + (a.attributes->>'interiorDefense')::NUMERIC
      + (a.attributes->>'perimeterDefense')::NUMERIC + (a.attributes->>'steal')::NUMERIC
      + (a.attributes->>'block')::NUMERIC + (a.attributes->>'offensiveRebound')::NUMERIC
      + (a.attributes->>'defensiveRebound')::NUMERIC + (a.attributes->>'stamina')::NUMERIC) / 14.0
  INTO rated_available, average_quality
  FROM public.game_player_states s
  JOIN public.game_player_attributes a
    ON a.game_id = s.game_id AND a.season_year = g.season_year AND a.player_id = s.player_id
  WHERE s.game_id = p_game_id AND s.team_id = p_team_id AND s.is_active AND NOT s.is_injured;
  IF rated_available = available AND rated_available > 0 THEN
    quality_adjustment := round((average_quality - 60) * 0.2)::INTEGER;
  END IF;
  RETURN LEAST(100, GREATEST(0,
    base + 2 * (LEAST(available, 15) - 12) + quality_adjustment))::SMALLINT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_simulation_team_rating(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
