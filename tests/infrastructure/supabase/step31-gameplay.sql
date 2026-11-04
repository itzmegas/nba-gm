BEGIN;
INSERT INTO auth.users(id) VALUES ('b7000000-0000-4000-8000-000000000001');
INSERT INTO teams(id,nba_id,name,city,abbreviation,conference)
SELECT ('b7100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,n,
 'Synthetic '||n,'Test',abbr,CASE WHEN n<=15 THEN 'East' ELSE 'West' END
FROM unnest(ARRAY['ATL','BOS','BRK','CHI','CHO','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM',
 'MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHO','POR','SAC','SAS','TOR','UTA','WAS']) WITH ORDINALITY t(abbr,n);
INSERT INTO players(id,nba_id,team_id,first_name,last_name,full_name,position,years_of_experience,is_active)
SELECT ('b7200000-0000-4000-8000-'||lpad((t.nba_id*100+p)::text,12,'0'))::uuid,
 t.nba_id*100+p,t.id,'Synthetic',(t.nba_id*100+p)::text,'Synthetic '||(t.nba_id*100+p),
 CASE WHEN p%3=0 THEN 'C' WHEN p%3=1 THEN 'G' ELSE 'F' END,4,true
FROM teams t CROSS JOIN generate_series(1,15) p;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
INSERT INTO games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b7300000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001',
 'Synthetic full league','b7100000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing');
SELECT seed_game_data('b7300000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001');
SELECT initialize_game_schedule('b7300000-0000-4000-8000-000000000001');
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=450 FROM game_player_states), '450 owned roster players';
 ASSERT NOT EXISTS (SELECT team_id FROM game_player_states GROUP BY team_id HAVING count(*)<>15), '15 per team';
 ASSERT (SELECT count(*)=870 FROM scheduled_games), 'full generated regular-season schedule';
 ASSERT NOT EXISTS (SELECT 1 FROM contracts), 'modern game does not invent legacy contracts';
END $$;
INSERT INTO contract_source_snapshot_versions(source,team,season,source_url,observed_at,fetched_at,content_hash,payload)
SELECT 'synthetic',abbreviation,'2026-27','https://example.invalid',now(),now(),repeat('a',64),'{}' FROM teams;
SET LOCAL request.jwt.claim.role='service_role';
SET LOCAL ROLE service_role;
SELECT materialize_game_contract_snapshots('b7300000-0000-4000-8000-000000000001',
 'b7000000-0000-4000-8000-000000000001','synthetic','2026-27',
 (SELECT array_agg(id ORDER BY team) FROM contract_source_snapshot_versions),'[]',
 (SELECT jsonb_agg(jsonb_build_object('targetPlayerId',player_id,'resolution',jsonb_build_object(
 'status','resolved','contractType','standard','quality','estimated','method','synthetic','estimated',true,
 'capTreatment','standard-cap-and-matching','salaryAmount',10000000))) FROM game_player_states));
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=450 FROM game_contract_agreements), '450 canonical agreements';
 ASSERT (SELECT sum(salary_amount)=4500000000 FROM game_contract_seasons), 'salary accounting';
END $$;
UPDATE games SET status='active' WHERE id='b7300000-0000-4000-8000-000000000001';
CREATE TEMP TABLE canonical_before AS SELECT jsonb_agg(to_jsonb(a) ORDER BY id) value FROM game_contract_agreements a;
CREATE TEMP TABLE trade_validation(passed boolean);
GRANT ALL ON trade_validation TO authenticated;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
PERFORM execute_trade_transactional('b7300000-0000-4000-8000-000000000001',
 'b7100000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000002',
 '[{"asset_type":"player","asset_id":"b7200000-0000-4000-8000-000000000101","from_team_id":"b7100000-0000-4000-8000-000000000001"},
 {"asset_type":"player","asset_id":"b7200000-0000-4000-8000-000000000201","from_team_id":"b7100000-0000-4000-8000-000000000002"}]');
INSERT INTO trade_validation VALUES (true);
EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'Player contract is missing' THEN RAISE; END IF;
 INSERT INTO trade_validation VALUES(false);
 RAISE WARNING 'FAIL: modern canonical-only trade rejected: %',SQLERRM;
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT team_id=CASE WHEN (SELECT passed FROM trade_validation)
 THEN 'b7100000-0000-4000-8000-000000000002'::uuid ELSE 'b7100000-0000-4000-8000-000000000001'::uuid END FROM game_player_states
 WHERE player_id='b7200000-0000-4000-8000-000000000101'), 'outgoing trade ownership';
 ASSERT (SELECT team_id=CASE WHEN (SELECT passed FROM trade_validation)
 THEN 'b7100000-0000-4000-8000-000000000001'::uuid ELSE 'b7100000-0000-4000-8000-000000000002'::uuid END FROM game_player_states
 WHERE player_id='b7200000-0000-4000-8000-000000000201'), 'incoming trade ownership';
 ASSERT (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM game_contract_agreements a)=(SELECT value FROM canonical_before), 'trade preserves canonical terms';
