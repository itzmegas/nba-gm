CREATE TABLE public.calibration_history AS SELECT scheduled_game_id,payload FROM public.game_box_scores;
CREATE TABLE public.calibration_inputs AS
  WITH attributes AS (
    SELECT jsonb_object_agg(key,70) AS attrs FROM unnest(ARRAY[
      'closeShot','midRangeShot','threePointShot','freeThrow','drawFoul','ballHandle','passAccuracy',
      'interiorDefense','perimeterDefense','steal','block','offensiveRebound','defensiveRebound','stamina']) key
  ), roster AS (
    SELECT n,jsonb_build_object('playerId','b0000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'),
      'playerName','Player ' || n,'attributes',attrs) AS player
      FROM generate_series(1,24) n CROSS JOIN attributes
  ) SELECT jsonb_agg(player ORDER BY n) FILTER (WHERE n<=12) AS home,
    jsonb_agg(player ORDER BY n) FILTER (WHERE n>12) AS away FROM roster;
CREATE TABLE public.calibration_sample AS
  SELECT 'v1'::TEXT AS engine, seed,public.simulate_possession_game(home,away,seed::TEXT) AS result
    FROM public.calibration_inputs CROSS JOIN generate_series(1,300) seed;

-- AFTER_MIGRATION_047
INSERT INTO public.calibration_sample(engine,seed,result)
  SELECT 'v2',seed,public.simulate_possession_game(home,away,seed::TEXT)
    FROM public.calibration_inputs CROSS JOIN generate_series(1,300) seed;

DO $$
DECLARE
  result JSONB;
  home JSONB;
  away JSONB;
  small_home JSONB;
  small_away JSONB;
  attrs JSONB;
  weak_attempts INTEGER := 0;
  elite_threes INTEGER := 0;
  seed INTEGER;
  star_seconds INTEGER := 0;
  starter_seconds INTEGER := 0;
  better_wins INTEGER := 0;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.calibration_history h JOIN public.game_box_scores s
    USING (scheduled_game_id) WHERE h.payload<>s.payload), 'Upgrade never rewrites saved statistics';
  ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores WHERE NOT public.is_valid_game_box_score(payload)), 'V1 rows remain readable and valid';
  ASSERT NOT has_function_privilege('authenticated','public.is_valid_game_box_score_v1(jsonb)','EXECUTE'), 'Original validator stays internal';
  ASSERT NOT has_function_privilege('authenticated','public.simulate_possession_game(jsonb,jsonb,text)','EXECUTE'), 'Calibrated engine stays internal';
  ASSERT NOT EXISTS (SELECT 1 FROM public.calibration_sample s WHERE s.engine='v2'
    AND (s.result->>'engineVersion'<>'possessions-v2' OR NOT public.is_valid_game_box_score(s.result))),
    'All calibrated games retain score, shooting and time invariants';
  ASSERT (SELECT sum((s.result->>'overtimes')::INTEGER)>0 FROM public.calibration_sample s
    WHERE s.engine='v2'), 'V2 overtime exercised';
  ASSERT NOT public.is_valid_game_box_score(jsonb_set((SELECT s.result FROM public.calibration_sample s LIMIT 1),
    '{engineVersion}','"unknown"')), 'Reject unknown versions';
  ASSERT (SELECT avg(((s.result->>'homeScore')::INTEGER+(s.result->>'awayScore')::INTEGER)/2.0)
    BETWEEN 100 AND 125 FROM public.calibration_sample s WHERE s.engine='v2'), 'Broad scoring calibration';
  ASSERT (SELECT sum((p->>'threePointersMade')::INTEGER)::NUMERIC /
    nullif(sum((p->>'threePointersAttempted')::INTEGER),0) BETWEEN 0.30 AND 0.40
    FROM public.calibration_sample s CROSS JOIN LATERAL jsonb_array_elements(s.result->'players') p
    WHERE s.engine='v2'), 'Balanced roster outside shooting sanity';

  SELECT i.home,i.away INTO home,away FROM public.calibration_inputs i;
  result := public.simulate_possession_game(home,away,'rotation');
  ASSERT result=public.simulate_possession_game(home,away,'rotation'), 'V2 remains deterministic';
  ASSERT (SELECT count(DISTINCT p->>'seconds')>=3 FROM jsonb_array_elements(result->'players') p
    WHERE p->>'side'='home'), 'Starters, bench and depth no longer share equal minutes';
  ASSERT (SELECT sum((p->>'seconds')::INTEGER) FILTER (WHERE n<=5)
    > sum((p->>'seconds')::INTEGER) FILTER (WHERE n BETWEEN 6 AND 10)
    FROM jsonb_array_elements(result->'players') WITH ORDINALITY AS p(p,n)), 'First unit receives more time';

  SELECT jsonb_agg(p ORDER BY n) INTO small_home FROM jsonb_array_elements(home) WITH ORDINALITY AS p(p,n) WHERE n<=5;
  SELECT jsonb_agg(p ORDER BY n) INTO small_away FROM jsonb_array_elements(away) WITH ORDINALITY AS p(p,n) WHERE n<=5;
  small_home := jsonb_set(small_home,'{0,attributes,threePointShot}','25');
  FOR seed IN 1..30 LOOP
    result := public.simulate_possession_game(small_home,small_away,seed::TEXT);
    ASSERT (result->'players'->0->>'threePointersAttempted')::INTEGER=0,
      'Non-shooters do not take a forced share of threes';
    weak_attempts := weak_attempts + (result->'players'->0->>'fieldGoalsAttempted')::INTEGER;
  END LOOP;
  ASSERT weak_attempts>0, 'Shot-profile test exercises an active scorer, not a DNP';
  small_home := jsonb_set(small_home,'{0,attributes,threePointShot}','99');
  FOR seed IN 1..30 LOOP
    result := public.simulate_possession_game(small_home,small_away,seed::TEXT);
    elite_threes := elite_threes + (result->'players'->0->>'threePointersAttempted')::INTEGER;
  END LOOP;
  ASSERT elite_threes>30, 'Outside specialists take threes';

  SELECT jsonb_object_agg(key,99) INTO attrs
    FROM jsonb_object_keys(home->0->'attributes') key;
  home := jsonb_set(home,'{11,attributes}',attrs);
  FOR seed IN 1..30 LOOP
    result := public.simulate_possession_game(home,away,seed::TEXT);
    star_seconds := star_seconds + (result->'players'->11->>'seconds')::INTEGER;
    starter_seconds := starter_seconds + (result->'players'->0->>'seconds')::INTEGER;
  END LOOP;
  ASSERT star_seconds>starter_seconds, 'Quality, not input order, earns first-unit minutes';
  SELECT jsonb_agg(jsonb_set(p,'{attributes}',attrs)) INTO home FROM jsonb_array_elements(home) p;
  SELECT jsonb_object_agg(key,20) INTO attrs FROM jsonb_object_keys(attrs) key;
  SELECT jsonb_agg(jsonb_set(p,'{attributes}',attrs)) INTO away FROM jsonb_array_elements(away) p;
  FOR seed IN 1..30 LOOP
    result := public.simulate_possession_game(home,away,seed::TEXT);
    IF (result->>'homeScore')::INTEGER>(result->>'awayScore')::INTEGER THEN better_wins:=better_wins+1; END IF;
  END LOOP;
  ASSERT better_wins>=27, 'V2 preserves the effect of individual quality';
