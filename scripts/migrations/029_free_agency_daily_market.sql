BEGIN;

CREATE FUNCTION public.generate_ai_free_agency_offers(p_game_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; team UUID; player UUID; f RECORD;
  salary BIGINT; offer_id UUID; inserted INTEGER; total INTEGER := 0;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  FOR team IN
    SELECT s.team_id FROM public.game_player_states s WHERE s.game_id = p_game_id AND s.team_id IS NOT NULL
    UNION SELECT s.team_id FROM public.league_standings s WHERE s.game_id = p_game_id ORDER BY team_id
  LOOP
    IF team = g.selected_team_id OR EXISTS (SELECT 1 FROM public.free_agency_pending_offers o
      WHERE o.game_id = p_game_id AND o.team_id = team AND o.offer_origin = 'ai'
        AND o.ai_decision_date = g.simulation_date) THEN CONTINUE; END IF;
    -- No player rating exists in persistence: v1 deliberately uses stable player identity.
    FOR player IN
      SELECT e.player_id FROM public.free_agency_availability_enrollments e
      JOIN public.game_player_states s ON s.game_id = e.game_id AND s.player_id = e.player_id
      JOIN public.players p ON p.id = e.player_id
      WHERE e.game_id = p_game_id AND s.team_id IS NULL AND s.is_active AND p.is_active
        AND p.years_of_experience BETWEEN 0 AND 99 AND e.evidence_kind = 'simulation-bootstrap-enrollment'
        AND NOT EXISTS (SELECT 1 FROM public.contracts c WHERE c.game_id = p_game_id AND c.player_id = e.player_id)
        AND NOT EXISTS (SELECT 1 FROM public.game_contract_agreements a WHERE a.game_id = p_game_id AND a.player_id = e.player_id)
        AND NOT EXISTS (SELECT 1 FROM public.game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = e.player_id)
        AND NOT EXISTS (SELECT 1 FROM public.free_agency_pending_offers o WHERE o.game_id = p_game_id
          AND o.player_id = e.player_id AND o.team_id = team AND o.status = 'pending')
      ORDER BY e.player_id
    LOOP
      SELECT * INTO STRICT f FROM public.get_free_agency_financial_context(p_game_id, player, team);
      IF f.roster_count >= 15 THEN EXIT; END IF;
      salary := CASE WHEN f.cap_room >= floor(f.minimum_salary * 1.10)
        THEN LEAST(f.maximum_salary, floor(f.minimum_salary * 1.10)::BIGINT) ELSE f.minimum_salary END;
      offer_id := md5('free-agency-ai-v1:' || p_game_id::TEXT || ':' || g.simulation_date::TEXT || ':' || team::TEXT)::UUID;
      INSERT INTO public.free_agency_pending_offers(id, request_id, owner_id, game_id, player_id, team_id,
        season, annual_salary, years, due_date, offer_origin, ai_decision_date)
      VALUES (offer_id, gen_random_uuid(), g.user_id, p_game_id, player, team,
        format('%s-%s', g.season_year, right((g.season_year + 1)::TEXT, 2)), salary, 1,
        g.simulation_date + 1, 'ai', g.simulation_date)
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

CREATE FUNCTION public.resolve_due_free_agency_market(p_game_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  g public.games%ROWTYPE; player UUID; o public.free_agency_pending_offers%ROWTYPE;
  assessment RECORD; winner UUID; winner_team UUID; best NUMERIC; total INTEGER := 0;
BEGIN
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid()
    AND status = 'active' AND season_era_id = 'modern' AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned active modern game required'; END IF;
  -- Older due groups first, then player identity. Later groups see updated cap/roster.
  FOR player IN SELECT player_id FROM public.free_agency_pending_offers
    WHERE game_id = p_game_id AND owner_id = auth.uid() AND status = 'pending' AND due_date <= g.simulation_date
    GROUP BY player_id ORDER BY min(due_date), player_id
  LOOP
    winner := NULL; winner_team := NULL; best := NULL;
    FOR o IN SELECT * FROM public.free_agency_pending_offers
      WHERE game_id = p_game_id AND player_id = player AND owner_id = auth.uid()
        AND status = 'pending' AND due_date <= g.simulation_date ORDER BY id FOR UPDATE
    LOOP
      SELECT * INTO STRICT assessment FROM public.assess_free_agency_offer(p_game_id, o.id);
      IF assessment.rejection_reason IS NOT NULL THEN
        UPDATE public.free_agency_pending_offers SET status = 'rejected', resolved_at = clock_timestamp(),
          resolved_date = g.simulation_date, resolution_reason = 'offer_no_longer_legal',
          resolution_detail = assessment.rejection_reason WHERE id = o.id;
      ELSIF winner IS NULL OR assessment.score > best OR (assessment.score = best AND (o.team_id, o.id) < (winner_team, winner)) THEN
        winner := o.id; winner_team := o.team_id; best := assessment.score;
      END IF;
    END LOOP;
    IF winner IS NOT NULL THEN
      PERFORM public.resolve_free_agency_offer(p_game_id, winner);
      total := total + 1;
    END IF;
  END LOOP;
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_due_free_agency_market(UUID) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
