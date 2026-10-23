BEGIN;

DO $$
DECLARE
  attributes JSONB := '{}'::JSONB;
  attribute TEXT;
  version_uuid UUID;
BEGIN
  FOREACH attribute IN ARRAY ARRAY[
    'closeShot', 'midRangeShot', 'threePointShot', 'freeThrow', 'drawFoul', 'ballHandle',
    'passAccuracy', 'interiorDefense', 'perimeterDefense', 'steal', 'block',
    'offensiveRebound', 'defensiveRebound', 'stamina'
  ] LOOP
    attributes := attributes || jsonb_build_object(attribute, 60);
  END LOOP;
  ASSERT public.is_valid_player_attributes(attributes);
  ASSERT NOT public.is_valid_player_attributes(attributes - 'stamina');
  ASSERT NOT public.is_valid_player_attributes(attributes || '{"extra":60}');
  ASSERT NOT public.is_valid_player_attributes(jsonb_set(attributes, '{stamina}', '100'));
  ASSERT NOT public.is_valid_player_attributes(jsonb_set(attributes, '{stamina}', '-1'));
  ASSERT NOT public.is_valid_player_attributes(jsonb_set(attributes, '{stamina}', '60.5'));
  ASSERT NOT public.is_valid_player_attributes(jsonb_set(attributes, '{stamina}', '"60"'));
  ASSERT NOT public.is_valid_player_attributes('[]');
  INSERT INTO public.player_rating_source_versions(game_version, content_hash, payload)
    VALUES ('2K27', repeat('c', 64), '{}') RETURNING id INTO version_uuid;
  INSERT INTO public.game_attribute_materializations(game_id, season_year, source_version_id, player_count)
    VALUES ('40000000-0000-4000-8000-000000000001', 2026, version_uuid, 2),
      ('40000000-0000-4000-8000-000000000002', 2026, version_uuid, 1);
  INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin, match_method,
    attributes, source_slug, source_overall, generator_version, identity_evidence) VALUES
    ('40000000-0000-4000-8000-000000000001', 2026, '30000000-0000-4000-8000-000000000002',
      'nba2kapi', 'name-and-team', attributes, 'synthetic-one', 75, NULL, '{}'),
    ('40000000-0000-4000-8000-000000000001', 2026, '30000000-0000-4000-8000-000000000003',
      'estimated', 'missing-source', attributes, NULL, NULL, 'replacement-v1', '{}');
  BEGIN
    INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin,
      match_method, attributes, generator_version, identity_evidence) VALUES
      ('40000000-0000-4000-8000-000000000001', 2026, '30000000-0000-4000-8000-000000000004',
        'estimated', 'missing-source', attributes, NULL, '{}');
    RAISE EXCEPTION 'Unversioned estimates unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin,
      match_method, attributes, source_slug, source_overall, identity_evidence) VALUES
      ('40000000-0000-4000-8000-000000000001', 2026, '30000000-0000-4000-8000-000000000004',
        'nba2kapi', 'name-and-team', attributes, 'synthetic-one', 75, '{}');
    RAISE EXCEPTION 'Duplicate source identity unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin,
      match_method, attributes, generator_version, identity_evidence) VALUES
      ('40000000-0000-4000-8000-000000000002', 2026, '30000000-0000-4000-8000-000000000002',
        'estimated', 'missing-source', attributes, 'replacement-v1', '{}');
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Player from another game unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  ASSERT NOT has_table_privilege('authenticated', 'public.game_player_attributes', 'UPDATE');
  ASSERT NOT has_table_privilege('service_role', 'public.game_player_attributes', 'INSERT');
  ASSERT NOT has_table_privilege('anon', 'public.game_player_attributes', 'SELECT');
END;
$$;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.games TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) = 2 FROM public.game_player_attributes);
  ASSERT (SELECT count(*) = 1 FROM public.game_attribute_materializations);
END $$;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) = 0 FROM public.game_player_attributes);
  ASSERT (SELECT count(*) = 1 FROM public.game_attribute_materializations);
END $$;
RESET ROLE;

UPDATE public.game_player_states SET team_id = '20000000-0000-4000-8000-000000000002'
  WHERE game_id = '40000000-0000-4000-8000-000000000001'
    AND player_id = '30000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  ASSERT (SELECT count(*) = 2 FROM public.game_player_attributes), 'Transfers preserve attributes';
END $$;

ROLLBACK;