END $$;
SET LOCAL ROLE authenticated;
SELECT release_roster_player('b7300000-0000-4000-8000-000000000001','b7200000-0000-4000-8000-000000000115',
 'b7600000-0000-4000-8000-000000000001',(SELECT id FROM game_contract_agreements
 WHERE player_id='b7200000-0000-4000-8000-000000000115'));
SELECT id FROM submit_free_agency_offer('b7300000-0000-4000-8000-000000000001',
 'b7200000-0000-4000-8000-000000000115','b7600000-0000-4000-8000-000000000002','2026-27',
 (SELECT (c->>'minimum_salary')::bigint FROM jsonb_array_elements(
 get_free_agency_market('b7300000-0000-4000-8000-000000000001')->'candidates') c
 WHERE c->>'player_id'='b7200000-0000-4000-8000-000000000115'),1);
SELECT * FROM advance_simulation_day('b7300000-0000-4000-8000-000000000001','2026-10-01');
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM free_agency_pending_offers WHERE offer_origin='human' AND status='accepted'), 'human offer accepted on simulated day';
 ASSERT (SELECT count(*)=1 FROM game_runtime_contracts), 'one runtime signing';
 ASSERT (SELECT count(*)=15 FROM game_player_states WHERE team_id='b7100000-0000-4000-8000-000000000001'), 'roster slot restored';
END $$;
DO $$ DECLARE cursor_date date; next_date date; completed boolean:=false;
BEGIN
 FOR day IN 1..300 LOOP
  SELECT simulation_date INTO cursor_date FROM games WHERE id='b7300000-0000-4000-8000-000000000001';
  PERFORM * FROM advance_simulation_day('b7300000-0000-4000-8000-000000000001',cursor_date);
  IF EXISTS (SELECT 1 FROM postseason_series WHERE game_id='b7300000-0000-4000-8000-000000000001'
    AND round=4 AND winner_team_id IS NOT NULL) THEN completed:=true; EXIT; END IF;
 END LOOP;
 ASSERT completed, 'champion reached within bounded season';
 PERFORM enter_offseason('b7300000-0000-4000-8000-000000000001',2026);
 PERFORM prepare_offseason_contracts('b7300000-0000-4000-8000-000000000001',2026);
 PERFORM resolve_offseason_player_options('b7300000-0000-4000-8000-000000000001',2026);
END $$;
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*)=870 FROM scheduled_games WHERE competition_phase='regular_season' AND status='completed'), 'all regular results';
 ASSERT (SELECT count(*)=30 FROM postseason_qualifications), 'full qualification';
 ASSERT (SELECT count(*)=1 FROM game_offseasons), 'offseason entry';
 ASSERT (SELECT count(*)=1 FROM game_offseason_contracts WHERE classification='expiring'), 'signed runtime expiration classified';
 ASSERT (SELECT count(*)=1 FROM game_offseason_contracts), 'estimated terms do not invent decisions';
END $$;
SELECT 'PASS: 450-player creation, contracts, full regular season, postseason champion and offseason preparation';
\if :corrected
SET LOCAL ROLE anon;
DO $$ BEGIN
 ASSERT (SELECT count(*)=0 FROM teams), 'anonymous team isolation';
 ASSERT (SELECT count(*)=0 FROM players), 'anonymous player isolation';
 ASSERT (SELECT count(*)=0 FROM contracts), 'anonymous contract isolation';
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*)=0 FROM games), 'foreign game isolation';
 ASSERT (SELECT count(*)=0 FROM game_player_states), 'foreign roster isolation';
 ASSERT (SELECT count(*)=0 FROM game_contract_agreements), 'foreign agreement isolation';
END $$;
RESET ROLE;
SELECT 'PASS: corrected anonymous catalog and foreign owner read isolation';
\endif
DO $$ BEGIN ASSERT (SELECT passed FROM trade_validation), 'FAIL: modern canonical-only trade remains blocked'; END $$;
ROLLBACK;
