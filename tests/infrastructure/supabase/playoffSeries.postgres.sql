-- Existing 049/050 terminal assertions run before this upgrade, never against 052 semantics.
CREATE TEMP TABLE playoff_upgrade_games AS SELECT * FROM public.games;
CREATE TABLE public.playoff_upgrade_fixtures AS SELECT * FROM public.scheduled_games;
CREATE TABLE public.playoff_upgrade_payloads AS SELECT * FROM public.game_box_scores;
CREATE TABLE public.playoff_upgrade_seeds AS SELECT * FROM public.postseason_playoff_seeds;
CREATE TABLE public.playoff_upgrade_playin AS SELECT * FROM public.postseason_play_in_games;

-- AFTER_MIGRATION_052
DO $$ DECLARE role_name TEXT; table_name TEXT; operation TEXT; BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_series), 'Installing 052 creates no series';
  ASSERT (SELECT count(*)=0 FROM public.postseason_series_games), 'Installing 052 schedules no fixtures';
  ASSERT (SELECT count(*)=0 FROM public.postseason_results), 'Installing 052 declares no champion';
  ASSERT NOT EXISTS ((SELECT * FROM playoff_upgrade_games EXCEPT SELECT * FROM public.games)
    UNION ALL (SELECT * FROM public.games EXCEPT SELECT * FROM playoff_upgrade_games)), 'Upgrade changes no career';
  ASSERT NOT EXISTS ((SELECT * FROM playoff_upgrade_fixtures EXCEPT SELECT * FROM public.scheduled_games)
    UNION ALL (SELECT * FROM public.scheduled_games EXCEPT SELECT * FROM playoff_upgrade_fixtures)), 'Upgrade changes no fixture';
  ASSERT NOT EXISTS ((SELECT * FROM playoff_upgrade_payloads EXCEPT SELECT * FROM public.game_box_scores)
    UNION ALL (SELECT * FROM public.game_box_scores EXCEPT SELECT * FROM playoff_upgrade_payloads)), 'Upgrade changes no payload';
  ASSERT NOT EXISTS ((SELECT * FROM playoff_upgrade_seeds EXCEPT SELECT * FROM public.postseason_playoff_seeds)
    UNION ALL (SELECT * FROM public.postseason_playoff_seeds EXCEPT SELECT * FROM playoff_upgrade_seeds)), 'Upgrade changes no seed';
  FOREACH table_name IN ARRAY ARRAY['postseason_series','postseason_series_games','postseason_results'] LOOP
    ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||table_name)::REGCLASS), 'Postseason RLS enabled';
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        ASSERT NOT has_table_privilege(role_name,'public.'||table_name,operation), 'No client or service-role postseason writes';
      END LOOP;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    ASSERT NOT has_function_privilege(role_name,'public.prepare_playoffs(uuid)','EXECUTE'), 'No direct playoff helper bypass';
    ASSERT NOT has_function_privilege(role_name,'public.prepare_play_in(uuid)','EXECUTE'), 'No direct play-in helper bypass';
    ASSERT NOT has_function_privilege(role_name,'public.advance_qualification_day(uuid,date)','EXECUTE'), 'No qualification bypass';
  END LOOP;
  ASSERT NOT has_function_privilege('anon','public.get_postseason_state(uuid)','EXECUTE'), 'No anonymous state RPC';
  ASSERT NOT has_function_privilege('service_role','public.get_postseason_state(uuid)','EXECUTE'), 'No service-role state RPC';
  ASSERT has_function_privilege('authenticated','public.get_postseason_state(uuid)','EXECUTE'), 'Owner state RPC available';
END $$;

-- PLAYOFF_EDGE_CASES
-- Deferred until both real journeys finish; these edge fixtures never override their results.
BEGIN;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b3000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001',
  'Deterministic bracket edges','b1000000-0000-4000-8000-000000000001',2026,'jordan','2027-04-19','active');
INSERT INTO public.postseason_qualifications SELECT 'b3000000-0000-4000-8000-000000000005',season_year,team_id,conference,seed,wins,losses,draw_order
  FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000001';
INSERT INTO public.postseason_playoff_seeds SELECT 'b3000000-0000-4000-8000-000000000005',season_year,team_id,conference,seed
  FROM public.postseason_playoff_seeds WHERE game_id='b3000000-0000-4000-8000-000000000001';
DO $$ DECLARE career UUID:='b3000000-0000-4000-8000-000000000005';
  series public.postseason_series%ROWTYPE; fixture public.scheduled_games%ROWTYPE; n INTEGER; winner UUID; observed UUID[]:=ARRAY[]::UUID[];
