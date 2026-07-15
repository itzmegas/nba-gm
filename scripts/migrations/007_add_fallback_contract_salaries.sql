-- Migration 007: assign approximate salaries to modern and visual-only fallback contracts.
-- Migration 006 intentionally isolated fallback contracts but created them with zero salaries.

BEGIN;

CREATE OR REPLACE FUNCTION seed_game_data(p_game_id UUID, p_team_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season_year INTEGER; v_has_historical_templates BOOLEAN;
BEGIN
  SELECT g.season_year INTO v_season_year FROM games g
  WHERE g.id = p_game_id AND g.selected_team_id = p_team_id AND g.user_id = auth.uid();
  IF v_season_year IS NULL THEN
    RAISE EXCEPTION 'seed_game_data aborted: game % does not exist, is not owned by the caller, or does not match selected_team_id %', p_game_id, p_team_id;
  END IF;
  SELECT EXISTS (SELECT 1 FROM historical_roster_templates WHERE season_year = v_season_year)
  INTO v_has_historical_templates;
  IF v_season_year = 2010 AND NOT v_has_historical_templates THEN
    RAISE EXCEPTION 'seed_game_data aborted: historical templates for season % are not loaded', v_season_year;
  END IF;

  IF v_has_historical_templates THEN
    INSERT INTO game_player_states (game_id, player_id, team_id, is_active)
    SELECT p_game_id, player_id, team_id, is_active FROM historical_roster_templates
    WHERE season_year = v_season_year
    ON CONFLICT (game_id, player_id) DO UPDATE SET team_id = EXCLUDED.team_id, is_active = EXCLUDED.is_active, updated_at = now();
    INSERT INTO contracts (game_id, player_id, team_id, start_year, end_year, salary_y1, salary_y2, salary_y3, salary_y4, salary_y5, is_player_option, is_team_option, is_guaranteed)
    SELECT p_game_id, h.player_id, h.team_id, h.start_year, h.end_year, h.salary_y1, h.salary_y2, h.salary_y3, h.salary_y4, h.salary_y5, h.is_player_option, h.is_team_option, h.is_guaranteed
    FROM historical_contract_templates h
    WHERE h.season_year = v_season_year
      AND EXISTS (SELECT 1 FROM game_player_states s WHERE s.game_id = p_game_id AND s.player_id = h.player_id)
      AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.game_id = p_game_id AND c.player_id = h.player_id);
  ELSE
    INSERT INTO game_player_states (game_id, player_id, team_id)
    SELECT p_game_id, id, team_id FROM players WHERE team_id IS NOT NULL
    ON CONFLICT (game_id, player_id) DO UPDATE SET team_id = EXCLUDED.team_id, updated_at = now();

    INSERT INTO contracts (game_id, player_id, team_id, start_year, end_year, salary_y1, salary_y2, salary_y3, salary_y4, salary_y5, is_player_option, is_team_option, is_guaranteed)
    SELECT p_game_id, ranked.player_id, ranked.team_id, v_season_year, v_season_year + 4,
      ranked.salary, round(ranked.salary * 1.05), round(ranked.salary * 1.1025),
      round(ranked.salary * 1.157625), round(ranked.salary * 1.21550625), false, false, true
    FROM (
      SELECT p.id AS player_id, p.team_id,
        CASE
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) = 1 THEN 45000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 3 THEN 30000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 6 THEN 15000000
          WHEN row_number() OVER (PARTITION BY p.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 10 THEN 7000000
          ELSE 2000000
        END AS salary
      FROM players p WHERE p.team_id IS NOT NULL
    ) ranked
    WHERE EXISTS (SELECT 1 FROM game_player_states s WHERE s.game_id = p_game_id AND s.player_id = ranked.player_id)
      AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.game_id = p_game_id AND c.player_id = ranked.player_id);
  END IF;
END;
$$;

-- Repair fallback games already seeded by migration 006 without touching historical contracts.
WITH ranked_contracts AS (
  SELECT c.id,
    CASE
      WHEN row_number() OVER (PARTITION BY c.game_id, c.team_id ORDER BY p.nba_id NULLS LAST, p.id) = 1 THEN 45000000
      WHEN row_number() OVER (PARTITION BY c.game_id, c.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 3 THEN 30000000
      WHEN row_number() OVER (PARTITION BY c.game_id, c.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 6 THEN 15000000
      WHEN row_number() OVER (PARTITION BY c.game_id, c.team_id ORDER BY p.nba_id NULLS LAST, p.id) <= 10 THEN 7000000
      ELSE 2000000
    END AS salary
  FROM contracts c
  JOIN games g ON g.id = c.game_id
  JOIN players p ON p.id = c.player_id
  WHERE c.salary_y1 = 0
    AND NOT EXISTS (SELECT 1 FROM historical_roster_templates h WHERE h.season_year = g.season_year)
)
UPDATE contracts c SET
  salary_y1 = r.salary,
  salary_y2 = round(r.salary * 1.05),
  salary_y3 = round(r.salary * 1.1025),
  salary_y4 = round(r.salary * 1.157625),
  salary_y5 = round(r.salary * 1.21550625),
  updated_at = now()
FROM ranked_contracts r WHERE c.id = r.id;

REVOKE ALL ON FUNCTION seed_game_data(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_game_data(UUID, UUID) TO authenticated;
COMMIT;
