BEGIN;

ALTER TABLE public.free_agency_pending_offers
  DROP CONSTRAINT IF EXISTS free_agency_pending_offers_status_check;
ALTER TABLE public.free_agency_pending_offers
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN resolved_date DATE,
  ADD COLUMN resolution_reason TEXT,
  ADD COLUMN resolved_contract_id UUID,
  ADD CONSTRAINT free_agency_pending_offers_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  ADD CONSTRAINT free_agency_pending_offers_resolution_state_check CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_date IS NULL
      AND resolution_reason IS NULL AND resolved_contract_id IS NULL)
    OR (status = 'accepted' AND resolved_at IS NOT NULL AND resolved_date IS NOT NULL
      AND resolution_reason IS NOT DISTINCT FROM 'selected_offer_accepted' AND resolved_contract_id IS NOT NULL)
    OR (status = 'rejected' AND resolved_at IS NOT NULL AND resolved_date IS NOT NULL
      AND resolution_reason IS NOT DISTINCT FROM 'another_offer_accepted' AND resolved_contract_id IS NULL)
  );

ALTER TABLE public.game_runtime_contracts ADD COLUMN source_offer_id UUID;
CREATE UNIQUE INDEX game_runtime_contracts_id_game_player_unique
  ON public.game_runtime_contracts(id, game_id, player_id);
CREATE UNIQUE INDEX free_agency_pending_offers_id_game_player_unique
  ON public.free_agency_pending_offers(id, game_id, player_id);
ALTER TABLE public.game_runtime_contracts
  ADD CONSTRAINT game_runtime_contracts_source_offer_game_player_fkey
    FOREIGN KEY (source_offer_id, game_id, player_id)
    REFERENCES public.free_agency_pending_offers(id, game_id, player_id) ON DELETE RESTRICT;
