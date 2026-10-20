BEGIN;

-- Imported salary grids contain empty future cells, not a salary obligation for every column.
CREATE OR REPLACE FUNCTION public.release_roster_player(
  p_game_id UUID, p_player_id UUID, p_request_id UUID, p_contract_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; s public.game_player_states%ROWTYPE;
  r public.game_runtime_contracts%ROWTYPE; a public.game_contract_agreements%ROWTYPE;
  c public.contracts%ROWTYPE; previous public.game_roster_releases%ROWTYPE;
  salaries JSONB := '{}'; origin TEXT := 'observed'; current_contract UUID; release_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_game_id IS NULL OR p_player_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Release identifiers required';
  END IF;
  -- Same game-first lock order as trades, signing and simulation days.
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND season_year = 2026
    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern 2026 game required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_contract_materializations WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION 'Materialized contract coverage required';
  END IF;
  SELECT * INTO previous FROM public.game_roster_releases WHERE game_id = p_game_id AND request_id = p_request_id;
  IF FOUND THEN
    IF previous.player_id <> p_player_id OR previous.contract_id IS DISTINCT FROM p_contract_id THEN
      RAISE EXCEPTION 'Idempotency key reused with changed release payload';
    END IF;
    RETURN previous.id;
  END IF;
  SELECT * INTO s FROM public.game_player_states WHERE game_id = p_game_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND OR s.team_id IS DISTINCT FROM g.selected_team_id OR NOT s.is_active THEN
    RAISE EXCEPTION 'Player is not on the selected team active roster';
  END IF;
  SELECT * INTO r FROM public.game_active_runtime_contracts WHERE game_id = p_game_id AND player_id = p_player_id;
  IF FOUND THEN
    current_contract := r.id; origin := 'simulated';
    SELECT jsonb_object_agg(y::TEXT, CASE WHEN r.is_guaranteed IS false THEN 0 ELSE r.annual_salary END)
    INTO salaries FROM generate_series(GREATEST(g.season_year, r.start_year), r.end_year) y;
  ELSE
    SELECT * INTO a FROM public.game_contract_agreements WHERE game_id = p_game_id AND player_id = p_player_id;
    IF FOUND THEN
      current_contract := a.id;
      IF a.cap_treatment = 'standard-cap-and-matching' THEN
        IF NOT EXISTS (SELECT 1 FROM public.game_contract_seasons WHERE game_id = p_game_id
          AND agreement_id = a.id AND start_year = g.season_year AND salary_amount IS NOT NULL) THEN
          RAISE EXCEPTION 'Release salary coverage is incomplete';
        END IF;
        -- ponytail: retain known salaries with unknown/partial guarantees; no stretch or set-off in v1.
        SELECT jsonb_object_agg(start_year::TEXT, CASE WHEN guarantee_kind = 'not-guaranteed' THEN 0 ELSE salary_amount END)
        INTO salaries FROM public.game_contract_seasons
        WHERE game_id = p_game_id AND agreement_id = a.id AND start_year >= g.season_year
          AND salary_amount IS NOT NULL;
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.game_contract_identities WHERE game_id = p_game_id
      AND player_id = p_player_id AND cap_treatment = 'excluded-two-way') THEN
      current_contract := NULL;
    ELSE
      SELECT * INTO c FROM public.contracts WHERE game_id = p_game_id AND player_id = p_player_id;
      IF NOT FOUND OR (SELECT count(*) FROM public.contracts WHERE game_id = p_game_id AND player_id = p_player_id) <> 1 THEN
        RAISE EXCEPTION 'Release salary coverage is incomplete';
      END IF;
      current_contract := c.id;
      SELECT jsonb_object_agg(y::TEXT, CASE WHEN c.is_guaranteed IS false THEN 0 ELSE
        (ARRAY[c.salary_y1, c.salary_y2, c.salary_y3, c.salary_y4, c.salary_y5])[y - c.start_year + 1] END)
      INTO salaries FROM generate_series(GREATEST(g.season_year, c.start_year), c.end_year) y;
      IF EXISTS (SELECT 1 FROM jsonb_each(salaries) WHERE value = 'null'::JSONB) THEN
        RAISE EXCEPTION 'Release salary coverage is incomplete';
      END IF;
    END IF;
  END IF;
  IF current_contract IS DISTINCT FROM p_contract_id THEN RAISE EXCEPTION 'Player contract changed; refresh the roster'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(salaries, '{}'))
    WHERE value IS NULL OR value::NUMERIC < 0 OR value::NUMERIC > 9007199254740991) THEN
    RAISE EXCEPTION 'Release salary coverage is incomplete';
  END IF;
  INSERT INTO public.game_roster_releases(game_id, player_id, team_id, request_id, contract_id,
    contract_origin, salary_by_year, released_date)
  VALUES (p_game_id, p_player_id, g.selected_team_id, p_request_id, current_contract,
    origin, COALESCE(salaries, '{}'), g.simulation_date) RETURNING id INTO release_id;
  UPDATE public.game_runtime_contracts SET released_at = now() WHERE id = r.id;
  -- Legacy compatibility rows describe live contracts, unlike immutable imported snapshots.
  DELETE FROM public.contracts WHERE game_id = p_game_id AND player_id = p_player_id;
  UPDATE public.game_player_states SET team_id = NULL, updated_at = now() WHERE id = s.id;
  RETURN release_id;
END;
$$;
REVOKE ALL ON FUNCTION public.release_roster_player(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.release_roster_player(UUID, UUID, UUID, UUID) TO authenticated;

COMMIT;
