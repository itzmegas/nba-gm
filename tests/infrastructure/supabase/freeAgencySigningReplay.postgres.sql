SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE offer free_agency_pending_offers%ROWTYPE; replay free_agency_pending_offers%ROWTYPE;
  agreement game_runtime_contracts%ROWTYPE; before_state JSONB; after_state JSONB;
BEGIN
  IF (SELECT payroll FROM get_free_agency_financial_context(
      '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005')) <> 61000000 THEN
    RAISE EXCEPTION 'Runtime payroll did not follow current roster ownership after trade';
  END IF;
  SELECT jsonb_agg(to_jsonb(r) ORDER BY id) INTO before_state FROM game_runtime_contracts r;
  FOR offer IN SELECT * FROM free_agency_pending_offers WHERE game_id = '40000000-0000-4000-8000-000000000002' LOOP
    replay := resolve_free_agency_offer(offer.game_id, offer.id);
    IF to_jsonb(replay) IS DISTINCT FROM to_jsonb(offer) THEN
      RAISE EXCEPTION 'Terminal replay changed persisted resolution fields';
    END IF;
    IF offer.status = 'accepted' THEN
      SELECT * INTO agreement FROM game_runtime_contracts WHERE id = offer.resolved_contract_id;
      IF agreement.source_offer_id IS DISTINCT FROM offer.id
         OR agreement.annual_salary IS DISTINCT FROM offer.annual_salary
         OR agreement.start_year <> 2026 OR agreement.end_year <> 2026 + offer.years - 1
         OR agreement.is_player_option OR agreement.is_team_option OR agreement.is_guaranteed IS NOT NULL THEN
        RAISE EXCEPTION 'Traded simulated agreement lost source offer terms';
      END IF;
    END IF;
  END LOOP;
  SELECT jsonb_agg(to_jsonb(r) ORDER BY id) INTO after_state FROM game_runtime_contracts r;
  IF before_state IS DISTINCT FROM after_state THEN RAISE EXCEPTION 'Replay mutated runtime agreements'; END IF;
END $$;

DO $$
DECLARE before_state JSONB; after_state JSONB;
BEGIN
  SELECT snapshot INTO before_state FROM free_agency_signing_prestate;
  SELECT jsonb_build_object(
    'identities', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY game_id, player_id)
      FROM game_contract_identities x WHERE game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'agreements', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY id)
      FROM game_contract_agreements x WHERE game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'seasons', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY agreement_id, season_label)
      FROM game_contract_seasons x WHERE game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'provenance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY agreement_id)
      FROM game_contract_provenance x WHERE game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'sourceSnapshots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY id)
      FROM contract_source_snapshot_versions x WHERE id = '50000000-0000-4000-8000-000000000001'), '[]'::jsonb),
    'legacyContractTerms', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'team_id' - 'updated_at' ORDER BY game_id, player_id)
      FROM contracts x WHERE game_id = '40000000-0000-4000-8000-000000000002'), '[]'::jsonb),
    'existingRuntime', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY game_id, player_id)
      FROM game_runtime_contracts x WHERE game_id = '40000000-0000-4000-8000-000000000002'
        AND player_id <> '30000000-0000-4000-8000-000000000005'), '[]'::jsonb)
  ) INTO after_state;
  IF before_state IS DISTINCT FROM after_state THEN
    RAISE EXCEPTION 'Trade or replay changed full canonical/source or existing agreement snapshots';
  END IF;
END $$;

-- Submission remains a pending-only API after acceptance, including after a trade.
SET ROLE authenticated;
DO $$
DECLARE offer free_agency_pending_offers%ROWTYPE; actual TEXT;
BEGIN
  SELECT * INTO offer FROM free_agency_pending_offers WHERE status = 'accepted';
  BEGIN
    PERFORM submit_free_agency_offer(offer.game_id, offer.player_id, offer.request_id,
      offer.season, offer.annual_salary, offer.years);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = MESSAGE_TEXT;
  END;
  IF actual IS DISTINCT FROM 'Offer request has already been resolved' THEN
    RAISE EXCEPTION 'Accepted submission replay leaked a non-pending row: %', actual;
  END IF;
END $$;
RESET ROLE;
SELECT 'GREEN: exact accepted/rejected replay and source terms after runtime-only trade' AS proof;
