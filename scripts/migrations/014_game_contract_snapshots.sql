BEGIN;

-- Game-owned copies of global source snapshots. Source payloads stay immutable and
-- are never queried by gameplay after this one initialization transaction.
ALTER TABLE game_player_states
  ADD CONSTRAINT game_player_states_game_player_team_unique UNIQUE (game_id, player_id, team_id);

CREATE TABLE game_contract_materializations (
  game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  season TEXT NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  source_version_ids UUID[] NOT NULL CHECK (cardinality(source_version_ids) = 30),
  materialized_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_contract_identities (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('observed-standard', 'official-two-way', 'estimated-minimum', 'inactive-excluded', 'unclassified')),
  contract_type TEXT CHECK (contract_type IS NULL OR contract_type IN ('standard', 'two-way')),
  provenance_quality TEXT CHECK (provenance_quality IS NULL OR provenance_quality IN ('observed', 'official', 'estimated')),
  source_method TEXT,
  estimated BOOLEAN NOT NULL DEFAULT false,
  cap_treatment TEXT NOT NULL CHECK (cap_treatment IN ('standard-cap-and-matching', 'excluded-two-way', 'excluded-inactive')),
  exclusion_evidence JSONB CHECK (exclusion_evidence IS NULL OR jsonb_typeof(exclusion_evidence) = 'object'),
  source_player_id TEXT,
  source_snapshot_version_id UUID REFERENCES contract_source_snapshot_versions(id) ON DELETE RESTRICT,
  match_method TEXT CHECK (match_method IS NULL OR match_method IN ('exact-provider-record', 'curated-exception')),
  match_evidence JSONB CHECK (match_evidence IS NULL OR jsonb_typeof(match_evidence) = 'object'),
  PRIMARY KEY (game_id, player_id),
  FOREIGN KEY (game_id, player_id, team_id)
    REFERENCES game_player_states(game_id, player_id, team_id) ON DELETE RESTRICT,
  CHECK (
    resolution_status <> 'unclassified'
  )
);

CREATE TABLE game_contract_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  start_season_label TEXT CHECK (start_season_label IS NULL OR start_season_label ~ '^\d{4}-\d{2}$'),
  end_season_label TEXT CHECK (end_season_label IS NULL OR end_season_label ~ '^\d{4}-\d{2}$'),
  remaining_guaranteed_amount BIGINT CHECK (remaining_guaranteed_amount IS NULL OR remaining_guaranteed_amount >= 0),
  contract_type TEXT NOT NULL CHECK (contract_type IN ('standard', 'two-way')),
  provenance_quality TEXT NOT NULL CHECK (provenance_quality IN ('observed', 'official', 'estimated')),
  source_method TEXT NOT NULL,
  estimated BOOLEAN NOT NULL DEFAULT false,
  cap_treatment TEXT NOT NULL CHECK (cap_treatment IN ('standard-cap-and-matching', 'excluded-two-way')),
  UNIQUE (game_id, player_id),
  UNIQUE (id, game_id),
  FOREIGN KEY (game_id, player_id, team_id)
    REFERENCES game_player_states(game_id, player_id, team_id) ON DELETE RESTRICT
);

CREATE TABLE game_contract_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  season_label TEXT NOT NULL CHECK (season_label ~ '^\d{4}-\d{2}$'),
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL CHECK (end_year = start_year + 1),
  salary_amount BIGINT CHECK (salary_amount IS NULL OR salary_amount >= 0),
  option_kind TEXT NOT NULL CHECK (option_kind IN ('none', 'player', 'team', 'unknown')),
  guarantee_kind TEXT NOT NULL CHECK (guarantee_kind IN ('guaranteed', 'not-guaranteed', 'partially-guaranteed', 'unknown')),
  UNIQUE (agreement_id, season_label),
  CONSTRAINT game_contract_seasons_agreement_game_fkey FOREIGN KEY (agreement_id, game_id)
    REFERENCES game_contract_agreements(id, game_id) ON DELETE CASCADE
);

CREATE TABLE game_contract_provenance (
  agreement_id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
  source_player_id TEXT NOT NULL,
  source_snapshot_version_id UUID NOT NULL REFERENCES contract_source_snapshot_versions(id) ON DELETE RESTRICT,
  observed_at TIMESTAMPTZ NOT NULL,
  notes JSONB CHECK (notes IS NULL OR jsonb_typeof(notes) = 'array'),
  CONSTRAINT game_contract_provenance_agreement_game_fkey FOREIGN KEY (agreement_id, game_id)
    REFERENCES game_contract_agreements(id, game_id) ON DELETE CASCADE
);

CREATE INDEX idx_game_contract_identities_game_team ON game_contract_identities(game_id, team_id);
CREATE INDEX idx_game_contract_agreements_game_team ON game_contract_agreements(game_id, team_id);
CREATE INDEX idx_game_contract_seasons_game_season ON game_contract_seasons(game_id, season_label);
CREATE INDEX idx_game_contract_provenance_source_version ON game_contract_provenance(source_snapshot_version_id);

