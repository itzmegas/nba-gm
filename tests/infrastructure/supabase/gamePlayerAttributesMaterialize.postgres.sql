BEGIN;

UPDATE public.games SET status = 'initializing', deleted_at = NULL
  WHERE id = '40000000-0000-4000-8000-000000000001';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  attrs JSONB := '{}'::JSONB;
  source_payload JSONB;
  rows JSONB;
  version_uuid UUID;
  lease_uuid UUID;
  result JSONB;
  player UUID;
  attribute TEXT;
BEGIN
  FOREACH attribute IN ARRAY ARRAY[
    'closeShot', 'midRangeShot', 'threePointShot', 'freeThrow', 'drawFoul', 'ballHandle',
    'passAccuracy', 'interiorDefense', 'perimeterDefense', 'steal', 'block',
    'offensiveRebound', 'defensiveRebound', 'stamina'
  ] LOOP
    attrs := attrs || jsonb_build_object(attribute, 60);
  END LOOP;
  source_payload := jsonb_build_object(
    'source', 'nba2kapi',
    'sourceUrl', 'https://api.nba2kapi.com/api/players/bulk?teamType=curr',
    'gameVersion', '2K27',
    'observedAt', '2026-10-23T00:00:00Z',
    'contentHash', repeat('d', 64),
    'requestCount', 1,
    'players', jsonb_build_array(jsonb_build_object(
      'slug', 'synthetic-one', 'name', 'Synthetic One', 'team', 'Test Team',
      'teamType', 'curr', 'gameVersion', '2K27', 'lastUpdated', '2026-10-23T00:00:00Z',
      'overall', 75, 'attributes', attrs
    )),
    'excludedPlayers', '[]'::JSONB
  );
  result := public.acquire_player_rating_refresh('2K27');
  lease_uuid := (result->>'lease_id')::UUID;
  result := public.publish_player_rating_snapshot('2K27', lease_uuid, source_payload);
  version_uuid := (result->>'version_id')::UUID;

  rows := jsonb_build_array(
    jsonb_build_object('playerId', '30000000-0000-4000-8000-000000000002',
      'origin', 'nba2kapi', 'matchMethod', 'name-and-team', 'attributes', attrs,
      'sourceSlug', 'synthetic-one', 'sourceOverall', 75, 'generatorVersion', NULL,
      'identityEvidence', '{}'::JSONB),
    jsonb_build_object('playerId', '30000000-0000-4000-8000-000000000003',
      'origin', 'estimated', 'matchMethod', 'missing-source', 'attributes', attrs,
      'sourceSlug', NULL, 'sourceOverall', NULL, 'generatorVersion', 'replacement-v1',
      'identityEvidence', '{}'::JSONB),
    jsonb_build_object('playerId', '30000000-0000-4000-8000-000000000004',
      'origin', 'estimated', 'matchMethod', 'uncorroborated-identity', 'attributes', attrs,
      'sourceSlug', NULL, 'sourceOverall', NULL, 'generatorVersion', 'replacement-v1',
      'identityEvidence', '{}'::JSONB),
    jsonb_build_object('playerId', '30000000-0000-4000-8000-000000000005',
      'origin', 'estimated', 'matchMethod', 'ambiguous-identity', 'attributes', attrs,
      'sourceSlug', NULL, 'sourceOverall', NULL, 'generatorVersion', 'replacement-v1',
      'identityEvidence', '{}'::JSONB),
    jsonb_build_object('playerId', '30000000-0000-4000-8000-000000000006',
      'origin', 'estimated', 'matchMethod', 'incomplete-attributes', 'attributes', attrs,
      'sourceSlug', NULL, 'sourceOverall', NULL, 'generatorVersion', 'replacement-v1',
      'identityEvidence', '{}'::JSONB)
  );
  result := public.materialize_game_player_attributes(
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', 2026, version_uuid, rows
  );
  ASSERT result->>'status' = 'materialized';
  ASSERT (result->>'playerCount')::INTEGER = 5;
  ASSERT (SELECT count(*) = 5 FROM public.game_player_attributes
    WHERE game_id = '40000000-0000-4000-8000-000000000001');

  result := public.materialize_game_player_attributes(
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001', 2026, version_uuid, rows
  );
  ASSERT result->>'status' = 'already-materialized';

  BEGIN
    PERFORM public.materialize_game_player_attributes(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001', 2026, version_uuid,
      jsonb_set(rows, '{0,attributes,stamina}', '61')
    );
    RAISE EXCEPTION 'Changed retry payload unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Attribute materialization retry changed its payload';
  END;

  BEGIN
    PERFORM public.materialize_game_player_attributes(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001', 2026, version_uuid,
      (rows - 4) || jsonb_build_array(rows->0)
    );
    RAISE EXCEPTION 'Duplicate identity retry unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Attribute materialization retry changed its source or coverage';
  END;

  BEGIN
    PERFORM public.materialize_game_player_attributes(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002', 2026, version_uuid, rows
    );
    RAISE EXCEPTION 'Wrong owner unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Owned initializing modern game required';
  END;

  BEGIN
    PERFORM public.materialize_game_player_attributes(
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001', 2026, version_uuid,
      rows - 1
    );
    RAISE EXCEPTION 'Incomplete coverage unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Player attribute coverage does not match game roster';
  END;

  BEGIN
    INSERT INTO public.game_player_attributes(game_id, season_year, player_id, origin,
      match_method, attributes, generator_version, identity_evidence) VALUES (
      '40000000-0000-4000-8000-000000000001', 2026,
      '30000000-0000-4000-8000-000000000002', 'estimated', 'missing-source', attrs,
      'replacement-v1', '{}'::JSONB
    );
    RAISE EXCEPTION 'Direct service insert unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;
RESET ALL;
ROLLBACK;
