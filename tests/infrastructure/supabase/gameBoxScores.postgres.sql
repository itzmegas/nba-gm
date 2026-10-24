BEGIN;

INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001'), ('a0000000-0000-4000-8000-000000000002');
INSERT INTO public.teams(id,nba_id,name,city,abbreviation,base_rating) VALUES
  ('a1000000-0000-4000-8000-000000000001',9901,'Home','Test','HOM',75),
  ('a1000000-0000-4000-8000-000000000002',9902,'Away','Test','AWY',75),
  ('a1000000-0000-4000-8000-000000000003',9903,'Missing roster','Test','ERR',75);
INSERT INTO public.players(id,first_name,last_name,full_name,position,is_active)
  SELECT ('a2000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
    'Player',n::TEXT,'Player ' || n,'G',true FROM generate_series(1,38) n;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
  SELECT ('a3000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
    'a0000000-0000-4000-8000-000000000001','Possession test',
    'a1000000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing'
    FROM generate_series(1,2) n;
INSERT INTO public.game_player_states(game_id,player_id,team_id,is_active,is_injured)
  SELECT 'a3000000-0000-4000-8000-000000000001',
    ('a2000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,
    CASE WHEN n <= 19 THEN 'a1000000-0000-4000-8000-000000000001'::UUID
      ELSE 'a1000000-0000-4000-8000-000000000002'::UUID END, n <> 19, n = 38
    FROM generate_series(1,38) n;
INSERT INTO public.game_contract_materializations(game_id,source,season,source_version_ids)
  SELECT id,'test','2026-27',array_fill(gen_random_uuid(),ARRAY[30]) FROM public.games
    WHERE id IN ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002');
UPDATE public.games SET status='active'
  WHERE id IN ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002');
INSERT INTO public.player_rating_source_versions(id,game_version,content_hash,payload)
  VALUES ('a4000000-0000-4000-8000-000000000001','2K27',repeat('a',64),'{}');
INSERT INTO public.game_attribute_materializations(game_id,season_year,source_version_id,player_count)
  VALUES ('a3000000-0000-4000-8000-000000000001',2026,'a4000000-0000-4000-8000-000000000001',38);
INSERT INTO public.game_player_attributes(game_id,season_year,player_id,origin,match_method,
  attributes,generator_version,identity_evidence)
  SELECT s.game_id,2026,s.player_id,'estimated','missing-source',
    (SELECT jsonb_object_agg(key,70) FROM unnest(ARRAY[
      'closeShot','midRangeShot','threePointShot','freeThrow','drawFoul','ballHandle','passAccuracy',
      'interiorDefense','perimeterDefense','steal','block','offensiveRebound','defensiveRebound','stamina']) key),
    'replacement-v1','{}' FROM public.game_player_states s
    WHERE s.game_id='a3000000-0000-4000-8000-000000000001';
INSERT INTO public.scheduled_games(id,game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
  VALUES ('a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',
    '2026-10-01','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',
    'completed',100,90,'a1000000-0000-4000-8000-000000000001');
INSERT INTO public.scheduled_games(id,game_id,game_date,home_team_id,away_team_id) VALUES
  ('a5000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001',
    '2026-10-02','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002'),
  ('a5000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001',
    '2026-10-02','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003'),
  ('a5000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000002',
    '2026-10-02','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
INSERT INTO public.league_standings(game_id,team_id)
  SELECT g.id,t.id FROM public.games g CROSS JOIN public.teams t
    WHERE g.id IN ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002')
      AND t.id IN ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  result RECORD;
  saved JSONB;
BEGIN
  BEGIN
    PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-01');
    RAISE EXCEPTION 'Invalid roster accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'At least five available players per team are required' THEN RAISE; END IF;
  END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores), 'Whole day box-score rollback';
  ASSERT (SELECT simulation_date='2026-10-01' FROM public.games WHERE id='a3000000-0000-4000-8000-000000000001'), 'Date rollback';
  ASSERT (SELECT status='scheduled' FROM public.scheduled_games WHERE id='a5000000-0000-4000-8000-000000000002'), 'First fixture rollback';
  ASSERT NOT EXISTS (SELECT 1 FROM public.league_standings WHERE wins>0 OR losses>0), 'Standings rollback';
  DELETE FROM public.scheduled_games WHERE id='a5000000-0000-4000-8000-000000000003';

  DELETE FROM public.game_player_attributes WHERE player_id='a2000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-01');
    RAISE EXCEPTION 'Missing attributes accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Player attribute coverage is incomplete' THEN RAISE; END IF;
  END;
  INSERT INTO public.game_player_attributes(game_id,season_year,player_id,origin,match_method,attributes,generator_version,identity_evidence)
    SELECT game_id,season_year,'a2000000-0000-4000-8000-000000000001','estimated','missing-source',attributes,'replacement-v1','{}'
    FROM public.game_player_attributes WHERE player_id='a2000000-0000-4000-8000-000000000002';

  SELECT * INTO result FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-01');
  SELECT payload INTO saved FROM public.game_box_scores WHERE scheduled_game_id=result.result_id;
  ASSERT saved IS NOT NULL AND public.is_valid_game_box_score(saved), 'Persistent valid box score';
  ASSERT (saved->>'homeScore')::INTEGER=result.home_score AND (saved->>'awayScore')::INTEGER=result.away_score, 'RPC totals match box score';
  ASSERT (SELECT home_score=result.home_score AND away_score=result.away_score FROM public.scheduled_games WHERE id=result.result_id), 'Stored scores match RPC';
  ASSERT jsonb_array_length(saved->'players')=30, 'Dress fifteen per team from larger career rosters';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(saved->'players') p
    WHERE p->>'playerId' IN ('a2000000-0000-4000-8000-000000000019','a2000000-0000-4000-8000-000000000038')),
    'Exclude inactive and injured players';
  ASSERT (SELECT wins=1 FROM public.league_standings WHERE game_id='a3000000-0000-4000-8000-000000000001' AND team_id=result.winner_team_id), 'Correct standings winner';
  PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-01');
  ASSERT (SELECT count(*)=1 FROM public.game_box_scores), 'Stale-date retry cannot duplicate';
  PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-02');
  ASSERT (SELECT payload=saved FROM public.game_box_scores), 'Advancing preserves historical box score';
  ASSERT (SELECT home_score=100 AND away_score=90 FROM public.scheduled_games WHERE id='a5000000-0000-4000-8000-000000000001'), 'Existing result unchanged';
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores WHERE scheduled_game_id='a5000000-0000-4000-8000-000000000001'), 'No invented backfill';
  PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000002','2026-10-01');
  ASSERT (SELECT status='completed' AND home_score<>away_score FROM public.scheduled_games WHERE id='a5000000-0000-4000-8000-000000000004'), 'Legacy simulation still works';
  ASSERT (SELECT count(*)=1 FROM public.game_box_scores), 'Legacy does not fabricate statistics';
END;
$$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT (SELECT count(*)=1 FROM public.game_box_scores), 'Owner can read box score';
  BEGIN
    DELETE FROM public.game_box_scores;
    RAISE EXCEPTION 'Client deleted immutable history';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.simulate_fixture_box_score('a5000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Client called internal engine';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores), 'Other owner cannot read';
  BEGIN
    PERFORM * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-03');
    RAISE EXCEPTION 'Other owner simulated career';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Game not found or access denied' THEN RAISE; END IF;
  END;
END; $$;
RESET ROLE;

ROLLBACK;
