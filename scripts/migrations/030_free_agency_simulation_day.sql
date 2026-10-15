BEGIN;

-- Keep the proven sports/clock implementation, but remove every client bypass.
ALTER FUNCTION public.advance_simulation_day(UUID, DATE) RENAME TO advance_simulation_day_core;
ALTER FUNCTION public.advance_simulation_day_core(UUID, DATE) SET search_path = pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.advance_simulation_day_core(UUID, DATE) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.advance_simulation_day(p_game_id UUID, p_expected_date DATE)
RETURNS TABLE (
  new_date DATE, season_complete BOOLEAN, result_id UUID, home_team_id UUID,
  away_team_id UUID, home_score SMALLINT, away_score SMALLINT, winner_team_id UUID,
  standing_team_id UUID, wins INTEGER, losses INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; run_market BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or access denied'; END IF;
  -- Stale retries and terminal no-ops must not generate bids or resolve the market.
  IF g.simulation_date IS DISTINCT FROM p_expected_date OR g.simulation_date >= make_date(g.season_year + 1, 4, 15) THEN
    RETURN QUERY SELECT * FROM public.advance_simulation_day_core(p_game_id, p_expected_date);
    RETURN;
  END IF;
  run_market := g.season_era_id = 'modern' AND (
    EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments WHERE game_id = p_game_id)
    OR EXISTS (SELECT 1 FROM public.free_agency_pending_offers WHERE game_id = p_game_id AND status = 'pending')
  );
  IF run_market THEN PERFORM public.generate_ai_free_agency_offers(p_game_id); END IF;
  -- RETURN QUERY buffers rows; market failure still rolls back sports, standings and clock.
  RETURN QUERY SELECT * FROM public.advance_simulation_day_core(p_game_id, p_expected_date);
  IF run_market THEN PERFORM public.resolve_due_free_agency_market(p_game_id); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_simulation_day(UUID, DATE) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advance_simulation_day(UUID, DATE) TO authenticated;

COMMIT;