BEGIN
  PERFORM public.prepare_playoffs(career);
  SELECT * INTO STRICT series FROM public.postseason_series WHERE game_id=career AND conference='East' AND bracket_slot=1;
  FOR n IN 1..7 LOOP
    SELECT f.* INTO STRICT fixture FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=series.id AND l.game_number=n;
    observed:=array_append(observed,fixture.home_team_id);
    winner:=CASE WHEN n IN (1,3,5) THEN series.home_team_id ELSE series.away_team_id END;
    UPDATE public.scheduled_games SET status='completed',winner_team_id=winner,
      home_score=CASE WHEN winner=home_team_id THEN 110 ELSE 90 END,
      away_score=CASE WHEN winner=away_team_id THEN 110 ELSE 90 END WHERE id=fixture.id;
    PERFORM public.prepare_playoffs(career);
    IF n=6 THEN
      ASSERT (SELECT home_wins=3 AND away_wins=3 AND winner_team_id IS NULL FROM public.postseason_series WHERE id=series.id), '3-3 schedules game seven, not a premature clinch';
    END IF;
  END LOOP;
  ASSERT observed=ARRAY[series.home_team_id,series.home_team_id,series.away_team_id,series.away_team_id,series.home_team_id,series.away_team_id,series.home_team_id], 'Exact seven-game 2-2-1-1-1 pattern';
  ASSERT (SELECT away_wins=4 AND home_wins=3 AND winner_team_id=series.away_team_id FROM public.postseason_series WHERE id=series.id), 'Eighth seed wins game seven';
  ASSERT (SELECT count(*)=7 FROM public.postseason_series_games WHERE series_id=series.id), 'No eighth fixture after game-seven clinch';
  ASSERT (SELECT count(*)=0 FROM public.postseason_series WHERE game_id=career AND round>1), 'One completed series cannot start next round';
  SELECT * INTO STRICT series FROM public.postseason_series WHERE game_id=career AND conference='East' AND bracket_slot=3 AND round=1;
  FOR n IN 1..4 LOOP
    SELECT f.* INTO STRICT fixture FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=series.id AND l.game_number=n;
    UPDATE public.scheduled_games SET status='completed',winner_team_id=series.away_team_id,
      home_score=CASE WHEN series.away_team_id=home_team_id THEN 110 ELSE 90 END,
      away_score=CASE WHEN series.away_team_id=away_team_id THEN 110 ELSE 90 END WHERE id=fixture.id;
    PERFORM public.prepare_playoffs(career);
  END LOOP;
  ASSERT (SELECT away_wins=4 AND home_wins=0 FROM public.postseason_series WHERE id=series.id), 'Seventh seed sweeps in four';
  ASSERT (SELECT count(*)=4 FROM public.postseason_series_games WHERE series_id=series.id), 'Sweep creates no unnecessary game five';
  UPDATE public.postseason_series SET home_wins=4,away_wins=0,winner_team_id=home_team_id WHERE game_id=career AND winner_team_id IS NULL;
  PERFORM public.prepare_playoffs(career);
  ASSERT (SELECT h.seed=4 AND a.seed=8 FROM public.postseason_series s
    JOIN public.postseason_playoff_seeds h ON h.game_id=s.game_id AND h.team_id=s.home_team_id
    JOIN public.postseason_playoff_seeds a ON a.game_id=s.game_id AND a.team_id=s.away_team_id
    WHERE s.game_id=career AND s.round=2 AND s.conference='East' AND s.bracket_slot=1), 'Upset keeps 8 versus 4 in adjacent semifinal';
  ASSERT (SELECT h.seed=3 AND a.seed=7 FROM public.postseason_series s
    JOIN public.postseason_playoff_seeds h ON h.game_id=s.game_id AND h.team_id=s.home_team_id
    JOIN public.postseason_playoff_seeds a ON a.game_id=s.game_id AND a.team_id=s.away_team_id
    WHERE s.game_id=career AND s.round=2 AND s.conference='East' AND s.bracket_slot=2), 'No reseeding to 3 versus 8';
END $$;
ROLLBACK;

-- Finals home court: isolate every criterion; live standings deliberately disagree.
-- Each subtransaction is discarded, including its synthetic regular-season history.
DO $$ DECLARE scenario INTEGER; career UUID:='b3000000-0000-4000-8000-000000000005';
  a UUID; b UUID; other UUID; expected UUID; candidates UUID[];
