-- Entire fixture and every RPC execute inside the runner's rollback transaction.
INSERT INTO auth.users(id) VALUES ('b7000000-0000-4000-8000-000000000001');
INSERT INTO teams(id,nba_id,name,city,abbreviation,conference)
SELECT ('b7100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,n,'Synthetic '||n,'Test',abbr,
  CASE WHEN n<=15 THEN 'East' ELSE 'West' END
FROM unnest(ARRAY['ATL','BOS','BRK','CHI','CHO','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM',
 'MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHO','POR','SAC','SAS','TOR','UTA','WAS']) WITH ORDINALITY t(abbr,n);
INSERT INTO roster_refresh_runs(id,expected_team_count,status)
VALUES ('b7500000-0000-4000-8000-000000000001',30,'pending');
INSERT INTO roster_refresh_staging(run_id,team_id,provider,player_source_id,payload)
SELECT 'b7500000-0000-4000-8000-000000000001',id,'espn',nba_id,
 jsonb_build_object('first_name','Synthetic','last_name',nba_id::text,'full_name','Synthetic '||nba_id,'position','G')
FROM teams;
SET LOCAL request.jwt.claim.role='service_role';
SET LOCAL ROLE service_role;
SELECT promote_current_roster('b7500000-0000-4000-8000-000000000001');
RESET ROLE;
DO $$ BEGIN ASSERT (SELECT count(*) FROM players WHERE is_active)=30, 'promotion'; END $$;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
INSERT INTO games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b7300000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001',
 'Synthetic modern','b7100000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing');
SELECT seed_game_data('b7300000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001');
SELECT initialize_game_schedule('b7300000-0000-4000-8000-000000000001');
SELECT seed_game_pick_inventory('b7300000-0000-4000-8000-000000000001');
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM game_player_states)=30, 'roster seeded';
 ASSERT (SELECT count(*) FROM scheduled_games)=870, 'schedule seeded';
 ASSERT (SELECT count(*) FROM contracts)=0, 'modern must not create legacy contracts';
END $$;
RESET ROLE;
INSERT INTO historical_roster_templates(season_year,player_id,team_id)
SELECT 1995,id,team_id FROM players;
INSERT INTO historical_contract_templates(season_year,player_id,team_id,start_year,end_year,salary_y1)
SELECT 1995,id,team_id,1995,1996,1000000 FROM players;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL ROLE authenticated;
INSERT INTO games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status)
VALUES ('b7300000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001',
 'Synthetic historical','b7100000-0000-4000-8000-000000000001',1995,'jordan','1995-10-01','initializing');
SELECT seed_game_data('b7300000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-000000000001');
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM contracts)=30, 'historical contracts seeded';
 ASSERT NOT EXISTS (SELECT 1 FROM contracts WHERE game_id IS NULL), 'historical ownership';
END $$;
RESET ROLE;
INSERT INTO contract_source_snapshot_versions(source,team,season,source_url,observed_at,fetched_at,content_hash,payload)
SELECT 'synthetic',abbreviation,'2026-27','https://example.invalid',now(),now(),repeat('a',64),'{"contracts":[]}' FROM teams;
SET LOCAL request.jwt.claim.role='service_role';
SET LOCAL ROLE service_role;
SELECT materialize_game_contract_snapshots('b7300000-0000-4000-8000-000000000001',
 'b7000000-0000-4000-8000-000000000001','synthetic','2026-27',
 (SELECT array_agg(id ORDER BY team) FROM contract_source_snapshot_versions), '[]',
 (SELECT jsonb_agg(jsonb_build_object('targetPlayerId',player_id,'resolution',jsonb_build_object(
 'status','resolved','contractType','standard','quality','estimated','method','synthetic',
 'estimated',true,'capTreatment','standard-cap-and-matching','salaryAmount',1000000))) FROM game_player_states
 WHERE game_id='b7300000-0000-4000-8000-000000000001'));
RESET ROLE;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM game_contract_agreements)=30, 'materialized agreements';
 ASSERT (SELECT sum(salary_amount) FROM game_contract_seasons)=30000000, 'materialized salary';
END $$;
