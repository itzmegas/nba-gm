BEGIN;

ALTER TABLE games ADD COLUMN IF NOT EXISTS season_era_id TEXT;

UPDATE games
SET season_era_id = CASE season_year
  WHEN 2010 THEN 'lebron'
  WHEN 1995 THEN 'jordan'
  ELSE 'modern'
END
WHERE season_era_id IS NULL;

ALTER TABLE games ALTER COLUMN season_era_id SET DEFAULT 'modern';
ALTER TABLE games ALTER COLUMN season_era_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'games_season_era_id_check'
  ) THEN
    ALTER TABLE games ADD CONSTRAINT games_season_era_id_check
      CHECK (season_era_id IN ('modern', 'lebron', 'jordan'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS roster_refresh_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  expected_team_count INTEGER NOT NULL,
  completed_team_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roster_refresh_staging (
  run_id UUID REFERENCES roster_refresh_runs(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE RESTRICT NOT NULL,
  player_nba_id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  CONSTRAINT roster_refresh_staging_run_player_unique UNIQUE (run_id, player_nba_id)
);

ALTER TABLE roster_refresh_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_refresh_staging ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE roster_refresh_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE roster_refresh_staging FROM PUBLIC, anon, authenticated;

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
  FROM roster_refresh_runs
  WHERE id = p_run_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roster refresh run is missing or not pending';
  END IF;

  SELECT count(DISTINCT team_id) INTO v_staged_team_count
  FROM roster_refresh_staging
  WHERE run_id = p_run_id;
  IF v_staged_team_count <> v_expected_team_count
     OR EXISTS (
       SELECT 1 FROM teams t
       WHERE NOT EXISTS (
         SELECT 1 FROM roster_refresh_staging s
         WHERE s.run_id = p_run_id AND s.team_id = t.id
       )
     )
     OR EXISTS (
       SELECT 1 FROM roster_refresh_staging s
       WHERE s.run_id = p_run_id
         AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = s.team_id)
     ) THEN
    RAISE EXCEPTION 'Roster refresh run does not contain the complete team set';
  END IF;

  IF EXISTS (
    SELECT 1 FROM roster_refresh_staging s
    WHERE s.run_id = p_run_id
      AND NOT EXISTS (SELECT 1 FROM players p WHERE p.nba_id = s.player_nba_id)
  ) THEN
    RAISE EXCEPTION 'Roster refresh contains an unknown player';
  END IF;

  UPDATE players
  SET team_id = NULL, is_active = false, updated_at = now()
  WHERE team_id IS NOT NULL;

  UPDATE players p
  SET team_id = s.team_id, is_active = true, updated_at = now()
  FROM roster_refresh_staging s
  WHERE s.run_id = p_run_id AND p.nba_id = s.player_nba_id;

  UPDATE roster_refresh_runs
  SET status = 'success', completed_team_count = v_staged_team_count, updated_at = now()
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION promote_current_roster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION promote_current_roster(UUID) TO service_role;

COMMIT;