BEGIN
  SELECT array_agg(q.team_id ORDER BY q.draw_order DESC) INTO candidates FROM public.postseason_qualifications q
    JOIN public.postseason_series s ON s.game_id=q.game_id AND s.winner_team_id=q.team_id
    WHERE s.game_id='b3000000-0000-4000-8000-000000000001' AND s.round=3;
  a:=candidates[1]; b:=candidates[2];
  SELECT team_id INTO STRICT other FROM public.postseason_qualifications
    WHERE game_id='b3000000-0000-4000-8000-000000000001' AND team_id NOT IN (a,b) ORDER BY seed LIMIT 1;
  FOR scenario IN 1..5 LOOP
    BEGIN
      INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
      VALUES (career,'b0000000-0000-4000-8000-000000000001','Finals tiebreak test',a,2026,'jordan','2027-04-19','active');
      INSERT INTO public.postseason_qualifications SELECT career,season_year,team_id,conference,seed,wins,losses,draw_order
        FROM public.postseason_qualifications WHERE game_id='b3000000-0000-4000-8000-000000000001';
      INSERT INTO public.postseason_playoff_seeds SELECT career,season_year,team_id,conference,seed
        FROM public.postseason_playoff_seeds WHERE game_id='b3000000-0000-4000-8000-000000000001';
      INSERT INTO public.postseason_series(game_id,season_year,round,conference,bracket_slot,home_team_id,away_team_id,home_wins,away_wins,winner_team_id)
        SELECT career,season_year,round,conference,bracket_slot,home_team_id,away_team_id,home_wins,away_wins,winner_team_id
        FROM public.postseason_series WHERE game_id='b3000000-0000-4000-8000-000000000001' AND round<=3;
      UPDATE public.postseason_qualifications SET wins=CASE WHEN team_id=a THEN 1 ELSE 40 END,
        losses=CASE WHEN scenario=1 AND team_id=a THEN 0 WHEN team_id=a THEN 1 ELSE 40 END
        WHERE game_id=career AND team_id IN (a,b);
      INSERT INTO public.league_standings(game_id,team_id,wins,losses) VALUES (career,a,0,82),(career,b,82,0);
      IF scenario<5 THEN
        INSERT INTO public.scheduled_games(game_id,season_year,competition_phase,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
        VALUES (career,2026,'regular_season','2027-03-01',a,b,'completed',
          CASE WHEN scenario=1 THEN 90 ELSE 100 END,CASE WHEN scenario=1 THEN 100 ELSE 90 END,CASE WHEN scenario=1 THEN b ELSE a END);
        IF scenario>=3 THEN
          INSERT INTO public.scheduled_games(game_id,season_year,competition_phase,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
          VALUES (career,2026,'regular_season','2027-03-02',b,a,'completed',100,90,b);
        END IF;
        IF scenario IN (2,3) THEN
          INSERT INTO public.scheduled_games(game_id,season_year,competition_phase,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
          VALUES (career,2026,'regular_season','2027-03-03',a,other,'completed',
            CASE WHEN scenario=2 THEN 70 ELSE 130 END,100,CASE WHEN scenario=2 THEN other ELSE a END);
        END IF;
      END IF;
      IF scenario=5 THEN UPDATE public.postseason_qualifications SET wins=0,losses=0 WHERE game_id=career AND team_id IN (a,b); END IF;
      expected:=CASE WHEN scenario<=3 THEN a ELSE b END;
      PERFORM public.prepare_playoffs(career);
      ASSERT (SELECT home_team_id=expected AND away_team_id=CASE WHEN expected=a THEN b ELSE a END
        FROM public.postseason_series WHERE game_id=career AND round=4),
        format('Finals criterion %s: frozen percentage, head-to-head, differential, draw, no-history draw',scenario);
      RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Discard Finals fixture';
    EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
    END;
  END LOOP;
END $$;

-- Read-only status and all rows are owner-isolated, including after completion.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ DECLARE table_name TEXT; operation TEXT; helper TEXT; visible INTEGER; BEGIN
  FOREACH table_name IN ARRAY ARRAY['postseason_series','postseason_series_games','postseason_results'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE game_id=$1',table_name) INTO visible USING 'b3000000-0000-4000-8000-000000000001'::UUID;
    ASSERT visible=0, 'Other owner sees no postseason rows';
    EXECUTE format('SELECT count(*) FROM public.%I WHERE game_id=$1',table_name) INTO visible USING 'b3000000-0000-4000-8000-000000000002'::UUID;
    ASSERT visible>0, 'Owner sees its own persisted postseason rows';
    FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      BEGIN
        IF operation='INSERT' THEN EXECUTE format('INSERT INTO public.%I SELECT * FROM public.%I WHERE false',table_name,table_name);
        ELSIF operation='UPDATE' THEN EXECUTE format('UPDATE public.%I SET game_id=game_id WHERE false',table_name);
        ELSE EXECUTE format('DELETE FROM public.%I WHERE false',table_name); END IF;
        RAISE EXCEPTION 'Expected write permission rejection';
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    END LOOP;
  END LOOP;
  FOREACH helper IN ARRAY ARRAY['prepare_playoffs','prepare_play_in','freeze_postseason_qualification'] LOOP
    BEGIN
      EXECUTE format('SELECT public.%I($1)',helper) USING 'b3000000-0000-4000-8000-000000000002'::UUID;
      RAISE EXCEPTION 'Expected helper permission rejection';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.get_postseason_state('b3000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Expected owner rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Game not found or access denied', 'Other owner cannot query state'; END;
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000001','2027-04-19');
    RAISE EXCEPTION 'Expected owner rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Game not found or access denied', 'Other owner cannot advance completed season'; END;
  BEGIN
    PERFORM public.get_postseason_state('b3000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'Expected missing career rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Game not found or access denied', 'Missing career does not leak data'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.get_postseason_state('b3000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Expected authentication rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Authentication required', 'Missing subject rejected'; END;
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000002','2027-04-19');
    RAISE EXCEPTION 'Expected authentication rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Authentication required', 'Unauthenticated advance rejected'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claim.role','service_role',false);
DO $$ BEGIN
  BEGIN
    PERFORM public.get_postseason_state('b3000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Expected role rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Authentication required', 'Non-authenticated claim rejected even with subject'; END;
END $$;
RESET ROLE;
BEGIN;
UPDATE public.games SET status='deleted',deleted_at=now() WHERE id='b3000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ BEGIN
  ASSERT (SELECT count(*)=0 FROM public.postseason_series), 'Deleted owner sees no series';
  ASSERT (SELECT count(*)=0 FROM public.postseason_series_games), 'Deleted owner sees no series links';
  ASSERT (SELECT count(*)=0 FROM public.postseason_results), 'Deleted owner sees no championship';
  BEGIN
    PERFORM public.get_postseason_state('b3000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Expected deleted career rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Game not found or access denied', 'Deleted state RPC rejected'; END;
  BEGIN
    PERFORM public.advance_simulation_day('b3000000-0000-4000-8000-000000000002','2027-04-19');
    RAISE EXCEPTION 'Expected deleted career rejection';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Game not found or access denied', 'Deleted advance rejected'; END;
END $$;
ROLLBACK;
DROP FUNCTION public.test_fail_playoff_write(),public.test_playoff_snapshot(UUID),public.test_playoff_progress(UUID),public.test_assert_playoff_progress(UUID,DATE);
DROP TABLE public.playoff_upgrade_fixtures,public.playoff_upgrade_payloads,public.playoff_upgrade_seeds,public.playoff_upgrade_playin;

-- PLAYOFF_JOURNEY_SETUP
-- Only the eight play-in teams had rosters (72 players). Add the twelve direct qualifiers,
-- without inventing historical performances or replacing the existing attributes.
CREATE TEMP TABLE playoff_roster AS SELECT gen_random_uuid() AS player_id,q.team_id,n
  FROM public.postseason_qualifications q CROSS JOIN generate_series(1,9) n
  WHERE q.game_id='b3000000-0000-4000-8000-000000000002' AND q.seed<=6;
INSERT INTO public.players(id,first_name,last_name,full_name,position,is_active)
  SELECT player_id,'Playoff',n::TEXT,'Playoff player '||n,'G',true FROM playoff_roster;
INSERT INTO public.game_player_states(game_id,player_id,team_id,is_active,is_injured)
  SELECT 'b3000000-0000-4000-8000-000000000002',player_id,team_id,true,false FROM playoff_roster;
INSERT INTO public.game_player_attributes(game_id,season_year,player_id,origin,match_method,attributes,generator_version,identity_evidence)
  SELECT 'b3000000-0000-4000-8000-000000000002',2026,player_id,'estimated','missing-source',
    (SELECT jsonb_object_agg(key,70) FROM unnest(ARRAY['closeShot','midRangeShot','threePointShot',
      'freeThrow','drawFoul','ballHandle','passAccuracy','interiorDefense','perimeterDefense',
      'steal','block','offensiveRebound','defensiveRebound','stamina']) key),'replacement-v1','{}'
  FROM playoff_roster;
UPDATE public.game_attribute_materializations SET player_count=180
  WHERE game_id='b3000000-0000-4000-8000-000000000002' AND season_year=2026;
DO $$ BEGIN
  ASSERT (SELECT count(*)=180 FROM public.game_player_attributes
    WHERE game_id='b3000000-0000-4000-8000-000000000002'), 'All twenty modern qualifier rosters materialized';
  ASSERT (SELECT count(*)=16 FROM public.postseason_playoff_seeds p WHERE p.game_id='b3000000-0000-4000-8000-000000000002'
    AND (SELECT count(*) FROM public.game_player_states s WHERE s.game_id=p.game_id AND s.team_id=p.team_id)=9), 'Every playoff team has nine players';
END $$;

-- Test-only snapshots include every mutable part of a postseason transaction.
CREATE FUNCTION public.test_playoff_snapshot(p_game UUID) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'career',(SELECT to_jsonb(g) FROM public.games g WHERE g.id=p_game),
    'fixtures',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.scheduled_games f WHERE f.game_id=p_game),
    'payloads',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.scheduled_game_id) FROM public.game_box_scores b WHERE b.game_id=p_game),
    'series',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.postseason_series s WHERE s.game_id=p_game),
    'links',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.series_id,l.game_number) FROM public.postseason_series_games l WHERE l.game_id=p_game),
    'results',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.season_year) FROM public.postseason_results r WHERE r.game_id=p_game),
    'seeds',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.conference,p.seed) FROM public.postseason_playoff_seeds p WHERE p.game_id=p_game),
    'qualification',(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.conference,q.seed) FROM public.postseason_qualifications q WHERE q.game_id=p_game),
    'standings',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.team_id) FROM public.league_standings s WHERE s.game_id=p_game));
