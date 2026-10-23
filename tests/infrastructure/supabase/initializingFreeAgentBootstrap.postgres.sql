BEGIN;

INSERT INTO auth.users(id) VALUES ('95000000-0000-4000-8000-000000000001');
INSERT INTO public.teams(id, nba_id, name, city, abbreviation) VALUES
  ('95100000-0000-4000-8000-000000000001', 951, 'Free Agent Team', 'Free Agent', 'FAT');
INSERT INTO public.players(id, nba_id, first_name, last_name, full_name, position,
  years_of_experience, is_active) VALUES
  ('95200000-0000-4000-8000-000000000001', 9501, 'New', 'Freeagent', 'New Freeagent', 'G', 2, true);
INSERT INTO public.games(id, user_id, name, selected_team_id, season_year, season_era_id,
  simulation_date, status, deleted_at) VALUES
  ('95300000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001',
    'Initializing free agent test', '95100000-0000-4000-8000-000000000001', 2026,
    'modern', '2026-10-01', 'initializing', NULL);
INSERT INTO public.game_contract_materializations(game_id, source, season, source_version_ids)
  VALUES ('95300000-0000-4000-8000-000000000001', 'test', '2026-27', array_fill(gen_random_uuid(), ARRAY[30]));

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;
DO $$
DECLARE
  snapshot JSONB := jsonb_build_object('sourceUrl','https://www.nba.com/players/free-agent-tracker/2026',
    'seasonYear',2026,'players',jsonb_build_array(jsonb_build_object(
      'season','2026','type','ufa','newTeamId','0','isPlayerOption',false,'isTeamOption',false,
      'isEarlyTerminationOption',false,'isTwoWayFreeAgent',false,'playerId',9501,'exp',2,
      'playerFirstName','New','playerLastName','Freeagent','playerDisplayName','New Freeagent',
      'position','G')));
  result JSONB;
BEGIN
  result := public.import_initial_free_agents('95300000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000001', snapshot);
  ASSERT result->>'enrolled_count'='1';
  result := public.import_initial_free_agents('95300000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000001', snapshot);
  ASSERT result->>'enrolled_count'='1', 'Retry returns saved result';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.game_player_states WHERE game_id='95300000-0000-4000-8000-000000000001'
    AND player_id='95200000-0000-4000-8000-000000000001' AND team_id IS NULL AND is_active);
  ASSERT EXISTS (SELECT 1 FROM public.free_agency_availability_enrollments WHERE game_id='95300000-0000-4000-8000-000000000001'
    AND player_id='95200000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=1 FROM public.game_player_states WHERE game_id='95300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=1 FROM public.free_agency_availability_enrollments WHERE game_id='95300000-0000-4000-8000-000000000001');
  ASSERT (SELECT status='initializing' FROM public.games WHERE id='95300000-0000-4000-8000-000000000001');
END $$;

ROLLBACK;
