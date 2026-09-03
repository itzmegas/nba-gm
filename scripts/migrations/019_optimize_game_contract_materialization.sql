BEGIN;

-- Migration order: 013 creates the source snapshot tables and 014 creates the
-- game contract copy tables. Migrations 015-018 may be applied in normal order,
-- but 018 is not a prerequisite for this complete function replacement.
-- Applying 019 after 014 (or after the already-applied 018) is sufficient.
CREATE OR REPLACE FUNCTION materialize_game_contract_snapshots(
  p_game_id UUID,
  p_user_id UUID,
  p_source TEXT,
  p_season TEXT,
  p_version_ids UUID[],
  p_identity_crosswalk JSONB,
  p_contract_classifications JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_game games%ROWTYPE;
  v_existing UUID[];
  v_roster_count INTEGER;
  v_identity_count INTEGER;
  v_agreement_count INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  SELECT * INTO v_game FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_game.user_id <> p_user_id OR v_game.status <> 'initializing'
     OR v_game.season_era_id <> 'modern' OR v_game.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Contract materialization requires an owned initializing modern game';
  END IF;
  IF p_season <> format('%s-%s', v_game.season_year, right((v_game.season_year + 1)::TEXT, 2)) THEN
    RAISE EXCEPTION 'Contract snapshot season does not match game season';
  END IF;
  IF jsonb_typeof(p_identity_crosswalk) <> 'array' THEN RAISE EXCEPTION 'Identity crosswalk must be an array'; END IF;
  IF jsonb_typeof(p_contract_classifications) <> 'array' THEN RAISE EXCEPTION 'Contract classifications must be an array'; END IF;

  SELECT source_version_ids INTO v_existing FROM game_contract_materializations WHERE game_id = p_game_id;
  IF FOUND THEN
    IF v_existing = p_version_ids THEN
      RETURN jsonb_build_object('status', 'already-materialized', 'agreementCount',
        (SELECT count(*) FROM game_contract_agreements WHERE game_id = p_game_id));
    END IF;
    RAISE EXCEPTION 'Game was already materialized from different source versions';
  END IF;

  IF cardinality(p_version_ids) <> 30 OR cardinality(ARRAY(SELECT DISTINCT unnest(p_version_ids))) <> 30 THEN
    RAISE EXCEPTION 'Exactly 30 distinct source snapshot versions are required';
  END IF;
  IF (SELECT count(*) FROM contract_source_snapshot_versions v WHERE v.id = ANY(p_version_ids)
      AND v.source = p_source AND v.season = p_season) <> 30
     OR (SELECT count(DISTINCT v.team) FROM contract_source_snapshot_versions v WHERE v.id = ANY(p_version_ids)) <> 30 THEN
    RAISE EXCEPTION 'Source snapshot version set is incomplete or inconsistent';
  END IF;
  IF ARRAY(SELECT DISTINCT v.team FROM contract_source_snapshot_versions v
      WHERE v.id = ANY(p_version_ids) ORDER BY v.team)
     <> ARRAY['ATL','BOS','BRK','CHI','CHO','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM',
       'MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHO','POR','SAC','SAS','TOR','UTA','WAS'] THEN
    RAISE EXCEPTION 'Source snapshot versions do not cover the canonical 30-team set';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_identity_crosswalk) x
    GROUP BY x->>'sourcePlayerId' HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_identity_crosswalk) x
    GROUP BY x->>'targetPlayerId' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Identity crosswalk source and target identities must be unique';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_identity_crosswalk) x WHERE
    x->>'matchMethod' NOT IN ('exact-provider-record', 'curated-exception')
    OR jsonb_typeof(x->'evidence') <> 'object') THEN
    RAISE EXCEPTION 'Identity crosswalk contains unvalidated records';
  END IF;

  SELECT count(*) INTO v_roster_count FROM game_player_states WHERE game_id = p_game_id;
  IF v_roster_count = 0 THEN RAISE EXCEPTION 'Modern roster must be seeded before contract materialization'; END IF;

  -- This sentinel remains the first game-owned write. The complete transaction
  -- rolls back if any copy row or coverage invariant below fails.
  INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
  VALUES (p_game_id, p_source, p_season, p_version_ids);

  -- One materialized classification lookup and one materialized source-contract
  -- lookup feed every copy operation in this statement. In particular, seasons
  -- join the already-keyed source row before expanding only that player's salaries.
  WITH classifications AS MATERIALIZED (
    SELECT (x->>'targetPlayerId')::UUID AS target_player_id, x->'resolution' AS resolution
    FROM jsonb_array_elements(p_contract_classifications) x
  ), crosswalk AS MATERIALIZED (
    SELECT x->>'sourcePlayerId' AS source_player_id, (x->>'targetPlayerId')::UUID AS target_player_id,
      x->>'matchMethod' AS match_method, x->'evidence' AS evidence
    FROM jsonb_array_elements(p_identity_crosswalk) x
  ), source_contracts AS MATERIALIZED (
    SELECT v.id AS source_snapshot_version_id, v.observed_at, c.contract,
      c.contract->>'playerSlug' AS source_player_id
    FROM contract_source_snapshot_versions v
    CROSS JOIN LATERAL jsonb_array_elements(v.payload->'contracts') c(contract)
    WHERE v.id = ANY(p_version_ids)
  ), matched AS MATERIALIZED (
    SELECT gps.player_id, gps.team_id, sc.source_snapshot_version_id, sc.observed_at, sc.contract,
      sc.source_player_id, cw.match_method, cw.evidence
    FROM source_contracts sc
    JOIN crosswalk cw ON cw.source_player_id = sc.source_player_id
    JOIN game_player_states gps ON gps.game_id = p_game_id AND gps.player_id = cw.target_player_id
    JOIN teams t ON t.id = gps.team_id AND t.abbreviation = (cw.evidence->>'nbaTeam')
    WHERE sc.contract->>'teamAbbreviation' = (cw.evidence->>'sourceTeam')
  ), inserted_identities AS (
    INSERT INTO game_contract_identities(game_id, player_id, team_id, resolution_status, contract_type,
      provenance_quality, source_method, estimated, cap_treatment, exclusion_evidence, source_player_id,
      source_snapshot_version_id, match_method, match_evidence)
    SELECT p_game_id, gps.player_id, gps.team_id,
      CASE
        WHEN c.resolution->>'status' = 'excluded' THEN 'inactive-excluded'
        WHEN c.resolution->>'contractType' = 'two-way' THEN 'official-two-way'
        WHEN (c.resolution->>'estimated')::BOOLEAN THEN 'estimated-minimum'
        WHEN c.resolution->>'status' = 'resolved' THEN 'observed-standard'
        ELSE 'unclassified'
      END,
      c.resolution->>'contractType', c.resolution->>'quality', c.resolution->>'method',
      COALESCE((c.resolution->>'estimated')::BOOLEAN, false), c.resolution->>'capTreatment',
      c.resolution->'evidence', m.source_player_id, m.source_snapshot_version_id, m.match_method, m.evidence
    FROM game_player_states gps
    LEFT JOIN matched m ON m.player_id = gps.player_id
    LEFT JOIN classifications c ON c.target_player_id = gps.player_id
    WHERE gps.game_id = p_game_id
  ), inserted_observed_agreements AS (
    INSERT INTO game_contract_agreements(game_id, player_id, team_id, start_season_label,
      end_season_label, remaining_guaranteed_amount, contract_type, provenance_quality, source_method,
      estimated, cap_treatment)
    SELECT p_game_id, m.player_id, m.team_id, NULL, NULL,
      NULLIF(m.contract->>'remainingGuaranteedAmount', '')::BIGINT, 'standard',
      c.resolution->>'quality', c.resolution->>'method', false, 'standard-cap-and-matching'
    FROM matched m
    JOIN classifications c ON c.target_player_id = m.player_id
    WHERE c.resolution->>'contractType' = 'standard'
      AND COALESCE((c.resolution->>'estimated')::BOOLEAN, false) = false
    RETURNING id, player_id
  ), inserted_estimated_agreements AS (
    INSERT INTO game_contract_agreements(game_id, player_id, team_id, start_season_label,
      end_season_label, remaining_guaranteed_amount, contract_type, provenance_quality, source_method,
      estimated, cap_treatment)
    SELECT p_game_id, gps.player_id, gps.team_id, p_season, p_season, NULL, 'standard', 'estimated',
      c.resolution->>'method', true, 'standard-cap-and-matching'
    FROM game_player_states gps
    JOIN classifications c ON c.target_player_id = gps.player_id
    WHERE gps.game_id = p_game_id
      AND c.resolution->>'status' = 'resolved'
      AND c.resolution->>'contractType' = 'standard'
      AND (c.resolution->>'estimated')::BOOLEAN = true
    RETURNING id, player_id
  ), inserted_provenance AS (
    INSERT INTO game_contract_provenance(agreement_id, game_id, source, source_url, source_player_id,
      source_snapshot_version_id, observed_at, notes)
    SELECT i.id, p_game_id, p_source, m.contract->>'playerUrl', m.source_player_id,
      m.source_snapshot_version_id, m.observed_at, m.contract->'contractNotes'
    FROM inserted_observed_agreements i
    JOIN matched m ON m.player_id = i.player_id
  ), inserted_estimated_seasons AS (
    INSERT INTO game_contract_seasons(agreement_id, game_id, season_label, start_year, end_year,
      salary_amount, option_kind, guarantee_kind)
    SELECT a.id, p_game_id, p_season, v_game.season_year, v_game.season_year + 1,
      (c.resolution->>'salaryAmount')::BIGINT, 'none', 'unknown'
    FROM inserted_estimated_agreements a
    JOIN classifications c ON c.target_player_id = a.player_id
    RETURNING agreement_id
  )
  INSERT INTO game_contract_seasons(agreement_id, game_id, season_label, start_year, end_year,
    salary_amount, option_kind, guarantee_kind)
  SELECT a.id, p_game_id, s.value->>'season', split_part(s.value->>'season', '-', 1)::INTEGER,
    split_part(s.value->>'season', '-', 1)::INTEGER + 1,
    NULLIF(s.value->>'amount', '')::BIGINT, s.value->>'optionKind', 'unknown'
  FROM inserted_observed_agreements a
  JOIN matched m ON m.player_id = a.player_id
  JOIN source_contracts sc
    ON sc.source_snapshot_version_id = m.source_snapshot_version_id
   AND sc.source_player_id = m.source_player_id
  CROSS JOIN LATERAL jsonb_array_elements(sc.contract->'salaries') s(value);

  SELECT count(*) INTO v_identity_count FROM game_contract_identities WHERE game_id = p_game_id;
  SELECT count(*) INTO v_agreement_count FROM game_contract_agreements WHERE game_id = p_game_id;
  IF v_identity_count <> v_roster_count THEN RAISE EXCEPTION 'Every roster identity must be classified'; END IF;
  IF EXISTS (SELECT 1 FROM game_contract_identities WHERE game_id = p_game_id AND resolution_status = 'unclassified') OR EXISTS (
    SELECT 1 FROM game_contract_agreements a LEFT JOIN game_contract_seasons s
      ON s.agreement_id = a.id AND s.start_year = v_game.season_year
    WHERE a.game_id = p_game_id AND s.salary_amount IS NULL
  ) THEN RAISE EXCEPTION 'Contract coverage is insufficient; game activation is blocked'; END IF;
  RETURN jsonb_build_object('status', 'materialized', 'rosterCount', v_roster_count,
    'agreementCount', v_agreement_count, 'unmatchedCount', v_roster_count - v_agreement_count);
END;
$$;
REVOKE ALL ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)
  TO service_role;

COMMIT;