$$;
CREATE FUNCTION public.test_playoff_progress(p_game UUID) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('date',g.simulation_date,
    'winners',(SELECT count(*) FROM public.postseason_series s WHERE s.game_id=g.id AND s.winner_team_id IS NOT NULL),
    'rounds',(SELECT coalesce(max(round),0) FROM public.postseason_series s WHERE s.game_id=g.id),
    'complete',EXISTS(SELECT 1 FROM public.postseason_results r WHERE r.game_id=g.id))
  FROM public.games g WHERE g.id=p_game;
$$;
CREATE FUNCTION public.test_assert_playoff_progress(p_game UUID,p_date DATE) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE s public.postseason_series%ROWTYPE; state JSONB; expected_home UUID; expected_away UUID;
  previous_end DATE; n INTEGER;
BEGIN
  ASSERT (SELECT simulation_date=p_date AND season_year=2026 FROM public.games WHERE id=p_game), 'Concurrent expected day advances clock once without rollover';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scheduled_games WHERE game_id=p_game AND competition_phase='playoffs'
    AND ((status='scheduled' AND game_date<=p_date) OR (status='completed' AND game_date>p_date))), 'No skipped or premature playoff fixture';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scheduled_games f LEFT JOIN public.postseason_series_games l ON l.scheduled_game_id=f.id
    WHERE f.game_id=p_game AND f.competition_phase='playoffs' AND l.series_id IS NULL), 'No orphan playoff fixture';
  FOR s IN SELECT * FROM public.postseason_series WHERE game_id=p_game LOOP
    ASSERT s.home_wins=(SELECT count(*) FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=s.id AND f.status='completed' AND f.winner_team_id=s.home_team_id), 'Home series wins match results';
    ASSERT s.away_wins=(SELECT count(*) FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=s.id AND f.status='completed' AND f.winner_team_id=s.away_team_id), 'Away series wins match results';
    ASSERT (s.winner_team_id IS NULL)=(greatest(s.home_wins,s.away_wins)<4), 'Clinch exactly at four wins';
    SELECT count(*) INTO n FROM public.postseason_series_games WHERE series_id=s.id;
    ASSERT n=coalesce((SELECT max(game_number) FROM public.postseason_series_games WHERE series_id=s.id),0), 'Contiguous game numbers';
    ASSERT n BETWEEN 1 AND 7, 'At most seven games';
    ASSERT (SELECT count(*) FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=s.id AND f.status='scheduled')=CASE WHEN s.winner_team_id IS NULL THEN 1 ELSE 0 END,
      'Exactly one next game, none after clinch';
    ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=s.id AND (f.competition_phase<>'playoffs' OR f.season_year<>2026 OR f.game_id<>p_game
        OR f.home_team_id<>CASE WHEN l.game_number IN (1,2,5,7) THEN s.home_team_id ELSE s.away_team_id END
        OR f.away_team_id<>CASE WHEN l.game_number IN (1,2,5,7) THEN s.away_team_id ELSE s.home_team_id END)), '2-2-1-1-1 home court and phase attribution';
    ASSERT NOT EXISTS (SELECT 1 FROM public.postseason_series_games a JOIN public.scheduled_games fa ON fa.id=a.scheduled_game_id
      JOIN public.postseason_series_games b ON b.series_id=a.series_id AND b.game_number=a.game_number+1
      JOIN public.scheduled_games fb ON fb.id=b.scheduled_game_id WHERE a.series_id=s.id AND fb.game_date<>fa.game_date+2), 'One rest day between every game';
    IF s.round=1 THEN
      SELECT team_id INTO expected_home FROM public.postseason_playoff_seeds WHERE game_id=p_game AND conference=s.conference AND seed=(ARRAY[1,4,2,3])[s.bracket_slot];
      SELECT team_id INTO expected_away FROM public.postseason_playoff_seeds WHERE game_id=p_game AND conference=s.conference AND seed=9-(ARRAY[1,4,2,3])[s.bracket_slot];
      ASSERT s.home_team_id=expected_home AND s.away_team_id=expected_away, 'Round one slots 1v8,4v5,2v7,3v6';
      SELECT max(f.game_date) INTO previous_end FROM public.postseason_play_in_games pi JOIN public.scheduled_games f ON f.id=pi.scheduled_game_id WHERE pi.game_id=p_game;
    ELSE
      ASSERT (SELECT count(*) FROM public.postseason_series prev WHERE prev.game_id=p_game AND prev.round=s.round-1
        AND prev.winner_team_id IS NOT NULL)=power(2,5-s.round), 'Next round waits for every previous series in both conferences';
      IF s.round<4 THEN
        ASSERT (SELECT count(*)=2 FROM public.postseason_series prev WHERE prev.game_id=p_game AND prev.round=s.round-1
          AND prev.conference=s.conference AND prev.bracket_slot IN (s.bracket_slot*2-1,s.bracket_slot*2)
          AND prev.winner_team_id IN (s.home_team_id,s.away_team_id)), 'Adjacent fixed bracket without reseeding';
        ASSERT (SELECT h.seed<a.seed FROM public.postseason_playoff_seeds h JOIN public.postseason_playoff_seeds a
          ON a.game_id=h.game_id AND a.conference=h.conference WHERE h.game_id=p_game AND h.team_id=s.home_team_id AND a.team_id=s.away_team_id), 'Better conference seed hosts';
      END IF;
      SELECT max(f.game_date) INTO previous_end FROM public.postseason_series prev JOIN public.postseason_series_games l ON l.series_id=prev.id
        JOIN public.scheduled_games f ON f.id=l.scheduled_game_id WHERE prev.game_id=p_game AND prev.round=s.round-1;
    END IF;
    ASSERT (SELECT f.game_date>=previous_end+2 FROM public.postseason_series_games l JOIN public.scheduled_games f ON f.id=l.scheduled_game_id
      WHERE l.series_id=s.id AND l.game_number=1), 'Rest before each new round';
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',(SELECT user_id::TEXT FROM public.games WHERE id=p_game),true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  state:=public.get_postseason_state(p_game);
  ASSERT state->>'phase'=CASE WHEN EXISTS(SELECT 1 FROM public.postseason_results WHERE game_id=p_game) THEN 'complete' ELSE 'playoffs' END, 'State phase follows championship, not sixteen seeds';
  ASSERT jsonb_array_length(state->'series')=(SELECT count(*) FROM public.postseason_series WHERE game_id=p_game), 'State includes every persisted series';
  ASSERT jsonb_array_length(state->'games')=(SELECT count(*) FROM public.scheduled_games WHERE game_id=p_game AND competition_phase IN ('play_in','playoffs')), 'State contains all play-in and playoff games only';
  ASSERT jsonb_array_length(state->'qualification')=30 AND jsonb_array_length(state->'playoffSeeds')=16, 'State retains regular and playoff seeds';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(state->'series') x
    WHERE NOT x ?& ARRAY['id','round','conference','bracketSlot','homeTeamId','awayTeamId','homeWins','awayWins','winnerTeamId']), 'Series RPC shape';
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(state->'games') x
    WHERE NOT x ?& ARRAY['id','seriesId','stage','conference','gameNumber','gameDate','homeTeamId','awayTeamId','homeScore','awayScore','winnerTeamId','status']), 'Fixture RPC shape';
