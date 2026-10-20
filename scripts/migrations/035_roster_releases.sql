BEGIN;

-- Releases are runtime events. Imported agreement/identity snapshots remain immutable.
CREATE TABLE public.game_roster_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  contract_id UUID,
  contract_origin TEXT NOT NULL CHECK (contract_origin IN ('observed', 'simulated')),
  salary_by_year JSONB NOT NULL CHECK (jsonb_typeof(salary_by_year) = 'object'),
  released_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, request_id)
);
CREATE INDEX game_roster_releases_player ON public.game_roster_releases(game_id, player_id);
ALTER TABLE public.game_roster_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_roster_releases_owner_read ON public.game_roster_releases
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = game_id AND g.user_id = auth.uid()
  ));
REVOKE ALL ON public.game_roster_releases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_roster_releases TO authenticated;

-- Aggregate in PostgreSQL so PostgREST's row limit cannot truncate cap charges.
CREATE FUNCTION public.get_roster_release_cap_charge(p_game_id UUID, p_team_id UUID, p_season_year INTEGER)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(sum((salary_by_year ->> p_season_year::TEXT)::BIGINT), 0)::BIGINT
  FROM public.game_roster_releases WHERE game_id = p_game_id AND team_id = p_team_id;
$$;
REVOKE ALL ON FUNCTION public.get_roster_release_cap_charge(UUID, UUID, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_roster_release_cap_charge(UUID, UUID, INTEGER) TO authenticated;

ALTER TABLE public.game_runtime_contracts ADD COLUMN released_at TIMESTAMPTZ;
ALTER TABLE public.game_runtime_contracts DROP CONSTRAINT game_runtime_contracts_game_id_player_id_key;
CREATE UNIQUE INDEX game_runtime_contracts_one_active_player
  ON public.game_runtime_contracts(game_id, player_id) WHERE released_at IS NULL;
CREATE VIEW public.game_active_runtime_contracts WITH (security_invoker = true) AS
  SELECT * FROM public.game_runtime_contracts WHERE released_at IS NULL;
REVOKE ALL ON public.game_active_runtime_contracts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.game_active_runtime_contracts TO authenticated;

-- This predicate is shared by market reads, human submissions and AI decisions.
CREATE FUNCTION public.is_available_free_agent(p_game_id UUID, p_player_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.game_player_states s JOIN public.players p ON p.id = s.player_id
    WHERE s.game_id = p_game_id AND s.player_id = p_player_id
      AND s.team_id IS NULL AND s.is_active AND p.is_active)
    AND (EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments e
      WHERE e.game_id = p_game_id AND e.player_id = p_player_id)
      OR EXISTS (SELECT 1 FROM public.game_roster_releases x
        WHERE x.game_id = p_game_id AND x.player_id = p_player_id))
    AND NOT EXISTS (SELECT 1 FROM public.game_active_runtime_contracts r
      WHERE r.game_id = p_game_id AND r.player_id = p_player_id)
    AND (EXISTS (SELECT 1 FROM public.game_roster_releases x
        WHERE x.game_id = p_game_id AND x.player_id = p_player_id AND x.contract_origin = 'observed')
      OR (NOT EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = p_player_id)
        AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a
          WHERE a.game_id = p_game_id AND a.player_id = p_player_id)));