ALTER TABLE public.free_agency_pending_offers
  ADD CONSTRAINT free_agency_pending_offers_resolved_contract_game_player_fkey
    FOREIGN KEY (resolved_contract_id, game_id, player_id)
    REFERENCES public.game_runtime_contracts(id, game_id, player_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.get_free_agency_financial_context(
  p_game_id UUID,
  p_player_id UUID
)
RETURNS TABLE (
  selected_team_id UUID,
  season_year INTEGER,
  simulation_date DATE,
  salary_cap BIGINT,
  payroll BIGINT,
  cap_room BIGINT,
  roster_count INTEGER,
  service_years INTEGER,
  minimum_salary BIGINT,
  maximum_salary BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_payroll NUMERIC := 0;
BEGIN
  SELECT g.* INTO v_game
  FROM public.games g
  WHERE g.id = p_game_id
    AND g.user_id = auth.uid()
    AND g.status = 'active'
    AND g.season_era_id = 'modern'
    AND g.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id) THEN
    RAISE EXCEPTION 'Materialized contract coverage required';
  END IF;

  SELECT p.* INTO v_player FROM public.players p
  WHERE p.id = p_player_id AND p.is_active;
  IF NOT FOUND OR v_player.years_of_experience IS NULL
     OR v_player.years_of_experience NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Active player with known years of service required';
  END IF;
  IF v_game.season_year <> 2026 THEN
    RAISE EXCEPTION 'Verified minimum salary schedule unavailable for game season';
  END IF;

  -- Keep verified minimums/cap projection aligned with MinimumSalarySchedule and nba-rules.
  service_years := LEAST(v_player.years_of_experience, 10);
  minimum_salary := (ARRAY[
    1357763, 2185116, 2449421, 2537526, 2625627, 2845883,
    3066143, 3286399, 3506659, 3524115, 3876529
  ]::BIGINT[])[service_years + 1];
  salary_cap := round(140588000 * power(1.1, GREATEST(0, v_game.season_year - 2024)))::BIGINT;
  maximum_salary := floor(
    salary_cap * CASE WHEN service_years <= 6 THEN 0.25 WHEN service_years <= 9 THEN 0.30 ELSE 0.35 END
  )::BIGINT;

  IF EXISTS (
    SELECT 1
    FROM public.game_player_states s
    LEFT JOIN public.game_runtime_contracts r
      ON r.game_id = s.game_id AND r.player_id = s.player_id
    LEFT JOIN public.game_contract_identities i
      ON i.game_id = s.game_id AND i.player_id = s.player_id
    LEFT JOIN public.game_contract_agreements a
      ON a.game_id = s.game_id AND a.player_id = s.player_id
    LEFT JOIN public.game_contract_seasons cs
      ON cs.game_id = a.game_id AND cs.agreement_id = a.id
      AND cs.start_year = v_game.season_year
    WHERE s.game_id = p_game_id
      AND s.team_id = v_game.selected_team_id
      AND r.id IS NULL
      AND (
        (i.player_id IS NOT NULL AND i.cap_treatment = 'standard-cap-and-matching'
          AND (a.id IS NULL OR a.cap_treatment <> 'standard-cap-and-matching'
            OR cs.id IS NULL OR cs.salary_amount IS NULL))
        OR (a.id IS NOT NULL AND a.cap_treatment = 'standard-cap-and-matching'
          AND (cs.id IS NULL OR cs.salary_amount IS NULL))
        OR (i.player_id IS NULL AND a.id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.contracts c
          WHERE c.game_id = s.game_id AND c.player_id = s.player_id
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Canonical current-season standard salary context is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contracts c
    JOIN public.game_player_states s ON s.game_id = c.game_id AND s.player_id = c.player_id
    WHERE c.game_id = p_game_id AND s.team_id = v_game.selected_team_id
      AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
      AND NOT EXISTS (SELECT 1 FROM public.game_contract_identities i
        WHERE i.game_id = c.game_id AND i.player_id = c.player_id)
      AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a
        WHERE a.game_id = c.game_id AND a.player_id = c.player_id)
      AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r
        WHERE r.game_id = c.game_id AND r.player_id = c.player_id)
      AND (
        (CASE v_game.season_year - c.start_year
          WHEN 0 THEN c.salary_y1 WHEN 1 THEN c.salary_y2 WHEN 2 THEN c.salary_y3
          WHEN 3 THEN c.salary_y4 WHEN 4 THEN c.salary_y5 ELSE NULL END) IS NULL
        OR (CASE v_game.season_year - c.start_year
          WHEN 0 THEN c.salary_y1 WHEN 1 THEN c.salary_y2 WHEN 2 THEN c.salary_y3
          WHEN 3 THEN c.salary_y4 WHEN 4 THEN c.salary_y5 ELSE NULL END) < 0
      )
  ) THEN
    RAISE EXCEPTION 'Legacy current-season salary context is incomplete';
  END IF;

  SELECT COALESCE(sum(cs.salary_amount), 0) INTO v_payroll
  FROM public.game_contract_agreements a
  JOIN public.game_contract_seasons cs ON cs.game_id = a.game_id AND cs.agreement_id = a.id
    AND cs.start_year = v_game.season_year
  JOIN public.game_player_states s ON s.game_id = a.game_id AND s.player_id = a.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE a.game_id = p_game_id
    AND a.cap_treatment = 'standard-cap-and-matching'
    AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r
      WHERE r.game_id = a.game_id AND r.player_id = a.player_id);

  SELECT v_payroll + COALESCE(sum(r.annual_salary), 0) INTO v_payroll
  FROM public.game_runtime_contracts r
  JOIN public.game_player_states s ON s.game_id = r.game_id AND s.player_id = r.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE r.game_id = p_game_id
    AND r.start_year <= v_game.season_year AND r.end_year >= v_game.season_year;

  SELECT v_payroll + COALESCE(sum(
    CASE v_game.season_year - c.start_year
      WHEN 0 THEN c.salary_y1 WHEN 1 THEN c.salary_y2 WHEN 2 THEN c.salary_y3
      WHEN 3 THEN c.salary_y4 WHEN 4 THEN c.salary_y5 ELSE 0 END
  ), 0) INTO v_payroll
  FROM public.contracts c
  JOIN public.game_player_states s ON s.game_id = c.game_id AND s.player_id = c.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE c.game_id = p_game_id
    AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_identities i
      WHERE i.game_id = c.game_id AND i.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a
      WHERE a.game_id = c.game_id AND a.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r
      WHERE r.game_id = c.game_id AND r.player_id = c.player_id);

  IF v_payroll < 0 OR v_payroll > 9007199254740991 THEN
    RAISE EXCEPTION 'Current payroll is outside supported safe integer range';
  END IF;
  SELECT count(*)::INTEGER INTO roster_count
  FROM public.game_player_states s
  WHERE s.game_id = p_game_id AND s.team_id = v_game.selected_team_id AND s.is_active;

  selected_team_id := v_game.selected_team_id;
  season_year := v_game.season_year;
  simulation_date := v_game.simulation_date;
  payroll := v_payroll::BIGINT;
  cap_room := GREATEST(0, salary_cap - payroll);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_agency_financial_context(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_free_agency_offer(
  p_game_id UUID, p_player_id UUID, p_request_id UUID, p_season TEXT,
  p_annual_salary BIGINT, p_years INTEGER
) RETURNS public.free_agency_pending_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_state public.game_player_states%ROWTYPE;
  v_existing public.free_agency_pending_offers%ROWTYPE;
  v_offer public.free_agency_pending_offers%ROWTYPE;
  v_financial RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_request_id IS NULL OR p_player_id IS NULL OR p_game_id IS NULL
     OR p_annual_salary IS NULL OR p_annual_salary <= 0 OR p_annual_salary > 9007199254740991
     OR p_years IS NULL OR p_years NOT BETWEEN 1 AND 5
     OR p_season IS NULL OR p_season !~ '^\d{4}-\d{2}$'
     OR split_part(p_season, '-', 2)::INTEGER <> (split_part(p_season, '-', 1)::INTEGER + 1) % 100 THEN
    RAISE EXCEPTION 'Invalid offer terms';
  END IF;

  SELECT g.* INTO v_game FROM public.games g
  WHERE g.id = p_game_id AND g.user_id = auth.uid()
    AND g.status = 'active' AND g.season_era_id = 'modern' AND g.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active game required'; END IF;

  SELECT o.* INTO v_existing FROM public.free_agency_pending_offers o
  WHERE o.owner_id = auth.uid() AND o.game_id = p_game_id AND o.request_id = p_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF (v_existing.player_id, v_existing.team_id, v_existing.season, v_existing.annual_salary, v_existing.years)
       IS DISTINCT FROM (p_player_id, v_game.selected_team_id, p_season, p_annual_salary, p_years) THEN
      RAISE EXCEPTION 'Idempotency key reused with changed offer payload';
    END IF;
    IF v_existing.status <> 'pending' THEN RAISE EXCEPTION 'Offer request has already been resolved'; END IF;
    RETURN v_existing;
  END IF;

  SELECT p.* INTO v_player FROM public.players p WHERE p.id = p_player_id AND p.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Explicitly enrolled active teamless player required'; END IF;
  SELECT s.* INTO v_state FROM public.game_player_states s
  WHERE s.game_id = p_game_id AND s.player_id = p_player_id FOR UPDATE;
  IF NOT FOUND OR NOT v_state.is_active OR v_state.team_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments e
       WHERE e.game_id = p_game_id AND e.player_id = p_player_id
         AND e.evidence_kind = 'simulation-bootstrap-enrollment')
     OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = p_player_id)
     OR EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = p_player_id)
     OR EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = p_player_id) THEN
    RAISE EXCEPTION 'Explicitly enrolled active teamless player without a game agreement required';
  END IF;

  SELECT f.* INTO v_financial
  FROM public.get_free_agency_financial_context(p_game_id, p_player_id) f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Authoritative financial context unavailable'; END IF;
  IF p_season <> format('%s-%s', v_financial.season_year, right((v_financial.season_year + 1)::TEXT, 2))
     OR p_season <> '2026-27' THEN
    RAISE EXCEPTION 'Offer season must match the supported game financial season';
  END IF;
  IF p_annual_salary < v_financial.minimum_salary OR p_annual_salary > v_financial.maximum_salary THEN
    RAISE EXCEPTION 'Salary outside verified minimum and maximum';
  END IF;
  IF v_financial.roster_count + 1 > 15 THEN RAISE EXCEPTION 'Roster maximum reached'; END IF;
  IF p_annual_salary > v_financial.cap_room AND p_annual_salary <> v_financial.minimum_salary THEN
    RAISE EXCEPTION 'Offer exceeds cap room';
  END IF;

  INSERT INTO public.free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id,
    season, annual_salary, years, due_date)
  VALUES (p_request_id, auth.uid(), p_game_id, p_player_id, v_financial.selected_team_id,
    p_season, p_annual_salary, p_years, v_financial.simulation_date + 1)
  RETURNING * INTO v_offer;
  RETURN v_offer;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER)
  TO authenticated;

COMMIT;