END;
$$;
REVOKE ALL ON FUNCTION public.test_playoff_snapshot(UUID),public.test_playoff_progress(UUID),public.test_assert_playoff_progress(UUID,DATE) FROM PUBLIC;

-- Read-only state covers all pre-playoff phases without materializing anything.
BEGIN;
INSERT INTO public.games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b3000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001',
  'State before qualification','b1000000-0000-4000-8000-000000000001',2026,'jordan','2027-03-01','active');
-- 051 intentionally left ATL noncanonical; restore it only in this discarded fixture.
UPDATE public.teams SET conference='East' WHERE abbreviation='ATL';
INSERT INTO public.scheduled_games(game_id,game_date,home_team_id,away_team_id,status,home_score,away_score,winner_team_id)
SELECT 'b3000000-0000-4000-8000-000000000005',game_date,home_team_id,away_team_id,
  CASE WHEN game_date='2027-03-01' THEN 'completed' ELSE 'scheduled' END,
  CASE WHEN game_date='2027-03-01' THEN home_score END,
  CASE WHEN game_date='2027-03-01' THEN away_score END,
  CASE WHEN game_date='2027-03-01' THEN winner_team_id END
FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000001' AND competition_phase='regular_season';
INSERT INTO public.league_standings(game_id,team_id,wins,losses)
SELECT 'b3000000-0000-4000-8000-000000000005',team_id,
  CASE WHEN t.nba_id<=10015 THEN 1 ELSE 0 END,CASE WHEN t.nba_id>10015 THEN 1 ELSE 0 END
