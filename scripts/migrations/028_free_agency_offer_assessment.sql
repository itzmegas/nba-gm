BEGIN;

ALTER TABLE public.free_agency_pending_offers
  ADD COLUMN offer_origin TEXT NOT NULL DEFAULT 'human' CHECK (offer_origin IN ('human', 'ai')),
  ADD COLUMN ai_decision_date DATE,
  ADD COLUMN resolution_detail TEXT,
  ADD CONSTRAINT free_agency_offer_origin_date_check
    CHECK ((offer_origin = 'ai') = (ai_decision_date IS NOT NULL)),
  DROP CONSTRAINT free_agency_pending_offers_resolution_state_check;
ALTER TABLE public.free_agency_pending_offers
  ADD CONSTRAINT free_agency_pending_offers_resolution_state_check CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_date IS NULL
      AND resolution_reason IS NULL AND resolved_contract_id IS NULL)
    OR (status = 'accepted' AND resolved_at IS NOT NULL AND resolved_date IS NOT NULL
      AND resolution_reason IS NOT DISTINCT FROM 'selected_offer_accepted' AND resolved_contract_id IS NOT NULL)
    OR (status = 'rejected' AND resolved_at IS NOT NULL AND resolved_date IS NOT NULL
      AND resolution_reason IS NOT NULL AND resolution_reason IN ('another_offer_accepted', 'offer_no_longer_legal')
      AND resolved_contract_id IS NULL)
  ),
  ADD CONSTRAINT free_agency_offer_resolution_detail_check CHECK (
    (resolution_reason IS NOT DISTINCT FROM 'offer_no_longer_legal') = (resolution_detail IS NOT NULL)
    AND (resolution_detail IS NULL OR length(btrim(resolution_detail)) > 0)
  );
CREATE UNIQUE INDEX free_agency_one_ai_offer_per_team_day
  ON public.free_agency_pending_offers(game_id, team_id, ai_decision_date) WHERE offer_origin = 'ai';

