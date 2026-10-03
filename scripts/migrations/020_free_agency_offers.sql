BEGIN;

CREATE TABLE IF NOT EXISTS free_agency_availability_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind = 'simulation-bootstrap-enrollment'),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS free_agency_pending_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  season TEXT NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  annual_salary BIGINT NOT NULL CHECK (annual_salary > 0),
  years INTEGER NOT NULL CHECK (years BETWEEN 1 AND 5),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, game_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_free_agency_pending_offers_game_status
  ON free_agency_pending_offers(game_id, status, due_date);

ALTER TABLE free_agency_availability_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_agency_pending_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE free_agency_availability_enrollments, free_agency_pending_offers
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE free_agency_pending_offers TO authenticated;
CREATE POLICY free_agency_pending_offers_owner_read ON free_agency_pending_offers
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION enroll_simulated_free_agents(p_game_id UUID, p_player_ids UUID[])
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF p_player_ids IS NULL OR cardinality(p_player_ids) = 0
     OR cardinality(ARRAY(SELECT DISTINCT unnest(p_player_ids))) <> cardinality(p_player_ids) THEN
    RAISE EXCEPTION 'Explicit unique player ids are required';
  END IF;
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_game.status <> 'active' OR v_game.season_era_id <> 'modern' OR v_game.deleted_at IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM game_contract_materializations WHERE game_id = p_game_id) THEN
    RAISE EXCEPTION 'Active game with materialized contract coverage required';
  END IF;
  FOREACH v_player_id IN ARRAY p_player_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM players p WHERE p.id = v_player_id AND p.is_active)
       OR EXISTS (SELECT 1 FROM contracts c WHERE c.game_id = p_game_id AND c.player_id = v_player_id)
       OR EXISTS (SELECT 1 FROM game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = v_player_id) THEN
      RAISE EXCEPTION 'Player is inactive or has a current game agreement';
    END IF;
    INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
    VALUES (p_game_id, v_player_id, NULL, true)
    ON CONFLICT (game_id, player_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM game_player_states s WHERE s.game_id = p_game_id
      AND s.player_id = v_player_id AND s.team_id IS NULL AND s.is_active) THEN
      RAISE EXCEPTION 'Player is not active and teamless in this game';
    END IF;
    INSERT INTO free_agency_availability_enrollments(game_id, player_id, evidence_kind)
    VALUES (p_game_id, v_player_id, 'simulation-bootstrap-enrollment')
    ON CONFLICT (game_id, player_id) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION enroll_simulated_free_agents(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enroll_simulated_free_agents(UUID, UUID[]) TO service_role;

CREATE OR REPLACE FUNCTION submit_free_agency_offer(
  p_game_id UUID, p_player_id UUID, p_request_id UUID, p_season TEXT,
  p_annual_salary BIGINT, p_years INTEGER
) RETURNS free_agency_pending_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
  v_player players%ROWTYPE;
  v_state game_player_states%ROWTYPE;
  v_existing free_agency_pending_offers%ROWTYPE;
  v_offer free_agency_pending_offers%ROWTYPE;
  v_payroll BIGINT;
  v_minimum BIGINT;
  v_cap BIGINT;
  v_maximum BIGINT;
  v_cap_room BIGINT;
  v_service_years INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_request_id IS NULL OR p_player_id IS NULL OR p_game_id IS NULL
     OR p_annual_salary IS NULL OR p_annual_salary <= 0 OR p_years IS NULL OR p_years NOT BETWEEN 1 AND 5
     OR p_season IS NULL OR p_season !~ '^\d{4}-\d{2}$'
     OR split_part(p_season, '-', 2)::INTEGER <> (split_part(p_season, '-', 1)::INTEGER + 1) % 100 THEN
    RAISE EXCEPTION 'Invalid offer terms';
  END IF;
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active game required'; END IF;
  SELECT * INTO v_existing FROM free_agency_pending_offers
    WHERE owner_id = auth.uid() AND game_id = p_game_id AND request_id = p_request_id;
  IF FOUND THEN
    IF (v_existing.player_id, v_existing.team_id, v_existing.season, v_existing.annual_salary, v_existing.years)
       IS DISTINCT FROM (p_player_id, v_game.selected_team_id, p_season, p_annual_salary, p_years) THEN
      RAISE EXCEPTION 'Idempotency key reused with changed offer payload';
    END IF;
    RETURN v_existing;
  END IF;
  SELECT * INTO v_player FROM players WHERE id = p_player_id AND is_active;
  SELECT * INTO v_state FROM game_player_states WHERE game_id = p_game_id AND player_id = p_player_id FOR UPDATE;
  IF NOT FOUND OR v_state.team_id IS NOT NULL OR NOT v_state.is_active
     OR NOT EXISTS (SELECT 1 FROM free_agency_availability_enrollments e
       WHERE e.game_id = p_game_id AND e.player_id = p_player_id
         AND e.evidence_kind = 'simulation-bootstrap-enrollment')
     OR EXISTS (SELECT 1 FROM contracts c WHERE c.game_id = p_game_id AND c.player_id = p_player_id)
     OR EXISTS (SELECT 1 FROM game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = p_player_id) THEN
    RAISE EXCEPTION 'Explicitly enrolled active teamless player without a game agreement required';
  END IF;
  IF p_season <> format('%s-%s', v_game.season_year, right((v_game.season_year + 1)::TEXT, 2)) THEN
    RAISE EXCEPTION 'Offer season must match current simulation season';
  END IF;
  IF p_season <> '2026-27' THEN RAISE EXCEPTION 'Verified minimum salary schedule unavailable'; END IF;
  v_service_years := LEAST(COALESCE(v_player.years_of_experience, -1), 10);
  IF v_service_years < 0 THEN RAISE EXCEPTION 'Player years of service are unknown'; END IF;
  v_minimum := (ARRAY[1357763,2185116,2449421,2537526,2625627,2845883,3066143,3286399,3506659,3524115,3876529])[v_service_years + 1];
  v_cap := round(140588000 * power(1.1, GREATEST(0, v_game.season_year - 2024)))::BIGINT;
  v_maximum := floor(v_cap * CASE WHEN v_service_years <= 6 THEN 0.25 WHEN v_service_years <= 9 THEN 0.30 ELSE 0.35 END);
  IF p_annual_salary < v_minimum OR p_annual_salary > v_maximum THEN RAISE EXCEPTION 'Salary outside verified minimum and maximum'; END IF;
  SELECT COALESCE(sum(s.salary_amount), 0) INTO v_payroll FROM game_contract_agreements a
    JOIN game_contract_seasons s ON s.agreement_id = a.id AND s.game_id = a.game_id
    JOIN game_player_states state ON state.game_id = a.game_id AND state.player_id = a.player_id
      AND state.team_id = v_game.selected_team_id
    WHERE a.game_id = p_game_id AND s.start_year = v_game.season_year;
  SELECT v_payroll + COALESCE(sum(CASE v_game.season_year - c.start_year
      WHEN 0 THEN c.salary_y1 WHEN 1 THEN c.salary_y2 WHEN 2 THEN c.salary_y3
      WHEN 3 THEN c.salary_y4 WHEN 4 THEN c.salary_y5 ELSE 0 END), 0) INTO v_payroll FROM contracts c
    JOIN game_player_states state ON state.game_id = c.game_id AND state.player_id = c.player_id
      AND state.team_id = v_game.selected_team_id
    WHERE c.game_id = p_game_id AND c.start_year <= v_game.season_year AND c.end_year >= v_game.season_year
      AND NOT EXISTS (SELECT 1 FROM game_contract_agreements a
      WHERE a.game_id = c.game_id AND a.player_id = c.player_id);
  SELECT count(*) INTO v_service_years FROM game_player_states WHERE game_id = p_game_id AND team_id = v_game.selected_team_id AND is_active;
  IF v_service_years >= 15 THEN RAISE EXCEPTION 'Roster maximum reached'; END IF;
  v_cap_room := GREATEST(0, v_cap - v_payroll);
  IF p_annual_salary > v_cap_room AND p_annual_salary <> v_minimum THEN RAISE EXCEPTION 'Offer exceeds cap room'; END IF;
  INSERT INTO free_agency_pending_offers(request_id, owner_id, game_id, player_id, team_id,
    season, annual_salary, years, due_date)
  VALUES (p_request_id, auth.uid(), p_game_id, p_player_id, v_game.selected_team_id,
    p_season, p_annual_salary, p_years, v_game.simulation_date + 1)
  RETURNING * INTO v_offer;
  RETURN v_offer;
END;
$$;
REVOKE ALL ON FUNCTION submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_free_agency_offer(UUID, UUID, UUID, TEXT, BIGINT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION list_pending_free_agency_offers(p_game_id UUID)
RETURNS SETOF free_agency_pending_offers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.* FROM free_agency_pending_offers o JOIN games g ON g.id = o.game_id
  WHERE o.game_id = p_game_id AND o.owner_id = auth.uid() AND g.user_id = auth.uid()
    AND o.status = 'pending' ORDER BY o.due_date, o.created_at, o.id
$$;
REVOKE ALL ON FUNCTION list_pending_free_agency_offers(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_pending_free_agency_offers(UUID) TO authenticated;

COMMIT;
