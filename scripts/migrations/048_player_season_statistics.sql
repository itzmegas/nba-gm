BEGIN;

-- Existing careers only have a single regular season; preserve all results and payloads.
ALTER TABLE public.scheduled_games ADD COLUMN season_year INTEGER;
ALTER TABLE public.scheduled_games ADD COLUMN competition_phase TEXT NOT NULL DEFAULT 'regular_season'
  CHECK (competition_phase IN ('regular_season', 'play_in', 'playoffs'));
UPDATE public.scheduled_games f SET season_year = g.season_year
  FROM public.games g WHERE g.id = f.game_id;
ALTER TABLE public.scheduled_games ALTER COLUMN season_year SET NOT NULL;

CREATE FUNCTION public.assign_fixture_season() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.season_year IS NULL THEN
    SELECT season_year INTO NEW.season_year FROM public.games WHERE id = NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_fixture_season() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER scheduled_games_assign_season BEFORE INSERT ON public.scheduled_games
  FOR EACH ROW EXECUTE FUNCTION public.assign_fixture_season();
CREATE INDEX scheduled_games_season_phase_idx
  ON public.scheduled_games(game_id, season_year, competition_phase);

CREATE FUNCTION public.get_player_season_statistics(p_game_id UUID, p_season_year INTEGER,
  p_phase TEXT DEFAULT 'regular_season') RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH fixtures AS (
    SELECT f.id, b.payload FROM public.scheduled_games f
    LEFT JOIN public.game_box_scores b ON b.game_id = f.game_id AND b.scheduled_game_id = f.id
    WHERE f.game_id = p_game_id AND f.season_year = p_season_year
      AND f.competition_phase = p_phase AND f.status = 'completed'
      AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = f.game_id
        AND g.user_id = auth.uid() AND g.deleted_at IS NULL)
  ), appearances AS (
    SELECT f.id, p FROM fixtures f CROSS JOIN LATERAL jsonb_array_elements(f.payload->'players') p
    WHERE (p->>'seconds')::INTEGER > 0
  ), players AS (
    SELECT p->>'playerId' AS player_id, max(p->>'playerName') AS player_name,
      count(*) AS games_played FROM appearances GROUP BY p->>'playerId'
  ), totals AS (
    SELECT a.p->>'playerId' AS player_id, v.key, sum(v.value::BIGINT) AS total
    FROM appearances a CROSS JOIN LATERAL jsonb_each_text(a.p) v
    WHERE v.key IN ('seconds','fieldGoalsMade','fieldGoalsAttempted','threePointersMade',
      'threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds',
      'defensiveRebounds','assists','steals','blocks','turnovers','personalFouls','points')
    GROUP BY a.p->>'playerId', v.key
  ), rows AS (
    SELECT jsonb_build_object('playerId', p.player_id, 'playerName', p.player_name,
      'gamesPlayed', p.games_played, 'totals', jsonb_object_agg(t.key, t.total)) AS row
    FROM players p JOIN totals t USING (player_id)
    GROUP BY p.player_id, p.player_name, p.games_played
  )
  SELECT jsonb_build_object('completedGames', (SELECT count(*) FROM fixtures),
    'coveredGames', (SELECT count(payload) FROM fixtures),
    'players', coalesce((SELECT jsonb_agg(row ORDER BY row->>'playerId') FROM rows), '[]'::JSONB));
$$;
REVOKE ALL ON FUNCTION public.get_player_season_statistics(UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_player_season_statistics(UUID, INTEGER, TEXT) TO authenticated;
GRANT SELECT ON public.scheduled_games TO authenticated;

COMMIT;
