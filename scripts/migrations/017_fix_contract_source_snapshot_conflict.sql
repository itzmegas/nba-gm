BEGIN;

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
  ON CONFLICT ON CONSTRAINT contract_source_snapshot_versions_content_unique DO NOTHING
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
  ON CONFLICT ON CONSTRAINT current_contract_source_snapshots_pkey DO UPDATE SET
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
