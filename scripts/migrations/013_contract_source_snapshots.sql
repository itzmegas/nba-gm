BEGIN;

CREATE TABLE IF NOT EXISTS contract_source_snapshot_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (char_length(trim(source)) > 0),
  team TEXT NOT NULL CHECK (team ~ '^[A-Z]{2,3}$'),
  season TEXT NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
  observed_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT contract_source_snapshot_versions_content_unique
    UNIQUE (source, team, season, content_hash),
  CONSTRAINT contract_source_snapshot_versions_identity_id_unique
    UNIQUE (id, source, team, season)
);

CREATE TABLE IF NOT EXISTS current_contract_source_snapshots (
  source TEXT NOT NULL,
  team TEXT NOT NULL,
  season TEXT NOT NULL,
  version_id UUID NOT NULL,
  revalidated_at TIMESTAMPTZ NOT NULL,
  revalidation_revision BIGINT NOT NULL CHECK (revalidation_revision > 0),
  PRIMARY KEY (source, team, season),
  CONSTRAINT current_contract_source_snapshots_version_identity_fkey
    FOREIGN KEY (version_id, source, team, season)
    REFERENCES contract_source_snapshot_versions(id, source, team, season)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_contract_source_snapshot_versions_identity_observed
  ON contract_source_snapshot_versions(source, team, season, observed_at DESC);

ALTER TABLE contract_source_snapshot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_contract_source_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE contract_source_snapshot_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE current_contract_source_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE contract_source_snapshot_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE current_contract_source_snapshots TO service_role;

CREATE SEQUENCE IF NOT EXISTS contract_snapshot_revalidation_revision_seq;
REVOKE ALL ON SEQUENCE contract_snapshot_revalidation_revision_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION reserve_contract_snapshot_revalidation(
  p_source TEXT,
  p_team TEXT,
  p_season TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF char_length(trim(p_source)) = 0 OR p_team !~ '^[A-Z]{2,3}$' OR p_season !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid contract snapshot identity';
  END IF;
  RETURN nextval('contract_snapshot_revalidation_revision_seq');
END;
$$;

REVOKE ALL ON FUNCTION reserve_contract_snapshot_revalidation(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_contract_snapshot_revalidation(TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION store_contract_source_snapshot(
  p_source TEXT,
  p_team TEXT,
  p_season TEXT,
  p_source_url TEXT,
  p_observed_at TIMESTAMPTZ,
  p_fetched_at TIMESTAMPTZ,
  p_revalidation_revision BIGINT,
  p_content_hash TEXT,
  p_payload JSONB
)
RETURNS TABLE (
  version_id UUID,
  source TEXT,
  team TEXT,
  season TEXT,
  content_hash TEXT,
  observed_at TIMESTAMPTZ,
  stored_at TIMESTAMPTZ,
  revalidated_at TIMESTAMPTZ,
  payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source || ':' || p_team || ':' || p_season, 0));

  INSERT INTO contract_source_snapshot_versions (
    source, team, season, source_url, observed_at, fetched_at, content_hash, payload
  ) VALUES (
    p_source, p_team, p_season, p_source_url, p_observed_at, p_fetched_at, p_content_hash, p_payload
  )
  ON CONFLICT (source, team, season, content_hash) DO NOTHING
  RETURNING id INTO v_version_id;

  IF v_version_id IS NULL THEN
    SELECT v.id INTO v_version_id
    FROM contract_source_snapshot_versions v
    WHERE v.source = p_source AND v.team = p_team AND v.season = p_season
      AND v.content_hash = p_content_hash;
  END IF;

  INSERT INTO current_contract_source_snapshots (
    source, team, season, version_id, revalidated_at, revalidation_revision
  )
  VALUES (p_source, p_team, p_season, v_version_id, p_fetched_at, p_revalidation_revision)
  ON CONFLICT (source, team, season) DO UPDATE SET
    version_id = EXCLUDED.version_id,
    revalidated_at = EXCLUDED.revalidated_at,
    revalidation_revision = EXCLUDED.revalidation_revision
  WHERE EXCLUDED.revalidation_revision > current_contract_source_snapshots.revalidation_revision;

  RETURN QUERY
  SELECT v.id, v.source, v.team, v.season, v.content_hash, v.observed_at, v.stored_at,
    c.revalidated_at, v.payload
  FROM current_contract_source_snapshots c
  JOIN contract_source_snapshot_versions v ON v.id = c.version_id
  WHERE c.source = p_source AND c.team = p_team AND c.season = p_season;
END;
$$;

REVOKE ALL ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)
  TO service_role;

COMMIT;
