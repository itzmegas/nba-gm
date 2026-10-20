BEGIN;

-- Market reads, human submissions and AI assessment share standard roster slots.
CREATE OR REPLACE FUNCTION public.get_free_agency_financial_context(
  p_game_id UUID, p_player_id UUID, p_team_id UUID
) RETURNS TABLE (
  selected_team_id UUID, season_year INTEGER, simulation_date DATE, salary_cap BIGINT,
  payroll BIGINT, cap_room BIGINT, roster_count INTEGER, service_years INTEGER,
  minimum_salary BIGINT, maximum_salary BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_game public.games%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_payroll NUMERIC := 0;
BEGIN
  SELECT g.* INTO v_game FROM public.games g
  WHERE g.id = p_game_id AND g.user_id = auth.uid() AND g.status = 'active'
    AND g.season_era_id = 'modern' AND g.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  IF p_team_id IS NULL OR NOT (
    p_team_id = v_game.selected_team_id
    OR EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id AND s.team_id = p_team_id)
    OR EXISTS (SELECT 1 FROM public.league_standings s WHERE s.game_id = p_game_id AND s.team_id = p_team_id)
  ) THEN RAISE EXCEPTION 'Team does not participate in this game'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id) THEN
    RAISE EXCEPTION 'Materialized contract coverage required';
  END IF;
  v_game.selected_team_id := p_team_id;
  SELECT p.* INTO v_player FROM public.players p WHERE p.id = p_player_id AND p.is_active;
  IF NOT FOUND OR v_player.years_of_experience IS NULL
     OR v_player.years_of_experience NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Active player with known years of service required';
  END IF;
  IF v_game.season_year <> 2026 THEN
    RAISE EXCEPTION 'Verified minimum salary schedule unavailable for game season';
  END IF;
  service_years := LEAST(v_player.years_of_experience, 10);
  minimum_salary := (ARRAY[
    1357763, 2185116, 2449421, 2537526, 2625627, 2845883,
    3066143, 3286399, 3506659, 3524115, 3876529
  ]::BIGINT[])[service_years + 1];
  salary_cap := round(140588000 * power(1.1, GREATEST(0, v_game.season_year - 2024)))::BIGINT;
  maximum_salary := floor(salary_cap * CASE WHEN service_years <= 6 THEN 0.25
    WHEN service_years <= 9 THEN 0.30 ELSE 0.35 END)::BIGINT;

  IF EXISTS (
    SELECT 1 FROM public.game_player_states s
    LEFT JOIN public.game_runtime_contracts r ON r.game_id = s.game_id AND r.player_id = s.player_id
    LEFT JOIN public.game_contract_identities i ON i.game_id = s.game_id AND i.player_id = s.player_id
    LEFT JOIN public.game_contract_agreements a ON a.game_id = s.game_id AND a.player_id = s.player_id
    LEFT JOIN public.game_contract_seasons cs ON cs.game_id = a.game_id AND cs.agreement_id = a.id
      AND cs.start_year = v_game.season_year
    WHERE s.game_id = p_game_id AND s.team_id = v_game.selected_team_id AND r.id IS NULL
      AND (
        (i.player_id IS NOT NULL AND i.cap_treatment = 'standard-cap-and-matching'
          AND (a.id IS NULL OR a.cap_treatment <> 'standard-cap-and-matching'
            OR cs.id IS NULL OR cs.salary_amount IS NULL))
        OR (a.id IS NOT NULL AND a.cap_treatment = 'standard-cap-and-matching'
          AND (cs.id IS NULL OR cs.salary_amount IS NULL))
        OR (i.player_id IS NULL AND a.id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.contracts c WHERE c.game_id = s.game_id AND c.player_id = s.player_id
        ))
      )
  ) THEN RAISE EXCEPTION 'Canonical current-season standard salary context is incomplete'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.contracts c
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
  ) THEN RAISE EXCEPTION 'Legacy current-season salary context is incomplete'; END IF;

  SELECT COALESCE(sum(cs.salary_amount), 0) INTO v_payroll
  FROM public.game_contract_agreements a
  JOIN public.game_contract_seasons cs ON cs.game_id = a.game_id AND cs.agreement_id = a.id
    AND cs.start_year = v_game.season_year
  JOIN public.game_player_states s ON s.game_id = a.game_id AND s.player_id = a.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE a.game_id = p_game_id AND a.cap_treatment = 'standard-cap-and-matching'
    AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r
      WHERE r.game_id = a.game_id AND r.player_id = a.player_id);

  SELECT v_payroll + COALESCE(sum(r.annual_salary), 0) INTO v_payroll
  FROM public.game_runtime_contracts r
  JOIN public.game_player_states s ON s.game_id = r.game_id AND s.player_id = r.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE r.game_id = p_game_id AND r.start_year <= v_game.season_year AND r.end_year >= v_game.season_year;

  SELECT v_payroll + COALESCE(sum(
    CASE v_game.season_year - c.start_year
      WHEN 0 THEN c.salary_y1 WHEN 1 THEN c.salary_y2 WHEN 2 THEN c.salary_y3
      WHEN 3 THEN c.salary_y4 WHEN 4 THEN c.salary_y5 ELSE 0 END
  ), 0) INTO v_payroll
  FROM public.contracts c
  JOIN public.game_player_states s ON s.game_id = c.game_id AND s.player_id = c.player_id
    AND s.team_id = v_game.selected_team_id
  WHERE c.game_id = p_game_id AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_identities i
      WHERE i.game_id = c.game_id AND i.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a
      WHERE a.game_id = c.game_id AND a.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r
      WHERE r.game_id = c.game_id AND r.player_id = c.player_id);
  IF v_payroll < 0 OR v_payroll > 9007199254740991 THEN
    RAISE EXCEPTION 'Current payroll is outside supported safe integer range';
  END IF;
  SELECT count(*)::INTEGER INTO roster_count FROM public.game_player_states s
  LEFT JOIN public.game_contract_identities i ON i.game_id = s.game_id AND i.player_id = s.player_id
  LEFT JOIN public.game_runtime_contracts r ON r.game_id = s.game_id AND r.player_id = s.player_id
  WHERE s.game_id = p_game_id AND s.team_id = v_game.selected_team_id AND s.is_active
    AND (r.id IS NOT NULL OR COALESCE(i.cap_treatment, 'standard-cap-and-matching')
      NOT IN ('excluded-two-way', 'excluded-inactive'));
  selected_team_id := v_game.selected_team_id;
  season_year := v_game.season_year;
  simulation_date := v_game.simulation_date;
  payroll := v_payroll::BIGINT;
  cap_room := GREATEST(0, salary_cap - payroll);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_agency_financial_context(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
