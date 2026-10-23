BEGIN;

INSERT INTO auth.users(id) VALUES ('94000000-0000-4000-8000-000000000001');
INSERT INTO public.teams(id, nba_id, name, city, abbreviation) VALUES
  ('94100000-0000-4000-8000-000000000001', 941, 'Rollback Team', 'Rollback', 'RBT');
INSERT INTO public.players(id, first_name, last_name, full_name, position, is_active) VALUES
  ('94200000-0000-4000-8000-000000000001', 'Rollback', 'Player', 'Rollback Player', 'G', true);
INSERT INTO public.games(id, user_id, name, selected_team_id, season_year, season_era_id,
  simulation_date, status, deleted_at) VALUES
  ('94300000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
    'Rollback test', '94100000-0000-4000-8000-000000000001', 2026, 'modern',
    '2026-10-01', 'initializing', NULL);
INSERT INTO public.game_player_states(game_id, player_id, team_id)
  VALUES ('94300000-0000-4000-8000-000000000001', '94200000-0000-4000-8000-000000000001',
    '94100000-0000-4000-8000-000000000001');
INSERT INTO public.game_contract_materializations(game_id, source, season, source_version_ids)
  VALUES ('94300000-0000-4000-8000-000000000001', 'test', '2026-27', array_fill(gen_random_uuid(), ARRAY[30]));
INSERT INTO public.player_rating_source_versions(game_version, content_hash, payload)
  VALUES ('2K27', repeat('f',64), '{}');
INSERT INTO public.game_attribute_materializations(game_id, season_year, source_version_id, player_count)
  SELECT '94300000-0000-4000-8000-000000000001', 2026, id, 1
  FROM public.player_rating_source_versions WHERE game_version='2K27' AND content_hash=repeat('f',64);
INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin, match_method,
  attributes, generator_version, identity_evidence)
  VALUES ('94300000-0000-4000-8000-000000000001', 2026,
    '94200000-0000-4000-8000-000000000001', 'estimated', 'missing-source',
    jsonb_build_object('closeShot',60,'midRangeShot',60,'threePointShot',60,'freeThrow',60,
      'drawFoul',60,'ballHandle',60,'passAccuracy',60,'interiorDefense',60,
      'perimeterDefense',60,'steal',60,'block',60,'offensiveRebound',60,
      'defensiveRebound',60,'stamina',60), 'replacement-v1', '{}');
INSERT INTO public.free_agency_imports(game_id, snapshot, enrolled_count, skipped_count)
  VALUES ('94300000-0000-4000-8000-000000000001', '{}', 1, 0);
INSERT INTO public.free_agency_availability_enrollments(game_id, player_id, evidence_kind)
  VALUES ('94300000-0000-4000-8000-000000000001',
    '94200000-0000-4000-8000-000000000001', 'simulation-bootstrap-enrollment');

SELECT set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT public.rollback_seed_game_data('94300000-0000-4000-8000-000000000001');
RESET ROLE;

DO $$ BEGIN
  ASSERT (SELECT status='initializing' AND deleted_at IS NULL FROM public.games
    WHERE id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.game_player_attributes
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.game_attribute_materializations
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.free_agency_imports
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.free_agency_availability_enrollments
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.game_contract_materializations
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=0 FROM public.game_player_states
    WHERE game_id='94300000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=1 FROM public.players
    WHERE id='94200000-0000-4000-8000-000000000001');
  ASSERT (SELECT count(*)=1 FROM public.player_rating_source_versions
    WHERE game_version='2K27' AND content_hash=repeat('f',64));
END $$;

ROLLBACK;
