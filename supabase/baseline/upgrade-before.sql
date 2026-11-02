-- Run ONLY on the isolated local database at the recovered-original boundary.
INSERT INTO public.teams(id,nba_id,name,city,abbreviation)
VALUES ('b1000000-0000-4000-8000-000000000002',-999002,'Synthetic upgrade team','Test','UPG');
INSERT INTO public.players(id,nba_id,team_id,first_name,last_name,full_name)
VALUES ('b2000000-0000-4000-8000-000000000002',-999002,'b1000000-0000-4000-8000-000000000002','Synthetic','Player','Synthetic Player');
INSERT INTO public.contracts(id,player_id,team_id,start_year,end_year,salary_y1)
VALUES ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',2026,2027,1000000);