ALTER TABLE game_contract_materializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_contract_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_contract_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_contract_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_contract_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY game_contract_materializations_owner_read ON game_contract_materializations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()));
CREATE POLICY game_contract_identities_owner_read ON game_contract_identities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()));
CREATE POLICY game_contract_agreements_owner_read ON game_contract_agreements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()));
CREATE POLICY game_contract_seasons_owner_read ON game_contract_seasons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()));
CREATE POLICY game_contract_provenance_owner_read ON game_contract_provenance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()));

REVOKE ALL ON game_contract_materializations, game_contract_identities, game_contract_agreements,
  game_contract_seasons, game_contract_provenance FROM PUBLIC, anon;
GRANT SELECT ON game_contract_materializations, game_contract_identities, game_contract_agreements,
  game_contract_seasons, game_contract_provenance TO authenticated;
GRANT SELECT, INSERT ON game_contract_materializations, game_contract_identities, game_contract_agreements,
  game_contract_seasons, game_contract_provenance TO service_role;

CREATE FUNCTION enforce_game_contract_copy_immutability() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_game_id UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Game contract snapshots are immutable'; END IF;
  v_game_id := NEW.game_id;
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = v_game_id AND status = 'initializing' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Game contract snapshots may only be inserted while the game is initializing';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER game_contract_materializations_immutable BEFORE INSERT OR UPDATE OR DELETE ON game_contract_materializations
  FOR EACH ROW EXECUTE FUNCTION enforce_game_contract_copy_immutability();
CREATE TRIGGER game_contract_identities_immutable BEFORE INSERT OR UPDATE OR DELETE ON game_contract_identities
  FOR EACH ROW EXECUTE FUNCTION enforce_game_contract_copy_immutability();
CREATE TRIGGER game_contract_agreements_immutable BEFORE INSERT OR UPDATE OR DELETE ON game_contract_agreements
  FOR EACH ROW EXECUTE FUNCTION enforce_game_contract_copy_immutability();
CREATE TRIGGER game_contract_seasons_immutable BEFORE INSERT OR UPDATE OR DELETE ON game_contract_seasons
  FOR EACH ROW EXECUTE FUNCTION enforce_game_contract_copy_immutability();
CREATE TRIGGER game_contract_provenance_immutable BEFORE INSERT OR UPDATE OR DELETE ON game_contract_provenance
  FOR EACH ROW EXECUTE FUNCTION enforce_game_contract_copy_immutability();

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

  INSERT INTO game_contract_materializations(game_id, source, season, source_version_ids)
  VALUES (p_game_id, p_source, p_season, p_version_ids);

  WITH source_contracts AS (
    SELECT v.id version_id, v.observed_at, c.contract
    FROM contract_source_snapshot_versions v
    CROSS JOIN LATERAL jsonb_array_elements(v.payload->'contracts') c(contract)
    WHERE v.id = ANY(p_version_ids)
  ), crosswalk AS (
    SELECT x->>'sourcePlayerId' source_player_id, (x->>'targetPlayerId')::UUID target_player_id,
      x->>'matchMethod' match_method, x->'evidence' evidence
    FROM jsonb_array_elements(p_identity_crosswalk) x
  ), matched AS (
    SELECT gps.player_id, gps.team_id, sc.version_id, sc.observed_at, sc.contract,
      sc.contract->>'playerSlug' source_player_id, cw.match_method, cw.evidence
    FROM source_contracts sc
    JOIN crosswalk cw ON cw.source_player_id = sc.contract->>'playerSlug'
    JOIN game_player_states gps ON gps.game_id = p_game_id AND gps.player_id = cw.target_player_id
    JOIN teams t ON t.id = gps.team_id AND t.abbreviation = (cw.evidence->>'nbaTeam')
    WHERE sc.contract->>'teamAbbreviation' = (cw.evidence->>'sourceTeam')
  )
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
    c.resolution->'evidence',
    m.source_player_id, m.version_id, m.match_method, m.evidence
  FROM game_player_states gps
  LEFT JOIN matched m ON m.player_id = gps.player_id
  LEFT JOIN LATERAL (
    SELECT x->'resolution' resolution FROM jsonb_array_elements(p_contract_classifications) x
    WHERE (x->>'targetPlayerId')::UUID = gps.player_id
  ) c ON true
  WHERE gps.game_id = p_game_id;

  WITH source_contracts AS (
    SELECT v.id version_id, v.observed_at, c.contract
    FROM contract_source_snapshot_versions v
    CROSS JOIN LATERAL jsonb_array_elements(v.payload->'contracts') c(contract)
    WHERE v.id = ANY(p_version_ids)
  ), crosswalk AS (
    SELECT x->>'sourcePlayerId' source_player_id, (x->>'targetPlayerId')::UUID target_player_id
    FROM jsonb_array_elements(p_identity_crosswalk) x
  ), matched AS (
    SELECT gps.player_id, gps.team_id, sc.version_id, sc.observed_at, sc.contract,
      sc.contract->>'playerSlug' source_player_id
    FROM source_contracts sc
    JOIN crosswalk cw ON cw.source_player_id = sc.contract->>'playerSlug'
    JOIN game_player_states gps ON gps.game_id = p_game_id AND gps.player_id = cw.target_player_id
  ), inserted AS (
    INSERT INTO game_contract_agreements(game_id, player_id, team_id, start_season_label,
      end_season_label, remaining_guaranteed_amount, contract_type, provenance_quality, source_method,
      estimated, cap_treatment)
    SELECT p_game_id, player_id, team_id, NULL, NULL,
      NULLIF(contract->>'remainingGuaranteedAmount', '')::BIGINT, 'standard',
      CASE WHEN (c->'resolution'->>'estimated')::BOOLEAN THEN 'estimated' ELSE 'observed' END,
      c->'resolution'->>'method', COALESCE((c->'resolution'->>'estimated')::BOOLEAN, false),
      'standard-cap-and-matching'
    FROM matched
    JOIN LATERAL (SELECT x c FROM jsonb_array_elements(p_contract_classifications) x
      WHERE (x->>'targetPlayerId')::UUID = matched.player_id
        AND x->'resolution'->>'contractType' = 'standard') classified ON true
    RETURNING id, player_id
  )
  INSERT INTO game_contract_provenance(agreement_id, game_id, source, source_url, source_player_id,
    source_snapshot_version_id, observed_at, notes)
  SELECT i.id, p_game_id, p_source, m.contract->>'playerUrl', m.source_player_id,
    m.version_id, m.observed_at, m.contract->'contractNotes'
  FROM inserted i JOIN matched m USING (player_id);

  INSERT INTO game_contract_seasons(agreement_id, game_id, season_label, start_year, end_year,
    salary_amount, option_kind, guarantee_kind)
  SELECT a.id, p_game_id, s.value->>'season', split_part(s.value->>'season', '-', 1)::INTEGER,
    split_part(s.value->>'season', '-', 1)::INTEGER + 1,
    NULLIF(s.value->>'amount', '')::BIGINT, s.value->>'optionKind', 'unknown'
  FROM game_contract_agreements a
  JOIN game_contract_provenance pr ON pr.agreement_id = a.id
  JOIN contract_source_snapshot_versions v ON v.id = pr.source_snapshot_version_id
  CROSS JOIN LATERAL jsonb_array_elements(v.payload->'contracts') c(contract)
  CROSS JOIN LATERAL jsonb_array_elements(c.contract->'salaries') s(value)
  WHERE a.game_id = p_game_id AND c.contract->>'playerSlug' = pr.source_player_id;

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

