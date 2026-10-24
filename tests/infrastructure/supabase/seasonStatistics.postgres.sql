CREATE TEMP TABLE saved_payloads AS SELECT * FROM public.game_box_scores;
CREATE TEMP TABLE saved_results AS SELECT id, home_score, away_score, winner_team_id, status FROM public.scheduled_games;
\ir ../../../scripts/migrations/048_player_season_statistics.sql
BEGIN;
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT * FROM saved_payloads EXCEPT SELECT * FROM public.game_box_scores), 'Payloads unchanged';
  ASSERT NOT EXISTS (SELECT * FROM saved_results EXCEPT SELECT id,home_score,away_score,winner_team_id,status FROM public.scheduled_games), 'Results unchanged';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scheduled_games WHERE season_year IS NULL OR competition_phase <> 'regular_season'), 'Legacy attribution';
END $$;

-- Duplicate one recorded performance in another fixture to verify true accumulation.
INSERT INTO public.scheduled_games(id,game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
SELECT 'a5000000-0000-4000-8000-000000000006',game_id,'2026-10-05',home_team_id,away_team_id,status,home_score,away_score,winner_team_id
FROM public.scheduled_games WHERE id='a5000000-0000-4000-8000-000000000005';
INSERT INTO public.game_box_scores(game_id,scheduled_game_id,payload)
SELECT game_id,'a5000000-0000-4000-8000-000000000006',payload FROM public.game_box_scores
WHERE scheduled_game_id='a5000000-0000-4000-8000-000000000005';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE result JSONB; expected RECORD; actual JSONB; BEGIN
  result := public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026);
  ASSERT (result->>'coveredGames')::INTEGER=3, 'Both engine versions and duplicated fixture included';
  ASSERT (result->>'completedGames')::INTEGER > 3, 'Historical missing coverage disclosed';
  ASSERT jsonb_array_length(result->'players') = (SELECT count(DISTINCT p->>'playerId')
    FROM public.game_box_scores b CROSS JOIN LATERAL jsonb_array_elements(b.payload->'players') p
    WHERE b.game_id='a3000000-0000-4000-8000-000000000001' AND (p->>'seconds')::INTEGER>0), 'No DNP-only rows';
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000002',2026)->>'coveredGames'='0', 'Career isolation';
  FOR expected IN
    SELECT p->>'playerId' AS id, count(*) AS gp, sum((p->>'points')::INTEGER) AS points,
      sum((p->>'seconds')::INTEGER) AS seconds
    FROM public.game_box_scores b CROSS JOIN LATERAL jsonb_array_elements(b.payload->'players') p
    WHERE b.game_id='a3000000-0000-4000-8000-000000000001' AND (p->>'seconds')::INTEGER>0
    GROUP BY p->>'playerId'
  LOOP
    SELECT r INTO actual FROM jsonb_array_elements(result->'players') r WHERE r->>'playerId'=expected.id;
    ASSERT actual IS NOT NULL, 'Player retained';
    ASSERT (actual->>'gamesPlayed')::INTEGER=expected.gp, 'DNP excluded from GP';
    ASSERT (actual->'totals'->>'points')::INTEGER=expected.points, 'Points summed';
    ASSERT (actual->'totals'->>'seconds')::INTEGER=expected.seconds, 'Seconds summed';
    ASSERT actual->'totals' = (SELECT jsonb_object_agg(key,total) FROM (
      SELECT v.key, sum(v.value::BIGINT) total FROM public.game_box_scores b
      CROSS JOIN LATERAL jsonb_array_elements(b.payload->'players') p
      CROSS JOIN LATERAL jsonb_each_text(p) v
      WHERE b.game_id='a3000000-0000-4000-8000-000000000001'
        AND p->>'playerId'=expected.id AND (p->>'seconds')::INTEGER>0
        AND v.key NOT IN ('playerId','playerName','side') GROUP BY v.key
    ) sums), 'Every numeric total matches source performances';
  END LOOP;
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2025)->'players'='[]'::JSONB, 'Season isolation';
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026,'playoffs')->'players'='[]'::JSONB, 'Phase isolation';
END $$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026)->'players'='[]'::JSONB, 'Other owner cannot read';
END $$;
RESET ROLE;
UPDATE public.scheduled_games SET competition_phase='playoffs'
WHERE id='a5000000-0000-4000-8000-000000000006';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026)->>'coveredGames'='2', 'Postseason excluded from regular season';
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026,'playoffs')->>'coveredGames'='1', 'Postseason separately queryable';
END $$;
RESET ROLE;
UPDATE public.scheduled_games SET competition_phase='regular_season',season_year=2025
WHERE id='a5000000-0000-4000-8000-000000000006';
UPDATE public.games SET season_year=2027 WHERE id='a3000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2026)->>'coveredGames'='2', 'Fixture season independent of mutable career year';
  ASSERT public.get_player_season_statistics('a3000000-0000-4000-8000-000000000001',2025)->>'coveredGames'='1', 'Past season separately queryable';
END $$;
RESET ROLE;
ROLLBACK;
