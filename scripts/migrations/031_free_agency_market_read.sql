BEGIN;

CREATE FUNCTION public.get_free_agency_market(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE;
  ready BOOLEAN;
  finance RECORD;
  result JSONB;
  candidates JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO g FROM public.games
  WHERE id = p_game_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned game not found'; END IF;

  ready := g.status = 'active' AND g.season_era_id = 'modern' AND g.season_year = 2026
    AND EXISTS (SELECT 1 FROM public.game_contract_materializations m WHERE m.game_id = p_game_id);
  result := jsonb_build_object(
    'game_id', g.id,
    'supported', ready,
    'context', NULL,
    'candidates', '[]'::jsonb,
    'offers', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object(
        'player_name', concat_ws(' ', p.first_name, p.last_name),
        'team_name', t.name
      ) ORDER BY o.created_at DESC, o.id DESC)
      FROM public.free_agency_pending_offers o
      LEFT JOIN public.players p ON p.id = o.player_id
      LEFT JOIN public.teams t ON t.id = o.team_id
      WHERE o.game_id = p_game_id AND o.owner_id = auth.uid()
    ), '[]'::jsonb)
  );
  IF NOT ready THEN RETURN result; END IF;

  -- A valid probe supplies the private helper's required player argument; it never enrolls a player.
  SELECT f.* INTO finance
  FROM public.game_player_states s
  JOIN public.players p ON p.id = s.player_id AND p.is_active
    AND p.years_of_experience BETWEEN 0 AND 99
  CROSS JOIN LATERAL public.get_free_agency_financial_context(p_game_id, p.id, g.selected_team_id) f
  WHERE s.game_id = p_game_id
  ORDER BY s.player_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active player with known years of service required for market context'; END IF;

  result := jsonb_set(result, '{context}', jsonb_build_object(
    'team_id', finance.selected_team_id,
    'season', format('%s-%s', finance.season_year, right((finance.season_year + 1)::TEXT, 2)),
    'simulation_date', finance.simulation_date,
    'salary_cap', finance.salary_cap,
    'payroll', finance.payroll,
    'cap_room', finance.cap_room,
    'roster_count', finance.roster_count
  ));

  IF EXISTS (
    SELECT 1 FROM public.free_agency_availability_enrollments e
    JOIN public.game_player_states s ON s.game_id = e.game_id AND s.player_id = e.player_id
    JOIN public.players p ON p.id = e.player_id AND p.is_active
    WHERE e.game_id = p_game_id AND e.evidence_kind = 'simulation-bootstrap-enrollment'
      AND s.is_active AND s.team_id IS NULL
      AND (p.years_of_experience IS NULL OR p.years_of_experience NOT BETWEEN 0 AND 99)
      AND NOT EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = p.id)
  ) THEN RAISE EXCEPTION 'Active player with known years of service required'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'player_id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
    'position', p.position, 'minimum_salary', f.minimum_salary, 'maximum_salary', f.maximum_salary
  ) ORDER BY p.id), '[]'::jsonb) INTO candidates
  FROM public.free_agency_availability_enrollments e
  JOIN public.players p ON p.id = e.player_id AND p.is_active
  JOIN public.game_player_states s ON s.game_id = e.game_id AND s.player_id = e.player_id
    AND s.is_active AND s.team_id IS NULL
  CROSS JOIN LATERAL public.get_free_agency_financial_context(p_game_id, p.id, g.selected_team_id) f
  WHERE e.game_id = p_game_id AND e.evidence_kind = 'simulation-bootstrap-enrollment'
    AND p.years_of_experience BETWEEN 0 AND 99
    AND NOT EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = p.id);
  result := jsonb_set(result, '{candidates}', candidates);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_free_agency_market(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_agency_market(UUID) TO authenticated;

COMMIT;