FROM public.league_standings s JOIN public.teams t ON t.id=s.team_id WHERE s.game_id='b3000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE state JSONB; BEGIN
  state:=public.get_postseason_state('b3000000-0000-4000-8000-000000000005');
  ASSERT state->>'phase'='regular_season', 'Unqualified career state';
  ASSERT state ?& ARRAY['phase','championTeamId','runnerUpTeamId','qualification','playoffSeeds','series','games'], 'Root RPC shape';
  ASSERT state->'qualification'='[]'::JSONB AND state->'playoffSeeds'='[]'::JSONB AND state->'series'='[]'::JSONB AND state->'games'='[]'::JSONB, 'Empty arrays, not null';
  ASSERT state->'championTeamId'='null'::JSONB AND state->'runnerUpTeamId'='null'::JSONB, 'No fabricated championship';
  state:=public.get_postseason_state('b3000000-0000-4000-8000-000000000004');
  ASSERT state->>'phase'='play_in' AND jsonb_array_length(state->'qualification')=30
    AND jsonb_array_length(state->'games')=4 AND state->'series'='[]'::JSONB, 'Play-in state before sixteen seeds';
  ASSERT public.get_postseason_state('b3000000-0000-4000-8000-000000000001')->>'phase'='playoffs', 'Legacy resumed state is playoffs, not complete';
  ASSERT (SELECT count(*)=0 FROM public.postseason_series), 'State RPC never creates series';