END;
$$;

SELECT engine,count(*) AS games,
  round(avg(((result->>'homeScore')::INTEGER+(result->>'awayScore')::INTEGER)/2.0),2) AS points_per_team,
  round(avg((result->>'overtimes')::INTEGER),3) AS overtime_periods_per_game
  FROM public.calibration_sample GROUP BY engine ORDER BY engine;
SELECT engine,
  round(100.0*sum((p->>'threePointersMade')::INTEGER)/nullif(sum((p->>'threePointersAttempted')::INTEGER),0),2) AS three_point_percentage,
  round(100.0*sum((p->>'threePointersAttempted')::INTEGER)/nullif(sum((p->>'fieldGoalsAttempted')::INTEGER),0),2) AS three_point_attempt_share
  FROM public.calibration_sample CROSS JOIN LATERAL jsonb_array_elements(result->'players') p
  GROUP BY engine ORDER BY engine;
SELECT engine,
  round(avg((p->>'seconds')::NUMERIC/60*2880/(2880+300*(result->>'overtimes')::INTEGER))
    FILTER (WHERE (n-1)%12<5),2) AS first_unit_minutes,
  round(avg((p->>'seconds')::NUMERIC/60*2880/(2880+300*(result->>'overtimes')::INTEGER))
    FILTER (WHERE (n-1)%12 BETWEEN 5 AND 9),2) AS bench_minutes
  FROM public.calibration_sample CROSS JOIN LATERAL jsonb_array_elements(result->'players') WITH ORDINALITY AS p(p,n)
  GROUP BY engine ORDER BY engine;

DROP TABLE public.calibration_history,public.calibration_inputs,public.calibration_sample;