-- Historical games retain the exact legacy template path. Modern games only seed
-- roster state here; canonical seasonal contracts are materialized by the service RPC.
CREATE OR REPLACE FUNCTION seed_game_data(p_game_id UUID, p_team_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game games%ROWTYPE; v_roster_count INTEGER; v_contract_count INTEGER;
BEGIN
  SELECT * INTO v_game FROM games g WHERE g.id = p_game_id AND g.selected_team_id = p_team_id
    AND g.user_id = auth.uid() AND g.status = 'initializing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'seed_game_data aborted: game is not initializing, not owned by the caller, or selected team does not match'; END IF;
  IF v_game.season_era_id <> 'modern' THEN
    IF NOT EXISTS (SELECT 1 FROM historical_roster_templates WHERE season_year = v_game.season_year) THEN
      RAISE EXCEPTION 'seed_game_data aborted: historical templates for season % are not loaded', v_game.season_year;
    END IF;
    INSERT INTO game_player_states(game_id, player_id, team_id, is_active)
      SELECT p_game_id, player_id, team_id, is_active FROM historical_roster_templates
      WHERE season_year = v_game.season_year ON CONFLICT (game_id, player_id) DO NOTHING;
    INSERT INTO contracts(game_id, player_id, team_id, start_year, end_year, salary_y1, salary_y2,
      salary_y3, salary_y4, salary_y5, is_player_option, is_team_option, is_guaranteed)
      SELECT p_game_id, player_id, team_id, start_year, end_year, salary_y1, salary_y2, salary_y3,
        salary_y4, salary_y5, is_player_option, is_team_option, is_guaranteed
      FROM historical_contract_templates WHERE season_year = v_game.season_year
      ON CONFLICT (game_id, player_id) DO NOTHING;
    SELECT count(*) INTO v_roster_count FROM game_player_states WHERE game_id = p_game_id;
    SELECT count(*) INTO v_contract_count FROM contracts WHERE game_id = p_game_id;
    IF v_roster_count = 0 OR v_contract_count <> v_roster_count THEN
      RAISE EXCEPTION 'seed_game_data aborted: incomplete historical snapshot';
    END IF;
  ELSE
    INSERT INTO game_player_states(game_id, player_id, team_id)
      SELECT p_game_id, id, team_id FROM players WHERE team_id IS NOT NULL
      ON CONFLICT (game_id, player_id) DO NOTHING;
    IF EXISTS (SELECT 1 FROM contracts WHERE game_id = p_game_id) THEN
      RAISE EXCEPTION 'seed_game_data refuses legacy contracts for modern games';
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION seed_game_data(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_game_data(UUID, UUID) TO authenticated;

COMMIT;
