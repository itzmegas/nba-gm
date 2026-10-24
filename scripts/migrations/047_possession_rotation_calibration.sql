BEGIN;

-- Keep the established validation rules and accept both stored engine versions.
ALTER FUNCTION public.is_valid_game_box_score(JSONB) RENAME TO is_valid_game_box_score_v1;
CREATE FUNCTION public.is_valid_game_box_score(p_result JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN p_result->>'engineVersion' IN ('possessions-v1', 'possessions-v2')
    THEN public.is_valid_game_box_score_v1(jsonb_set(p_result, '{engineVersion}', '"possessions-v1"'))
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public.is_valid_game_box_score(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.game_box_scores DROP CONSTRAINT game_box_scores_payload_check;
ALTER TABLE public.game_box_scores ADD CONSTRAINT game_box_scores_payload_check
  CHECK (public.is_valid_game_box_score(payload));

CREATE OR REPLACE FUNCTION public.simulate_possession_game(p_home JSONB, p_away JSONB, p_seed TEXT)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  roster JSONB := p_home || p_away;
  home_count INTEGER := jsonb_array_length(p_home);
  player_count INTEGER := jsonb_array_length(roster);
  attrs JSONB[];
  -- seconds, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, AST, STL, BLK, TOV, PF, PTS.
  stats INTEGER[][] := array_fill(0, ARRAY[player_count, 15]);
  quality NUMERIC[] := array_fill(0::NUMERIC, ARRAY[player_count]);
  depth_rank INTEGER[];
  rotation_weight DOUBLE PRECISION[] := array_fill(0::DOUBLE PRECISION, ARRAY[player_count]);
  home_lineup INTEGER[];
  away_lineup INTEGER[];
  offense INTEGER[];
  defense INTEGER[];
  period INTEGER := 1;
  pairs INTEGER;
  duration INTEGER;
  tick INTEGER;
  side INTEGER;
  i INTEGER;
  shooter INTEGER;
  defender INTEGER;
  passer INTEGER;
  rebounder INTEGER;
  attempt INTEGER;
  shot_value INTEGER;
  free_throws INTEGER;
  ft INTEGER;
  home_score INTEGER := 0;
  away_score INTEGER := 0;
  weight DOUBLE PRECISION;
  target DOUBLE PRECISION;
  probability DOUBLE PRECISION;
  total_weight DOUBLE PRECISION;
  shot_attribute TEXT;
  draw_seed TEXT;
  made BOOLEAN;
  foul BOOLEAN;
  blocked BOOLEAN;
  missed BOOLEAN;
  rows JSONB := '[]';
BEGIN
  IF home_count NOT BETWEEN 5 AND 15 OR jsonb_array_length(p_away) NOT BETWEEN 5 AND 15
     OR (SELECT count(DISTINCT r->>'playerId') FROM jsonb_array_elements(roster) r) <> player_count
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(roster) r
       WHERE NOT coalesce(public.is_valid_player_attributes(r->'attributes'), false)
         OR nullif(r->>'playerName', '') IS NULL) THEN
    RAISE EXCEPTION 'Invalid possession simulation roster';
  END IF;
  SELECT array_agg(r->'attributes' ORDER BY n) INTO attrs
    FROM jsonb_array_elements(roster) WITH ORDINALITY AS r(r, n);
  FOR i IN 1..player_count LOOP
    quality[i] := (SELECT avg(value::NUMERIC) FROM jsonb_each_text(attrs[i]));
  END LOOP;
  SELECT array_agg(depth::INTEGER ORDER BY idx) INTO depth_rank FROM (
    SELECT idx, row_number() OVER (PARTITION BY (idx <= home_count) ORDER BY quality[idx] DESC, idx) AS depth
    FROM generate_series(1, player_count) idx
  ) ranked;
  FOR i IN 1..player_count LOOP
    rotation_weight[i] := CASE WHEN depth_rank[i] <= 5 THEN 2 ELSE 1 END
      * (0.75 + (attrs[i]->>'stamina')::NUMERIC / 198) * (0.5 + quality[i] / 198);
  END LOOP;

  LOOP
    pairs := CASE WHEN period <= 4 THEN 25 ELSE 11 END;
    duration := CASE WHEN period <= 4 THEN 720 ELSE 300 END;
    FOR tick IN 1..pairs LOOP
      -- Weighted playing time gives the first unit roughly twice the bench minutes.
      -- shortcut: foul-outs apply at shift boundaries; use event-clock substitutions for play-by-play.
      IF tick = 1 OR (tick - 1) % 3 = 0 THEN
        SELECT array_agg(idx) INTO home_lineup FROM (
          SELECT idx FROM generate_series(1, home_count) idx
          ORDER BY (stats[idx][14] >= 6), (depth_rank[idx] > 10),
            stats[idx][1] / rotation_weight[idx], depth_rank[idx] LIMIT 5
        ) selected;
        SELECT array_agg(idx) INTO away_lineup FROM (
          SELECT idx FROM generate_series(home_count + 1, player_count) idx
          ORDER BY (stats[idx][14] >= 6), (depth_rank[idx] > 10),
            stats[idx][1] / rotation_weight[idx], depth_rank[idx] LIMIT 5
        ) selected;
      END IF;
      FOREACH i IN ARRAY home_lineup || away_lineup LOOP
        stats[i][1] := stats[i][1] + (tick * duration / pairs - (tick - 1) * duration / pairs);
      END LOOP;

      FOR side IN 0..1 LOOP
        offense := CASE WHEN side = 0 THEN home_lineup ELSE away_lineup END;
        defense := CASE WHEN side = 0 THEN away_lineup ELSE home_lineup END;
        attempt := 0;
        LOOP
          attempt := attempt + 1;
          IF attempt > 100 THEN RAISE EXCEPTION 'Possession did not terminate'; END IF;
          draw_seed := p_seed || ':' || period || ':' || tick || ':' || side || ':' || attempt;
          total_weight := 0;
          FOREACH i IN ARRAY offense LOOP
            total_weight := total_weight + 30 + (attrs[i]->>'closeShot')::INTEGER
              + (attrs[i]->>'threePointShot')::INTEGER + (attrs[i]->>'drawFoul')::INTEGER;
          END LOOP;
          target := public.possession_random(draw_seed, 1) * total_weight;
          shooter := offense[1];
          FOREACH i IN ARRAY offense LOOP
            target := target - (30 + (attrs[i]->>'closeShot')::INTEGER
              + (attrs[i]->>'threePointShot')::INTEGER + (attrs[i]->>'drawFoul')::INTEGER);
            IF target < 0 THEN shooter := i; EXIT; END IF;
          END LOOP;
          defender := defense[1 + floor(public.possession_random(draw_seed, 2) * 5)::INTEGER];
          probability := 0.14 + ((attrs[defender]->>'steal')::INTEGER
            - ((attrs[shooter]->>'ballHandle')::INTEGER + (attrs[shooter]->>'passAccuracy')::INTEGER) / 2.0) * 0.001;
          IF public.possession_random(draw_seed, 3) < probability THEN
            stats[shooter][13] := stats[shooter][13] + 1;
            IF public.possession_random(draw_seed, 4) < 0.45 + (attrs[defender]->>'steal')::INTEGER * 0.003 THEN
              stats[defender][11] := stats[defender][11] + 1;
            END IF;
            EXIT;
          END IF;
          -- Low-rated outside shooters should not take a forced baseline share of threes.
          shot_value := CASE WHEN public.possession_random(draw_seed, 5)
            < least(0.65, greatest(0, ((attrs[shooter]->>'threePointShot')::INTEGER - 35) * 0.01)) THEN 3 ELSE 2 END;
          shot_attribute := CASE WHEN shot_value = 3 THEN 'threePointShot'
            WHEN public.possession_random(draw_seed, 6) < 0.7 THEN 'closeShot' ELSE 'midRangeShot' END;
          foul := public.possession_random(draw_seed, 7) < 0.04 + (attrs[shooter]->>'drawFoul')::INTEGER * 0.001;
          blocked := NOT foul AND public.possession_random(draw_seed, 8)
            < 0.005 + (attrs[defender]->>'block')::INTEGER * CASE WHEN shot_value = 3 THEN 0.0003 ELSE 0.0007 END;
          probability := CASE WHEN shot_value = 3 THEN
              0.12 + (attrs[shooter]->>'threePointShot')::INTEGER * 0.0042
                - (attrs[defender]->>'perimeterDefense')::INTEGER * 0.001
            ELSE CASE shot_attribute WHEN 'closeShot' THEN 0.35 ELSE 0.24 END
              + (attrs[shooter]->>shot_attribute)::INTEGER * 0.004
              - (attrs[defender]->>'interiorDefense')::INTEGER * 0.0015 END
            + CASE WHEN side = 0 THEN 0.012 ELSE 0 END;
          made := NOT blocked AND public.possession_random(draw_seed, 9) < probability;
          IF NOT foul OR made THEN
            stats[shooter][3] := stats[shooter][3] + 1;
            IF shot_value = 3 THEN stats[shooter][5] := stats[shooter][5] + 1; END IF;
          END IF;
          IF blocked THEN stats[defender][12] := stats[defender][12] + 1; END IF;
          IF made THEN
            stats[shooter][2] := stats[shooter][2] + 1;
            IF shot_value = 3 THEN stats[shooter][4] := stats[shooter][4] + 1; END IF;
            stats[shooter][15] := stats[shooter][15] + shot_value;
            SELECT idx INTO passer FROM unnest(offense) idx WHERE idx <> shooter
              ORDER BY public.possession_random(draw_seed || ':' || idx, 10)
                / (20 + (attrs[idx]->>'passAccuracy')::INTEGER) LIMIT 1;
            IF public.possession_random(draw_seed, 11) < 0.3 + (attrs[passer]->>'passAccuracy')::INTEGER * 0.005 THEN
              stats[passer][10] := stats[passer][10] + 1;
            END IF;
          END IF;
          missed := NOT made;
          IF foul THEN
            stats[defender][14] := stats[defender][14] + 1;
            free_throws := CASE WHEN made THEN 1 ELSE shot_value END;
            FOR ft IN 1..free_throws LOOP
              stats[shooter][7] := stats[shooter][7] + 1;
              missed := public.possession_random(draw_seed, 11 + ft)
                >= 0.4 + (attrs[shooter]->>'freeThrow')::INTEGER * 0.0055;
              IF NOT missed THEN
                stats[shooter][6] := stats[shooter][6] + 1;
                stats[shooter][15] := stats[shooter][15] + 1;
              END IF;
            END LOOP;
          END IF;
          IF NOT missed THEN EXIT; END IF;
          total_weight := 0;
          FOREACH i IN ARRAY offense || defense LOOP
            total_weight := total_weight + CASE WHEN i = ANY(offense)
              THEN 10 + (attrs[i]->>'offensiveRebound')::INTEGER
              ELSE 60 + (attrs[i]->>'defensiveRebound')::INTEGER * 2.5 END;
          END LOOP;
          target := public.possession_random(draw_seed, 15) * total_weight;
          rebounder := defense[1];
          FOREACH i IN ARRAY offense || defense LOOP
            weight := CASE WHEN i = ANY(offense) THEN 10 + (attrs[i]->>'offensiveRebound')::INTEGER
              ELSE 60 + (attrs[i]->>'defensiveRebound')::INTEGER * 2.5 END;
            target := target - weight;
            IF target < 0 THEN rebounder := i; EXIT; END IF;
          END LOOP;
          IF rebounder = ANY(defense) THEN
            stats[rebounder][9] := stats[rebounder][9] + 1;
            EXIT;
          END IF;
          stats[rebounder][8] := stats[rebounder][8] + 1;
        END LOOP;
      END LOOP;
    END LOOP;
    IF period >= 4 THEN
      home_score := 0; away_score := 0;
      FOR i IN 1..player_count LOOP
        IF i <= home_count THEN home_score := home_score + stats[i][15];
        ELSE away_score := away_score + stats[i][15]; END IF;
      END LOOP;
      IF home_score <> away_score THEN EXIT; END IF;
      IF period >= 24 THEN RAISE EXCEPTION 'Overtime limit exceeded'; END IF;
    END IF;
    period := period + 1;
  END LOOP;
  FOR i IN 1..player_count LOOP
    rows := rows || jsonb_build_array(jsonb_build_object(
      'playerId', roster->(i-1)->>'playerId', 'playerName', roster->(i-1)->>'playerName',
      'side', CASE WHEN i <= home_count THEN 'home' ELSE 'away' END,
      'seconds', stats[i][1], 'fieldGoalsMade', stats[i][2], 'fieldGoalsAttempted', stats[i][3],
      'threePointersMade', stats[i][4], 'threePointersAttempted', stats[i][5],
      'freeThrowsMade', stats[i][6], 'freeThrowsAttempted', stats[i][7],
      'offensiveRebounds', stats[i][8], 'defensiveRebounds', stats[i][9],
      'assists', stats[i][10], 'steals', stats[i][11], 'blocks', stats[i][12],
      'turnovers', stats[i][13], 'personalFouls', stats[i][14], 'points', stats[i][15]));
  END LOOP;
  RETURN jsonb_build_object('engineVersion', 'possessions-v2', 'overtimes', period - 4,
    'homeScore', home_score, 'awayScore', away_score, 'players', rows);
END;
$$;
REVOKE ALL ON FUNCTION public.simulate_possession_game(JSONB, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
