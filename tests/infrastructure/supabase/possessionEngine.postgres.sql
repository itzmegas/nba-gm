BEGIN;

DO $$
DECLARE
  home JSONB;
  away JSONB;
  result JSONB;
  other JSONB;
  seed INTEGER;
  overtime_count INTEGER := 0;
  total_points INTEGER := 0;
  better_wins INTEGER := 0;
  attrs JSONB;
BEGIN
  SELECT jsonb_object_agg(key, 70) INTO attrs FROM unnest(ARRAY[
    'closeShot','midRangeShot','threePointShot','freeThrow','drawFoul','ballHandle','passAccuracy',
    'interiorDefense','perimeterDefense','steal','block','offensiveRebound','defensiveRebound','stamina']) key;
  SELECT jsonb_agg(jsonb_build_object('playerId',
    '10000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'), 'playerName','Player ' || n,
    'attributes',attrs)) INTO home FROM generate_series(1,12) n;
  SELECT jsonb_agg(jsonb_build_object('playerId',
    '20000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'), 'playerName','Opponent ' || n,
    'attributes',attrs)) INTO away FROM generate_series(1,12) n;
  result := public.simulate_possession_game(home,away,'reproducible');
  ASSERT result = public.simulate_possession_game(home,away,'reproducible'), 'Deterministic seed';
  ASSERT result <> public.simulate_possession_game(home,away,'different'), 'Different seeds';
  ASSERT NOT public.is_valid_game_box_score(jsonb_set(result,'{players,0,points}','999')), 'Reject inconsistent points';
  ASSERT NOT public.is_valid_game_box_score(jsonb_set(result,'{players,0,seconds}','9999')), 'Reject impossible minutes';
  ASSERT NOT public.is_valid_game_box_score(result - 'homeScore'), 'Reject missing totals';
  ASSERT NOT public.is_valid_game_box_score(jsonb_set(result,'{homeScore}','null')), 'Reject null totals';
  ASSERT NOT public.is_valid_game_box_score(jsonb_set(result,'{players,0,freeThrowsMade}','null')), 'Reject null statistics';
  BEGIN
    PERFORM public.simulate_possession_game(home - 0 - 0 - 0 - 0 - 0 - 0 - 0 - 0,away,'short');
    RAISE EXCEPTION 'Undersized roster accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid possession simulation roster' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.simulate_possession_game(home,home,'duplicate');
    RAISE EXCEPTION 'Duplicate identity accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid possession simulation roster' THEN RAISE; END IF;
  END;

  FOR seed IN 1..100 LOOP
    result := public.simulate_possession_game(home,away,seed::TEXT);
    ASSERT public.is_valid_game_box_score(result), 'Scores, shooting and minutes reconcile';
    overtime_count := overtime_count + (result->>'overtimes')::INTEGER;
    total_points := total_points + (result->>'homeScore')::INTEGER + (result->>'awayScore')::INTEGER;
    ASSERT NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(result->'players') p WHERE (p->>'seconds')::INTEGER = 0
      AND (p->>'points')::INTEGER <> 0), 'DNP players cannot score';
    ASSERT (SELECT sum((p->>'steals')::INTEGER) <= sum((p->>'turnovers')::INTEGER)
      FROM jsonb_array_elements(result->'players') p), 'Steals require turnovers';
    ASSERT (SELECT sum((p->>'blocks')::INTEGER) <=
      sum((p->>'fieldGoalsAttempted')::INTEGER - (p->>'fieldGoalsMade')::INTEGER)
      FROM jsonb_array_elements(result->'players') p), 'Blocks require missed field goals';
  END LOOP;
  ASSERT overtime_count > 0, 'Overtime exercised without fabricated tie-breaker';
  ASSERT total_points / 200.0 BETWEEN 85 AND 135, 'Broad scoring sanity check';

  SELECT jsonb_agg(jsonb_set(p,'{attributes}',
    (SELECT jsonb_object_agg(key,99) FROM jsonb_object_keys(attrs) key))) INTO home
    FROM jsonb_array_elements(home) p;
  SELECT jsonb_agg(jsonb_set(p,'{attributes}',
    (SELECT jsonb_object_agg(key,20) FROM jsonb_object_keys(attrs) key))) INTO away
    FROM jsonb_array_elements(away) p;
  FOR seed IN 1..30 LOOP
    other := public.simulate_possession_game(home,away,seed::TEXT);
    IF (other->>'homeScore')::INTEGER > (other->>'awayScore')::INTEGER THEN better_wins := better_wins + 1; END IF;
  END LOOP;
  ASSERT better_wins >= 27, 'Individual attributes materially affect outcomes';
  RAISE NOTICE '100 games: average team points %, overtime periods %; better roster wins %/30',
    total_points / 200.0, overtime_count, better_wins;
END;
$$;

ROLLBACK;
