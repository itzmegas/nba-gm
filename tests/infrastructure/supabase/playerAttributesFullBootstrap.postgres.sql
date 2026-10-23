INSERT INTO auth.users(id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
INSERT INTO public.teams(id, nba_id, name, city, abbreviation, base_rating) VALUES
  ('20000000-0000-4000-8000-000000000001', 1001, 'Test Team One', 'Test', 'TST', 75),
  ('20000000-0000-4000-8000-000000000002', 1002, 'Test Team Two', 'Test', 'TSU', 75);
INSERT INTO public.players(id, first_name, last_name, full_name, position, years_of_experience, is_active) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Player', 'One', 'Player One', 'G', 4, true),
  ('30000000-0000-4000-8000-000000000002', 'Player', 'Two', 'Player Two', 'G', 4, true),
  ('30000000-0000-4000-8000-000000000003', 'Player', 'Three', 'Player Three', 'C', 3, true),
  ('30000000-0000-4000-8000-000000000004', 'Player', 'Four', 'Player Four', 'F', 4, true),
  ('30000000-0000-4000-8000-000000000005', 'Player', 'Five', 'Player Five', 'F', 4, true),
  ('30000000-0000-4000-8000-000000000006', 'Player', 'Six', 'Player Six', 'G', 4, true);
INSERT INTO public.games(id, user_id, name, selected_team_id, season_year, season_era_id,
  simulation_date, status, deleted_at) VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    'Initializing attributes test', '20000000-0000-4000-8000-000000000001', 2026, 'modern',
    '2026-10-02', 'initializing', NULL),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
    'Owner isolation test', '20000000-0000-4000-8000-000000000002', 2026, 'modern',
    '2026-10-04', 'active', NULL);
INSERT INTO public.game_player_states(game_id, player_id, team_id, is_active) VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', NULL, true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', NULL, true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000002', true),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000001', true);
