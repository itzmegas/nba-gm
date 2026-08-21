BEGIN;

ALTER TABLE players ALTER COLUMN nba_id DROP NOT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS espn_id INTEGER UNIQUE;

ALTER TABLE roster_refresh_staging
  DROP CONSTRAINT IF EXISTS roster_refresh_staging_run_player_unique;
ALTER TABLE roster_refresh_staging ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE roster_refresh_staging ADD COLUMN IF NOT EXISTS player_source_id INTEGER;
DELETE FROM roster_refresh_staging;
ALTER TABLE roster_refresh_staging ALTER COLUMN provider SET NOT NULL;
ALTER TABLE roster_refresh_staging ALTER COLUMN player_source_id SET NOT NULL;
ALTER TABLE roster_refresh_staging DROP COLUMN player_nba_id;
ALTER TABLE roster_refresh_staging
  ADD CONSTRAINT roster_refresh_staging_provider_check CHECK (provider IN ('espn'));
ALTER TABLE roster_refresh_staging
  ADD CONSTRAINT roster_refresh_staging_run_player_unique
  UNIQUE (run_id, provider, player_source_id);

CREATE OR REPLACE FUNCTION promote_current_roster(p_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_team_count INTEGER;
  v_staged_team_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('current-roster', 0));
  SELECT expected_team_count INTO v_expected_team_count
  FROM roster_refresh_runs WHERE id = p_run_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Roster refresh run is missing or not pending'; END IF;

  SELECT count(DISTINCT team_id) INTO v_staged_team_count
  FROM roster_refresh_staging WHERE run_id = p_run_id;
  IF v_staged_team_count <> v_expected_team_count
     OR EXISTS (SELECT 1 FROM teams t WHERE NOT EXISTS (
       SELECT 1 FROM roster_refresh_staging s WHERE s.run_id = p_run_id AND s.team_id = t.id
     ))
     OR EXISTS (SELECT 1 FROM roster_refresh_staging s WHERE s.run_id = p_run_id
       AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = s.team_id)) THEN
    RAISE EXCEPTION 'Roster refresh run does not contain the complete team set';
  END IF;

  UPDATE players p SET espn_id = s.player_source_id, updated_at = now()
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn' AND p.espn_id IS NULL
    AND lower(p.full_name) = lower(s.payload->>'full_name');

  INSERT INTO players (
    espn_id, team_id, first_name, last_name, full_name, position,
    height, weight, jersey_number, is_active
  )
  SELECT
    s.player_source_id, s.team_id, s.payload->>'first_name', s.payload->>'last_name',
    s.payload->>'full_name', s.payload->>'position', s.payload->>'height',
    s.payload->>'weight', s.payload->>'jersey_number', true
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn'
    AND NOT EXISTS (SELECT 1 FROM players p WHERE p.espn_id = s.player_source_id);

  UPDATE players SET team_id = NULL, is_active = false, updated_at = now()
  WHERE team_id IS NOT NULL;
  UPDATE players p SET team_id = s.team_id, is_active = true, updated_at = now(),
    first_name = s.payload->>'first_name', last_name = s.payload->>'last_name',
    full_name = s.payload->>'full_name', position = s.payload->>'position',
    height = s.payload->>'height', weight = s.payload->>'weight',
    jersey_number = s.payload->>'jersey_number'
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND s.provider = 'espn'
    AND p.espn_id = s.player_source_id;

  UPDATE roster_refresh_runs SET status = 'success', completed_team_count = v_staged_team_count,
    updated_at = now() WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION promote_current_roster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_current_roster(UUID) TO service_role;

COMMIT;