END $$;
DO $$ DECLARE career UUID:='b3000000-0000-4000-8000-000000000005'; state JSONB; day DATE; BEGIN
  ASSERT (SELECT bool_and(NOT season_complete) FROM public.advance_simulation_day(career,'2027-03-01')), 'Regular closure remains nonterminal under 052';
  state:=public.get_postseason_state(career);
  ASSERT state->>'phase'='play_in' AND jsonb_array_length(state->'qualification')=30
    AND jsonb_array_length(state->'playoffSeeds')=12 AND jsonb_array_length(state->'games')=4, 'RPC transitions regular season to play-in';
  FOR day IN SELECT generate_series('2027-03-02'::DATE,'2027-03-04'::DATE,'1 day')::DATE LOOP
    ASSERT (SELECT bool_and(NOT season_complete) FROM public.advance_simulation_day(career,day)), 'Rest and first stage cannot complete season';
  END LOOP;
  state:=public.get_postseason_state(career);
  ASSERT state->>'phase'='play_in' AND jsonb_array_length(state->'playoffSeeds')=14, 'First play-in stage is not playoffs';
  ASSERT (SELECT bool_and(NOT season_complete) FROM public.advance_simulation_day(career,'2027-03-05')), 'Final play-in game does not terminate batch';
  state:=public.get_postseason_state(career);
  ASSERT state->>'phase'='playoffs' AND jsonb_array_length(state->'playoffSeeds')=16
    AND jsonb_array_length(state->'series')=8 AND jsonb_array_length(state->'games')=14, 'Final play-in transitions atomically into round one';
  ASSERT (SELECT bool_and(NOT season_complete) FROM public.advance_simulation_day(career,'2027-03-06')), 'Batch continues across postseason rest';
  ASSERT (SELECT count(*)=8 AND bool_and(NOT season_complete) FROM public.advance_simulation_day(career,'2027-03-07')), 'Batch simulates first playoff day after transition';
  ASSERT public.get_postseason_state(career)->>'phase'='playoffs', 'Playing round one remains playoffs';
END $$;
ROLLBACK;

