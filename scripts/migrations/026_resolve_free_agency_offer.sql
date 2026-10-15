BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_free_agency_offer(
  p_game_id UUID,
  p_offer_id UUID
)
RETURNS public.free_agency_pending_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_offer public.free_agency_pending_offers%ROWTYPE;
  v_competitor public.free_agency_pending_offers%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_state public.game_player_states%ROWTYPE;
  v_financial RECORD;
  v_runtime_contract_id UUID;
  v_resolved_at TIMESTAMPTZ;
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated game owner required'; END IF;

  -- Match trade/submission lock order: serialize at the game before player/offer rows.
  SELECT g.* INTO v_game FROM public.games g
  WHERE g.id = p_game_id AND g.user_id = auth.uid()
    AND g.status = 'active' AND g.season_era_id = 'modern' AND g.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;

  SELECT o.* INTO v_offer FROM public.free_agency_pending_offers o
  WHERE o.id = p_offer_id AND o.game_id = p_game_id AND o.owner_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned game offer not found'; END IF;

  IF v_offer.status = 'accepted' THEN
    IF v_offer.resolved_contract_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.game_runtime_contracts r
      WHERE r.id = v_offer.resolved_contract_id AND r.game_id = p_game_id
        AND r.player_id = v_offer.player_id AND r.source_offer_id = v_offer.id
    ) THEN
      RAISE EXCEPTION 'Accepted offer resolution record is inconsistent';
    END IF;
    RETURN v_offer;
  ELSIF v_offer.status = 'rejected' THEN
    IF v_offer.resolved_at IS NULL OR v_offer.resolved_date IS NULL
       OR v_offer.resolution_reason <> 'another_offer_accepted' THEN
      RAISE EXCEPTION 'Rejected offer resolution record is inconsistent';
    END IF;
    RETURN v_offer;
  ELSIF v_offer.status <> 'pending' THEN
    RAISE EXCEPTION 'Offer status is not resolvable';
  END IF;

  IF v_game.simulation_date < v_offer.due_date THEN
    RAISE EXCEPTION 'Offer is not due';
  END IF;
  IF v_offer.team_id IS DISTINCT FROM v_game.selected_team_id THEN
    RAISE EXCEPTION 'Offer team does not match the selected game team';
  END IF;
  IF v_offer.season <> format('%s-%s', v_game.season_year, right((v_game.season_year + 1)::TEXT, 2))
     OR v_offer.season <> '2026-27' THEN
    RAISE EXCEPTION 'Offer season must match the supported game financial season';
  END IF;
  IF v_offer.annual_salary <= 0 OR v_offer.annual_salary > 9007199254740991
     OR v_offer.years NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Stored offer terms are outside supported bounds';
  END IF;

  SELECT p.* INTO v_player FROM public.players p
  WHERE p.id = v_offer.player_id AND p.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active explicitly enrolled player required'; END IF;
  SELECT s.* INTO v_state FROM public.game_player_states s
  WHERE s.game_id = p_game_id AND s.player_id = v_offer.player_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_state.is_active OR v_state.team_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments e
       WHERE e.game_id = p_game_id AND e.player_id = v_offer.player_id
         AND e.evidence_kind = 'simulation-bootstrap-enrollment')
     OR EXISTS (SELECT 1 FROM public.contracts c
       WHERE c.game_id = p_game_id AND c.player_id = v_offer.player_id)
     OR EXISTS (SELECT 1 FROM public.game_contract_agreements a
       WHERE a.game_id = p_game_id AND a.player_id = v_offer.player_id)
     OR EXISTS (SELECT 1 FROM public.game_runtime_contracts r
       WHERE r.game_id = p_game_id AND r.player_id = v_offer.player_id) THEN
    RAISE EXCEPTION 'Explicitly enrolled active teamless player without an agreement required';
  END IF;

  SELECT f.* INTO v_financial
  FROM public.get_free_agency_financial_context(p_game_id, v_offer.player_id) f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Authoritative financial context unavailable'; END IF;
  IF v_offer.annual_salary < v_financial.minimum_salary
     OR v_offer.annual_salary > v_financial.maximum_salary THEN
    RAISE EXCEPTION 'Salary outside verified minimum and maximum';
  END IF;
  IF v_financial.roster_count + 1 > 15 THEN RAISE EXCEPTION 'Roster maximum reached'; END IF;
  IF v_offer.annual_salary > v_financial.cap_room
     AND v_offer.annual_salary <> v_financial.minimum_salary THEN
    RAISE EXCEPTION 'Offer exceeds cap room';
  END IF;

  v_resolved_at := clock_timestamp();
  INSERT INTO public.game_runtime_contracts(
    game_id, player_id, origin_kind, start_year, end_year, annual_salary,
    is_player_option, is_team_option, is_guaranteed, source_offer_id
  ) VALUES (
    p_game_id, v_offer.player_id, 'simulated-agreement', v_financial.season_year,
    v_financial.season_year + v_offer.years - 1, v_offer.annual_salary,
    false, false, NULL, v_offer.id
  ) RETURNING id INTO v_runtime_contract_id;

  UPDATE public.game_player_states s
  SET team_id = v_financial.selected_team_id, updated_at = now()
  WHERE s.game_id = p_game_id AND s.player_id = v_offer.player_id
    AND s.team_id IS NULL AND s.is_active;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN RAISE EXCEPTION 'Roster assignment changed during offer resolution'; END IF;

  FOR v_competitor IN
    SELECT o.* FROM public.free_agency_pending_offers o
    WHERE o.game_id = p_game_id AND o.player_id = v_offer.player_id AND o.status = 'pending'
    ORDER BY o.id FOR UPDATE
  LOOP
    IF v_competitor.id = v_offer.id THEN
      UPDATE public.free_agency_pending_offers o
      SET status = 'accepted', resolved_at = v_resolved_at,
          resolved_date = v_game.simulation_date,
          resolution_reason = 'selected_offer_accepted',
          resolved_contract_id = v_runtime_contract_id
      WHERE o.id = v_competitor.id
      RETURNING o.* INTO v_offer;
    ELSE
      UPDATE public.free_agency_pending_offers o
      SET status = 'rejected', resolved_at = v_resolved_at,
          resolved_date = v_game.simulation_date,
          resolution_reason = 'another_offer_accepted',
          resolved_contract_id = NULL
      WHERE o.id = v_competitor.id;
    END IF;
  END LOOP;

  IF v_offer.status <> 'accepted' OR v_offer.resolved_contract_id IS DISTINCT FROM v_runtime_contract_id THEN
    RAISE EXCEPTION 'Offer competitors were not terminalized consistently';
  END IF;
  RETURN v_offer;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_free_agency_offer(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