$$;
REVOKE ALL ON FUNCTION public.is_available_free_agent(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.release_roster_player(
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
          AND agreement_id = a.id AND start_year = g.season_year AND salary_amount IS NOT NULL)
          OR EXISTS (SELECT 1 FROM public.game_contract_seasons WHERE game_id = p_game_id
            AND agreement_id = a.id AND start_year >= g.season_year AND salary_amount IS NULL) THEN
          RAISE EXCEPTION 'Release salary coverage is incomplete';
        END IF;
        -- ponytail: unknown/partial guarantees retain full salary; no stretch or set-off in v1.
        SELECT jsonb_object_agg(start_year::TEXT, CASE WHEN guarantee_kind = 'not-guaranteed' THEN 0 ELSE salary_amount END)
        INTO salaries FROM public.game_contract_seasons
        WHERE game_id = p_game_id AND agreement_id = a.id AND start_year >= g.season_year;
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

CREATE OR REPLACE FUNCTION public.get_free_agency_financial_context(
  p_game_id UUID, p_player_id UUID, p_team_id UUID
) RETURNS TABLE (
  selected_team_id UUID, season_year INTEGER, simulation_date DATE, salary_cap BIGINT,
  payroll BIGINT, cap_room BIGINT, roster_count INTEGER, service_years INTEGER,
  minimum_salary BIGINT, maximum_salary BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_game public.games%ROWTYPE; v_player public.players%ROWTYPE; v_payroll NUMERIC := 0;
BEGIN
  SELECT g.* INTO v_game FROM public.games g
  WHERE g.id = p_game_id AND g.user_id = auth.uid() AND g.status = 'active'
    AND g.season_era_id = 'modern' AND g.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  IF p_team_id IS NULL OR NOT (p_team_id = v_game.selected_team_id
    OR EXISTS (SELECT 1 FROM public.game_player_states s WHERE s.game_id = p_game_id AND s.team_id = p_team_id)
    OR EXISTS (SELECT 1 FROM public.league_standings s WHERE s.game_id = p_game_id AND s.team_id = p_team_id)
  ) THEN RAISE EXCEPTION 'Team does not participate in this game'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id) THEN
    RAISE EXCEPTION 'Materialized contract coverage required';
  END IF;
  SELECT p.* INTO v_player FROM public.players p WHERE p.id = p_player_id AND p.is_active;
  IF NOT FOUND OR v_player.years_of_experience IS NULL OR v_player.years_of_experience NOT BETWEEN 0 AND 99 THEN
    RAISE EXCEPTION 'Active player with known years of service required';
  END IF;
  IF v_game.season_year <> 2026 THEN RAISE EXCEPTION 'Verified minimum salary schedule unavailable for game season'; END IF;
  service_years := LEAST(v_player.years_of_experience, 10);
  minimum_salary := (ARRAY[1357763,2185116,2449421,2537526,2625627,2845883,3066143,3286399,3506659,3524115,3876529]::BIGINT[])[service_years + 1];
  salary_cap := round(140588000 * power(1.1, GREATEST(0, v_game.season_year - 2024)))::BIGINT;
  maximum_salary := floor(salary_cap * CASE WHEN service_years <= 6 THEN 0.25 WHEN service_years <= 9 THEN 0.30 ELSE 0.35 END)::BIGINT;
  IF EXISTS (
    SELECT 1 FROM public.game_player_states s
    LEFT JOIN public.game_active_runtime_contracts r ON r.game_id = s.game_id AND r.player_id = s.player_id
    LEFT JOIN public.game_contract_identities i ON i.game_id = s.game_id AND i.player_id = s.player_id
    LEFT JOIN public.game_contract_agreements a ON a.game_id = s.game_id AND a.player_id = s.player_id
    LEFT JOIN public.game_contract_seasons cs ON cs.game_id = a.game_id AND cs.agreement_id = a.id AND cs.start_year = v_game.season_year
    WHERE s.game_id = p_game_id AND s.team_id = p_team_id AND r.id IS NULL AND (
      (i.player_id IS NOT NULL AND i.cap_treatment = 'standard-cap-and-matching'
        AND (a.id IS NULL OR a.cap_treatment <> 'standard-cap-and-matching' OR cs.id IS NULL OR cs.salary_amount IS NULL))
      OR (a.id IS NOT NULL AND a.cap_treatment = 'standard-cap-and-matching' AND (cs.id IS NULL OR cs.salary_amount IS NULL))
      OR (i.player_id IS NULL AND a.id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.contracts c WHERE c.game_id = s.game_id AND c.player_id = s.player_id))
    )
  ) THEN RAISE EXCEPTION 'Canonical current-season standard salary context is incomplete'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.contracts c JOIN public.game_player_states s ON s.game_id = c.game_id AND s.player_id = c.player_id
    WHERE c.game_id = p_game_id AND s.team_id = p_team_id AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
      AND NOT EXISTS (SELECT 1 FROM public.game_contract_identities i WHERE i.game_id = c.game_id AND i.player_id = c.player_id)
      AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = c.game_id AND a.player_id = c.player_id)
      AND NOT EXISTS (SELECT 1 FROM public.game_active_runtime_contracts r WHERE r.game_id = c.game_id AND r.player_id = c.player_id)
      AND (COALESCE((ARRAY[c.salary_y1,c.salary_y2,c.salary_y3,c.salary_y4,c.salary_y5])[v_game.season_year-c.start_year+1], -1) < 0)
  ) THEN RAISE EXCEPTION 'Legacy current-season salary context is incomplete'; END IF;
  SELECT COALESCE(sum(cs.salary_amount), 0) INTO v_payroll
  FROM public.game_contract_agreements a
  JOIN public.game_contract_seasons cs ON cs.game_id = a.game_id AND cs.agreement_id = a.id AND cs.start_year = v_game.season_year
  JOIN public.game_player_states s ON s.game_id = a.game_id AND s.player_id = a.player_id AND s.team_id = p_team_id
  WHERE a.game_id = p_game_id AND a.cap_treatment = 'standard-cap-and-matching'
    AND NOT EXISTS (SELECT 1 FROM public.game_active_runtime_contracts r WHERE r.game_id = a.game_id AND r.player_id = a.player_id);
  SELECT v_payroll + COALESCE(sum(r.annual_salary), 0) INTO v_payroll
  FROM public.game_active_runtime_contracts r
  JOIN public.game_player_states s ON s.game_id = r.game_id AND s.player_id = r.player_id AND s.team_id = p_team_id
  WHERE r.game_id = p_game_id AND r.start_year <= v_game.season_year AND r.end_year >= v_game.season_year;
  SELECT v_payroll + COALESCE(sum((ARRAY[c.salary_y1,c.salary_y2,c.salary_y3,c.salary_y4,c.salary_y5])[v_game.season_year-c.start_year+1]), 0)
  INTO v_payroll FROM public.contracts c
  JOIN public.game_player_states s ON s.game_id = c.game_id AND s.player_id = c.player_id AND s.team_id = p_team_id
  WHERE c.game_id = p_game_id AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_identities i WHERE i.game_id = c.game_id AND i.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = c.game_id AND a.player_id = c.player_id)
    AND NOT EXISTS (SELECT 1 FROM public.game_active_runtime_contracts r WHERE r.game_id = c.game_id AND r.player_id = c.player_id);
  SELECT v_payroll + COALESCE(sum((x.salary_by_year ->> v_game.season_year::TEXT)::BIGINT), 0) INTO v_payroll
  FROM public.game_roster_releases x WHERE x.game_id = p_game_id AND x.team_id = p_team_id;
  IF v_payroll < 0 OR v_payroll > 9007199254740991 THEN RAISE EXCEPTION 'Current payroll is outside supported safe integer range'; END IF;
  SELECT count(*)::INTEGER INTO roster_count FROM public.game_player_states s
  LEFT JOIN public.game_contract_identities i ON i.game_id = s.game_id AND i.player_id = s.player_id
  LEFT JOIN public.game_active_runtime_contracts r ON r.game_id = s.game_id AND r.player_id = s.player_id
  WHERE s.game_id = p_game_id AND s.team_id = p_team_id AND s.is_active
    AND (r.id IS NOT NULL OR COALESCE(i.cap_treatment, 'standard-cap-and-matching') NOT IN ('excluded-two-way', 'excluded-inactive'));
  selected_team_id := p_team_id; season_year := v_game.season_year; simulation_date := v_game.simulation_date;
  payroll := v_payroll::BIGINT; cap_room := GREATEST(0, salary_cap - payroll);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_agency_financial_context(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_free_agency_offer(
  p_game_id UUID, p_player_id UUID, p_request_id UUID, p_season TEXT, p_annual_salary BIGINT, p_years INTEGER
) RETURNS public.free_agency_pending_offers LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; existing public.free_agency_pending_offers%ROWTYPE;
  result public.free_agency_pending_offers%ROWTYPE; f RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_request_id IS NULL OR p_player_id IS NULL OR p_game_id IS NULL
    OR p_annual_salary IS NULL OR p_annual_salary <= 0 OR p_annual_salary > 9007199254740991
    OR p_years IS NULL OR p_years NOT BETWEEN 1 AND 5 OR p_season IS NULL OR p_season !~ '^\d{4}-\d{2}$'
    OR split_part(p_season, '-', 2)::INTEGER <> (split_part(p_season, '-', 1)::INTEGER + 1) % 100 THEN
    RAISE EXCEPTION 'Invalid offer terms';
  END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active game required'; END IF;
  SELECT * INTO existing FROM public.free_agency_pending_offers
  WHERE owner_id = auth.uid() AND game_id = p_game_id AND request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF (existing.player_id, existing.team_id, existing.season, existing.annual_salary, existing.years)
      IS DISTINCT FROM (p_player_id, g.selected_team_id, p_season, p_annual_salary, p_years) THEN
      RAISE EXCEPTION 'Idempotency key reused with changed offer payload';
    END IF;
    IF existing.status <> 'pending' THEN RAISE EXCEPTION 'Offer request has already been resolved'; END IF;
    RETURN existing;
  END IF;
  PERFORM 1 FROM public.game_player_states WHERE game_id = p_game_id AND player_id = p_player_id FOR UPDATE;
  IF NOT public.is_available_free_agent(p_game_id, p_player_id) THEN
    RAISE EXCEPTION 'Explicitly enrolled active teamless player without a game agreement required';
  END IF;
  SELECT * INTO STRICT f FROM public.get_free_agency_financial_context(p_game_id, p_player_id);
  IF p_season <> format('%s-%s', f.season_year, right((f.season_year + 1)::TEXT, 2)) OR p_season <> '2026-27' THEN
    RAISE EXCEPTION 'Offer season must match the supported game financial season';
  END IF;
  IF p_annual_salary < f.minimum_salary OR p_annual_salary > f.maximum_salary THEN RAISE EXCEPTION 'Salary outside verified minimum and maximum'; END IF;
  IF f.roster_count + 1 > 15 THEN RAISE EXCEPTION 'Roster maximum reached'; END IF;
  IF p_annual_salary > f.cap_room AND p_annual_salary <> f.minimum_salary THEN RAISE EXCEPTION 'Offer exceeds cap room'; END IF;
  INSERT INTO public.free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id, season, annual_salary, years, due_date)
  VALUES (p_request_id, auth.uid(), p_game_id, p_player_id, f.selected_team_id, p_season, p_annual_salary, p_years, f.simulation_date + 1)
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.assess_free_agency_offer(p_game_id UUID, p_offer_id UUID)
RETURNS TABLE (rejection_reason TEXT, score NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; o public.free_agency_pending_offers%ROWTYPE; f RECORD; quality INTEGER;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  SELECT * INTO o FROM public.free_agency_pending_offers WHERE game_id = p_game_id AND id = p_offer_id AND owner_id = auth.uid();
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
  ELSIF o.season <> format('%s-%s', g.season_year, right((g.season_year + 1)::TEXT, 2)) OR o.season <> '2026-27' THEN
    rejection_reason := 'Offer season must match the supported game financial season';
  ELSIF o.annual_salary <= 0 OR o.annual_salary > 9007199254740991 OR o.years NOT BETWEEN 1 AND 5 THEN
    rejection_reason := 'Stored offer terms are outside supported bounds';
  ELSIF NOT public.is_available_free_agent(p_game_id, o.player_id) THEN
    rejection_reason := 'Explicitly enrolled active teamless player without an agreement required';
  END IF;
  IF rejection_reason IS NOT NULL THEN RETURN NEXT; RETURN; END IF;
  SELECT * INTO STRICT f FROM public.get_free_agency_financial_context(p_game_id, o.player_id, o.team_id);
  IF o.annual_salary < f.minimum_salary OR o.annual_salary > f.maximum_salary THEN
    rejection_reason := 'Salary outside verified minimum and maximum';
  ELSIF f.roster_count + 1 > 15 THEN rejection_reason := 'Roster maximum reached';
  ELSIF o.annual_salary > f.cap_room AND o.annual_salary <> f.minimum_salary THEN rejection_reason := 'Offer exceeds cap room';
  ELSE
    SELECT LEAST(100, GREATEST(0, base_rating)) INTO quality FROM public.teams WHERE id = o.team_id;
    score := (o.annual_salary - f.minimum_salary)::NUMERIC / GREATEST(f.minimum_salary, f.maximum_salary) * 60
      + GREATEST(0, 15 - f.roster_count)::NUMERIC / 15 * 25 + quality::NUMERIC / 100 * 15;
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.assess_free_agency_offer(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_ai_free_agency_offers(p_game_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; team UUID; player UUID; f RECORD;
  salary BIGINT; offer_id UUID; inserted INTEGER; total INTEGER := 0;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  FOR team IN SELECT s.team_id FROM public.game_player_states s WHERE s.game_id = p_game_id AND s.team_id IS NOT NULL
    UNION SELECT s.team_id FROM public.league_standings s WHERE s.game_id = p_game_id ORDER BY team_id
  LOOP
    IF team = g.selected_team_id OR EXISTS (SELECT 1 FROM public.free_agency_pending_offers o
      WHERE o.game_id = p_game_id AND o.team_id = team AND o.offer_origin = 'ai' AND o.ai_decision_date = g.simulation_date) THEN CONTINUE; END IF;
    FOR player IN SELECT s.player_id FROM public.game_player_states s JOIN public.players p ON p.id = s.player_id
      WHERE s.game_id = p_game_id AND p.years_of_experience BETWEEN 0 AND 99
        AND public.is_available_free_agent(p_game_id, s.player_id)
        AND NOT EXISTS (SELECT 1 FROM public.free_agency_pending_offers o WHERE o.game_id = p_game_id
          AND o.player_id = s.player_id AND o.team_id = team AND o.status = 'pending') ORDER BY s.player_id
    LOOP
      SELECT * INTO STRICT f FROM public.get_free_agency_financial_context(p_game_id, player, team);
      IF f.roster_count >= 15 THEN EXIT; END IF;
      salary := CASE WHEN f.cap_room >= floor(f.minimum_salary * 1.10)
        THEN LEAST(f.maximum_salary, floor(f.minimum_salary * 1.10)::BIGINT) ELSE f.minimum_salary END;
      offer_id := md5('free-agency-ai-v1:' || p_game_id::TEXT || ':' || g.simulation_date::TEXT || ':' || team::TEXT)::UUID;
      INSERT INTO public.free_agency_pending_offers(id, request_id, owner_id, game_id, player_id, team_id,
        season, annual_salary, years, due_date, offer_origin, ai_decision_date)
      VALUES (offer_id, gen_random_uuid(), g.user_id, p_game_id, player, team,
        format('%s-%s', g.season_year, right((g.season_year + 1)::TEXT, 2)), salary, 1, g.simulation_date + 1, 'ai', g.simulation_date)
      ON CONFLICT (game_id, team_id, ai_decision_date) WHERE offer_origin = 'ai' DO NOTHING;
      GET DIAGNOSTICS inserted = ROW_COUNT;
      total := total + inserted;
      EXIT;
    END LOOP;
  END LOOP;
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_ai_free_agency_offers(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_free_agency_market(p_game_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g public.games%ROWTYPE; ready BOOLEAN; finance RECORD; result JSONB; candidates JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned game not found'; END IF;
  ready := g.status = 'active' AND g.season_era_id = 'modern' AND g.season_year = 2026
    AND EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id);
  result := jsonb_build_object('game_id', g.id, 'supported', ready, 'context', NULL, 'candidates', '[]'::jsonb,
    'offers', COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object(
      'player_name', concat_ws(' ', p.first_name, p.last_name), 'team_name', t.name) ORDER BY o.created_at DESC, o.id DESC)
      FROM public.free_agency_pending_offers o LEFT JOIN public.players p ON p.id = o.player_id
      LEFT JOIN public.teams t ON t.id = o.team_id WHERE o.game_id = p_game_id AND o.owner_id = auth.uid()), '[]'::jsonb));
  IF NOT ready THEN RETURN result; END IF;
  SELECT f.* INTO finance FROM public.game_player_states s JOIN public.players p ON p.id = s.player_id
    AND p.is_active AND p.years_of_experience BETWEEN 0 AND 99
  CROSS JOIN LATERAL public.get_free_agency_financial_context(p_game_id, p.id, g.selected_team_id) f
  WHERE s.game_id = p_game_id ORDER BY s.player_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active player with known years of service required for market context'; END IF;
  result := jsonb_set(result, '{context}', jsonb_build_object('team_id', finance.selected_team_id,
    'season', format('%s-%s', finance.season_year, right((finance.season_year + 1)::TEXT, 2)),
    'simulation_date', finance.simulation_date, 'salary_cap', finance.salary_cap,
    'payroll', finance.payroll, 'cap_room', finance.cap_room, 'roster_count', finance.roster_count));
  IF EXISTS (SELECT 1 FROM public.game_player_states s JOIN public.players p ON p.id = s.player_id
    WHERE s.game_id = p_game_id AND public.is_available_free_agent(p_game_id, p.id)
      AND (p.years_of_experience IS NULL OR p.years_of_experience NOT BETWEEN 0 AND 99)) THEN
    RAISE EXCEPTION 'Active player with known years of service required';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('player_id', p.id, 'first_name', p.first_name,
    'last_name', p.last_name, 'position', p.position, 'minimum_salary', f.minimum_salary, 'maximum_salary', f.maximum_salary)
    ORDER BY p.id), '[]'::jsonb) INTO candidates
  FROM public.game_player_states s JOIN public.players p ON p.id = s.player_id
  CROSS JOIN LATERAL public.get_free_agency_financial_context(p_game_id, p.id, g.selected_team_id) f
  WHERE s.game_id = p_game_id AND public.is_available_free_agent(p_game_id, p.id)
    AND p.years_of_experience BETWEEN 0 AND 99;
  RETURN jsonb_set(result, '{candidates}', candidates);
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_agency_market(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_agency_market(UUID) TO authenticated;

COMMIT;