-- Resume both terminal 050 careers, including the user's modern April 19 shape.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $$ BEGIN
  ASSERT (SELECT NOT season_complete AND new_date='2027-03-07' AND result_id IS NULL FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000001','2027-03-06')), 'Legacy March 6 terminal career resumes with rest day';
  ASSERT (SELECT count(*)=8 FROM public.postseason_series), 'Eight initial series, no premature round two';
END $$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
  ASSERT public.get_postseason_state('b3000000-0000-4000-8000-000000000002')->>'phase'='playoffs', 'Modern April 19 completed play-in resumes';
  ASSERT (SELECT NOT season_complete AND new_date='2027-04-20' AND result_id IS NULL FROM public.advance_simulation_day(
    'b3000000-0000-4000-8000-000000000002','2027-04-19')), 'Modern career resumes after April 15';
  ASSERT (SELECT count(*)=8 FROM public.postseason_series), 'Modern owner sees only its own eight series';
END $$;
RESET ROLE;
SELECT public.test_assert_playoff_progress('b3000000-0000-4000-8000-000000000001','2027-03-07');
SELECT public.test_assert_playoff_progress('b3000000-0000-4000-8000-000000000002','2027-04-20');
DO $$ BEGIN
  ASSERT (SELECT min(game_date)='2027-03-08' FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000001' AND competition_phase='playoffs'), 'Legacy first game is play-in plus two days';
  ASSERT (SELECT min(game_date)='2027-04-21' FROM public.scheduled_games WHERE game_id='b3000000-0000-4000-8000-000000000002' AND competition_phase='playoffs'), 'Modern first game is April 21';
END $$;

-- All faults occur after real simulation work; the runner compares the complete snapshot
-- before/after two concurrent failed calls, removes only that trigger, then retries the day.
CREATE FUNCTION public.test_fail_playoff_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.game_id='b3000000-0000-4000-8000-000000000002' THEN
    IF TG_TABLE_NAME='postseason_series_games' THEN
      IF NEW.game_number=2 THEN RAISE EXCEPTION 'Injected playoff link failure'; END IF;
    ELSIF TG_TABLE_NAME='postseason_series' THEN
      IF NEW.round>1 THEN RAISE EXCEPTION 'Injected playoff round failure'; END IF;
    ELSE
      RAISE EXCEPTION 'Injected playoff result failure';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.test_fail_playoff_write() FROM PUBLIC;
CREATE TRIGGER test_fail_playoff_link AFTER INSERT ON public.postseason_series_games FOR EACH ROW EXECUTE FUNCTION public.test_fail_playoff_write();
CREATE TRIGGER test_fail_playoff_round AFTER INSERT ON public.postseason_series FOR EACH ROW EXECUTE FUNCTION public.test_fail_playoff_write();
CREATE TRIGGER test_fail_playoff_result AFTER INSERT ON public.postseason_results FOR EACH ROW EXECUTE FUNCTION public.test_fail_playoff_write();

-- AFTER_PLAYOFF_JOURNEYS
DO $$ DECLARE career UUID; state JSONB; terminal DATE; before JSONB; stats JSONB; BEGIN
  FOREACH career IN ARRAY ARRAY['b3000000-0000-4000-8000-000000000001'::UUID,'b3000000-0000-4000-8000-000000000002'::UUID] LOOP
    ASSERT (SELECT count(*)=15 FROM public.postseason_series WHERE game_id=career AND winner_team_id IS NOT NULL), 'All fifteen series completed';
    ASSERT (SELECT count(*)=1 FROM public.postseason_results WHERE game_id=career AND season_year=2026), 'One persisted championship per season';
    ASSERT NOT EXISTS (SELECT 1 FROM public.scheduled_games WHERE game_id=career AND competition_phase='playoffs' AND status<>'completed'), 'No unnecessary games after championship';
    ASSERT (SELECT count(*)>=60 AND count(*)<=105 FROM public.postseason_series_games WHERE game_id=career), 'Every series ends in four through seven games';
    ASSERT (SELECT season_year=2026 AND status='active' FROM public.games WHERE id=career), 'Champion does not roll the season or end the career';
    PERFORM set_config('request.jwt.claim.sub',(SELECT user_id::TEXT FROM public.games WHERE id=career),true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    state:=public.get_postseason_state(career);
    ASSERT state->>'phase'='complete', 'Champion produces complete state';
    ASSERT (SELECT state->>'championTeamId'=r.champion_team_id::TEXT AND state->>'runnerUpTeamId'=r.runner_up_team_id::TEXT
      AND r.champion_team_id=s.winner_team_id AND r.runner_up_team_id=CASE WHEN s.winner_team_id=s.home_team_id THEN s.away_team_id ELSE s.home_team_id END
      AND r.completed_on=g.simulation_date FROM public.postseason_results r JOIN public.postseason_series s ON s.id=r.finals_series_id
      JOIN public.games g ON g.id=r.game_id WHERE r.game_id=career), 'Champion, runner-up and completion date agree with Finals';
    SELECT simulation_date INTO terminal FROM public.games WHERE id=career;
    before:=public.test_playoff_snapshot(career);
    ASSERT (SELECT bool_and(season_complete AND new_date=terminal AND result_id IS NULL)
      FROM public.advance_simulation_day(career,terminal)), 'Champion is idempotent terminal stop';
    ASSERT (SELECT bool_and(season_complete AND new_date=terminal AND result_id IS NULL)
      FROM public.advance_simulation_day(career,terminal-1)), 'Stale championship retry remains complete';
    ASSERT public.test_playoff_snapshot(career)=before, 'Terminal retries change nothing';
    stats:=public.get_player_season_statistics(career,2026,'playoffs');
    ASSERT (stats->>'completedGames')::INTEGER=(SELECT count(*) FROM public.scheduled_games WHERE game_id=career AND competition_phase='playoffs'), 'Playoff statistics cover only playoff fixtures';
    IF career='b3000000-0000-4000-8000-000000000002' THEN
      ASSERT stats->>'coveredGames'=stats->>'completedGames', 'Every modern playoff result has individual statistics';
      ASSERT public.get_player_season_statistics(career,2026,'play_in')->>'coveredGames'='6', 'Play-in statistics remain six games';
      ASSERT public.get_player_season_statistics(career,2026,'regular_season')->>'coveredGames'='1', 'Regular statistics remain historical one-game coverage';
      ASSERT public.get_player_season_statistics(career,2025,'playoffs')->>'coveredGames'='0', 'Playoff statistics do not leak across seasons';
      ASSERT NOT EXISTS (SELECT 1 FROM public.scheduled_games f LEFT JOIN public.game_box_scores b ON b.scheduled_game_id=f.id
        WHERE f.game_id=career AND f.competition_phase='playoffs' AND (b.scheduled_game_id IS NULL
          OR b.payload->>'engineVersion'<>'possessions-v2' OR (b.payload->>'homeScore')::INTEGER<>f.home_score
          OR (b.payload->>'awayScore')::INTEGER<>f.away_score)), 'All modern playoffs reuse v2 engine with matching persisted scores';
      ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores b JOIN public.scheduled_games f ON f.id=b.scheduled_game_id
        WHERE f.game_id=career AND f.competition_phase='playoffs' AND (
          (SELECT sum((p->>'points')::INTEGER) FROM jsonb_array_elements(b.payload->'players') p WHERE p->>'side'='home')<>f.home_score
          OR (SELECT sum((p->>'points')::INTEGER) FROM jsonb_array_elements(b.payload->'players') p WHERE p->>'side'='away')<>f.away_score)), 'Individual points produce the same playoff scoreboard';
    ELSE
      ASSERT stats->>'coveredGames'='0', 'Legacy fallback invents no playoff box scores';
      ASSERT NOT EXISTS (SELECT 1 FROM public.game_box_scores b JOIN public.scheduled_games f ON f.id=b.scheduled_game_id
        WHERE f.game_id=career AND f.competition_phase='playoffs'), 'Legacy playoffs remain score-only';
    END IF;
  END LOOP;
  ASSERT NOT EXISTS (SELECT * FROM playoff_upgrade_playin EXCEPT SELECT * FROM public.postseason_play_in_games), 'Playoffs preserve play-in links';
  ASSERT NOT EXISTS (SELECT * FROM playoff_upgrade_fixtures WHERE competition_phase='play_in' EXCEPT SELECT * FROM public.scheduled_games), 'Playoffs preserve play-in results';
  ASSERT NOT EXISTS (SELECT b.* FROM playoff_upgrade_payloads b JOIN playoff_upgrade_fixtures f ON f.id=b.scheduled_game_id
    WHERE f.competition_phase='play_in' EXCEPT SELECT * FROM public.game_box_scores), 'Playoffs preserve play-in box scores';
  ASSERT NOT EXISTS ((SELECT * FROM playoff_upgrade_seeds EXCEPT SELECT * FROM public.postseason_playoff_seeds)
    UNION ALL (SELECT * FROM public.postseason_playoff_seeds EXCEPT SELECT * FROM playoff_upgrade_seeds)), 'Playoff seeds remain frozen';
END $$;
