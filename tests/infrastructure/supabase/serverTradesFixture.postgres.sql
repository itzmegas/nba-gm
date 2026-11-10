INSERT INTO auth.users(id) VALUES
 ('a0000000-0000-4000-8000-000000000001'), ('a0000000-0000-4000-8000-000000000002');
INSERT INTO teams(id,nba_id,name,city,abbreviation,conference) VALUES
 ('a1000000-0000-4000-8000-000000000001',-91001,'Alpha','Test','ALP','East'),
 ('a1000000-0000-4000-8000-000000000002',-91002,'Beta','Test','BET','West'),
 ('a1000000-0000-4000-8000-000000000003',-91003,'Gamma','Test','GAM','West');
INSERT INTO games(id,user_id,name,selected_team_id,season_year,season_era_id,simulation_date,status) VALUES
 ('a3000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Trade test','a1000000-0000-4000-8000-000000000001',2026,'modern','2026-10-01','initializing');
INSERT INTO players(id,nba_id,first_name,last_name,full_name,is_active) VALUES
 ('a2000000-0000-4000-8000-000000000001',NULL,'Synthetic','Player','Synthetic Player',true);
INSERT INTO game_player_states(game_id,player_id,team_id) VALUES
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
INSERT INTO game_contract_agreements(id,game_id,player_id,team_id,contract_type,provenance_quality,source_method,estimated,cap_treatment) VALUES
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','standard','observed','test',false,'standard-cap-and-matching');
INSERT INTO game_contract_seasons(agreement_id,game_id,season_label,start_year,end_year,salary_amount,option_kind,guarantee_kind) VALUES
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','2026-27',2026,2027,1000000,'none','guaranteed');
UPDATE games SET status='active';
-- Isolated years avoid the game-insert trigger's generated inventory.
INSERT INTO draft_picks(id,draft_year,draft_round,original_team_id) VALUES
 ('a5000000-0000-4000-8000-000000000001',2039,1,'a1000000-0000-4000-8000-000000000001'),
 ('a5000000-0000-4000-8000-000000000002',2039,1,'a1000000-0000-4000-8000-000000000002'),
 ('a5000000-0000-4000-8000-000000000003',2040,1,'a1000000-0000-4000-8000-000000000002');
INSERT INTO game_pick_inventory(id,game_id,draft_pick_id,owner_team_id,is_transferable) VALUES
 ('a6000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',true),
 ('a6000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002',true),
 ('a6000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002',false);