-- Ranking and signing call this same authoritative evaluator under the game lock.
CREATE FUNCTION public.assess_free_agency_offer(p_game_id UUID, p_offer_id UUID)
RETURNS TABLE (rejection_reason TEXT, score NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; o public.free_agency_pending_offers%ROWTYPE;
  f RECORD; quality INTEGER;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  SELECT * INTO o FROM public.free_agency_pending_offers
  WHERE game_id = p_game_id AND id = p_offer_id AND owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned game offer not found'; END IF;
  score := 0;
  IF o.status <> 'pending' THEN rejection_reason := 'Offer is not pending';
  ELSIF g.simulation_date < o.due_date THEN rejection_reason := 'Offer is not due';
  ELSIF o.offer_origin = 'human' AND o.team_id IS DISTINCT FROM g.selected_team_id THEN
    rejection_reason := 'Offer team does not match the selected game team';
  ELSIF o.offer_origin = 'ai' AND (o.team_id = g.selected_team_id OR NOT (
    EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id AND s.team_id = o.team_id)
    OR EXISTS (SELECT 1 FROM public.league_standings s WHERE s.game_id = p_game_id AND s.team_id = o.team_id)
  )) THEN rejection_reason := 'AI team does not participate in this game';
  ELSIF o.season <> format('%s-%s', g.season_year, right((g.season_year + 1)::TEXT, 2))
    OR o.season <> '2026-27' THEN rejection_reason := 'Offer season must match the supported game financial season';
  ELSIF o.annual_salary <= 0 OR o.annual_salary > 9007199254740991 OR o.years NOT BETWEEN 1 AND 5 THEN
    rejection_reason := 'Stored offer terms are outside supported bounds';
  ELSIF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = o.player_id AND p.is_active) THEN
    rejection_reason := 'Active explicitly enrolled player required';
  ELSIF NOT EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id
      AND s.player_id = o.player_id AND s.is_active AND s.team_id IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments e
      WHERE e.game_id = p_game_id AND e.player_id = o.player_id AND e.evidence_kind = 'simulation-bootstrap-enrollment')
    OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = o.player_id)
    OR EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = o.player_id)
    OR EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = o.player_id) THEN
    rejection_reason := 'Explicitly enrolled active teamless player without an agreement required';
  END IF;
  IF rejection_reason IS NOT NULL THEN RETURN NEXT; RETURN; END IF;

  -- Missing financial evidence is an integrity error, never a zero-payroll assumption.
  SELECT * INTO STRICT f FROM public.get_free_agency_financial_context(p_game_id, o.player_id, o.team_id);
  IF o.annual_salary < f.minimum_salary OR o.annual_salary > f.maximum_salary THEN
    rejection_reason := 'Salary outside verified minimum and maximum';
  ELSIF f.roster_count + 1 > 15 THEN rejection_reason := 'Roster maximum reached';
  ELSIF o.annual_salary > f.cap_room AND o.annual_salary <> f.minimum_salary THEN
    rejection_reason := 'Offer exceeds cap room';
  ELSE
    SELECT LEAST(100, GREATEST(0, base_rating)) INTO quality FROM public.teams WHERE id = o.team_id;
    -- Same 60/25/15 simulation weights as evaluateFreeAgencyOffer. Duration is not scored in v1.
    score := (o.annual_salary - f.minimum_salary)::NUMERIC / GREATEST(f.minimum_salary, f.maximum_salary) * 60
      + GREATEST(0, 15 - f.roster_count)::NUMERIC / 15 * 25 + quality::NUMERIC / 100 * 15;
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.assess_free_agency_offer(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_free_agency_offer(p_game_id UUID, p_offer_id UUID)
RETURNS public.free_agency_pending_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; o public.free_agency_pending_offers%ROWTYPE;
  assessment RECORD; contract_id UUID; resolved_time TIMESTAMPTZ := clock_timestamp(); updated_count INTEGER;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  SELECT * INTO o FROM public.free_agency_pending_offers
  WHERE id = p_offer_id AND game_id = p_game_id AND owner_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned game offer not found'; END IF;
  IF o.status = 'accepted' THEN
    IF NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.id = o.resolved_contract_id
      AND r.game_id = p_game_id AND r.player_id = o.player_id AND r.source_offer_id = o.id) THEN
      RAISE EXCEPTION 'Accepted offer resolution record is inconsistent';
    END IF;
    RETURN o;
  ELSIF o.status = 'rejected' THEN RETURN o;
  END IF;
  PERFORM 1 FROM public.game_player_states WHERE game_id = p_game_id AND player_id = o.player_id FOR UPDATE;
  SELECT * INTO STRICT assessment FROM public.assess_free_agency_offer(p_game_id, p_offer_id);
  IF assessment.rejection_reason IS NOT NULL THEN RAISE EXCEPTION '%', assessment.rejection_reason; END IF;

  INSERT INTO public.game_runtime_contracts(game_id, player_id, origin_kind, start_year, end_year,
    annual_salary, is_player_option, is_team_option, is_guaranteed, source_offer_id)
  VALUES (p_game_id, o.player_id, 'simulated-agreement', g.season_year, g.season_year + o.years - 1,
    o.annual_salary, false, false, NULL, o.id) RETURNING id INTO contract_id;
  UPDATE public.game_player_states SET team_id = o.team_id, updated_at = now()
  WHERE game_id = p_game_id AND player_id = o.player_id AND team_id IS NULL AND is_active;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN RAISE EXCEPTION 'Roster assignment changed during offer resolution'; END IF;
  UPDATE public.free_agency_pending_offers SET status = 'accepted', resolved_at = resolved_time,
    resolved_date = g.simulation_date, resolution_reason = 'selected_offer_accepted', resolved_contract_id = contract_id
  WHERE id = p_offer_id RETURNING * INTO o;
  UPDATE public.free_agency_pending_offers SET status = 'rejected', resolved_at = resolved_time,
    resolved_date = g.simulation_date, resolution_reason = 'another_offer_accepted'
  WHERE game_id = p_game_id AND player_id = o.player_id AND status = 'pending';
  RETURN o;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_free_agency_offer(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
