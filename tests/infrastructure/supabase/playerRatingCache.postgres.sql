BEGIN;

DO $$
DECLARE
  first JSONB;
  second JSONB;
  result JSONB;
  token UUID;
  original_version UUID;
  payload JSONB := jsonb_build_object('source', 'nba2kapi', 'gameVersion', '2K27',
    'sourceUrl', 'https://api.nba2kapi.com/api/players/bulk?teamType=curr',
    'contentHash', repeat('a', 64), 'players', '[{"slug":"synthetic-player"}]'::JSONB,
    'excludedPlayers', '[]'::JSONB);
BEGIN
  first := public.acquire_player_rating_refresh('2K27');
  token := (first->>'lease_id')::UUID;
  ASSERT token IS NOT NULL AND first->'current' = 'null'::JSONB;
  second := public.acquire_player_rating_refresh('2K27');
  ASSERT second->>'lease_id' IS NULL, 'Only one refresh owner is allowed';
  ASSERT (second->>'refresh_in_progress')::BOOLEAN;

  BEGIN
    PERFORM public.publish_player_rating_snapshot('2K27', gen_random_uuid(), payload);
    RAISE EXCEPTION 'Unexpected successful publication';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Player rating refresh lease lost';
  END;
  result := public.publish_player_rating_snapshot('2K27', token, payload);
  original_version := (result->>'version_id')::UUID;
  ASSERT original_version IS NOT NULL;
  first := public.acquire_player_rating_refresh('2K27');
  ASSERT (first->>'fresh')::BOOLEAN AND first->>'lease_id' IS NULL;
  ASSERT first->'current'->>'version_id' = original_version::TEXT;

  UPDATE public.player_rating_source_cache SET revalidated_at = now() - interval '25 hours',
    next_refresh_at = now() - interval '1 second' WHERE game_version = '2K27';
  first := public.acquire_player_rating_refresh('2K27');
  ASSERT NOT (first->>'fresh')::BOOLEAN;
  token := (first->>'lease_id')::UUID;
  ASSERT token IS NOT NULL AND first->'current'->>'version_id' = original_version::TEXT;
  PERFORM public.fail_player_rating_refresh('2K27', token);
  second := public.acquire_player_rating_refresh('2K27');
  ASSERT second->>'lease_id' IS NULL AND NOT (second->>'fresh')::BOOLEAN;
  ASSERT NOT (second->>'refresh_in_progress')::BOOLEAN, 'Cooldown is not an active download';
  ASSERT second->'current'->>'version_id' = original_version::TEXT, 'Failure preserves cache';

  UPDATE public.player_rating_source_cache SET next_refresh_at = now() - interval '1 second'
    WHERE game_version = '2K27';
  first := public.acquire_player_rating_refresh('2K27');
  token := (first->>'lease_id')::UUID;
  result := public.publish_player_rating_snapshot('2K27', token, payload);
  ASSERT result->>'version_id' = original_version::TEXT, 'Same content reuses immutable version';
  ASSERT (SELECT count(*) = 1 FROM public.player_rating_source_versions);

  UPDATE public.player_rating_source_cache SET next_refresh_at = now() - interval '1 second'
    WHERE game_version = '2K27';
  first := public.acquire_player_rating_refresh('2K27');
  token := (first->>'lease_id')::UUID;
  UPDATE public.player_rating_source_cache SET lease_expires_at = now() - interval '1 second'
    WHERE game_version = '2K27';
  second := public.acquire_player_rating_refresh('2K27');
  ASSERT second->>'lease_id' IS NOT NULL AND second->>'lease_id' <> token::TEXT;
  PERFORM public.fail_player_rating_refresh('2K27', token);
  ASSERT (SELECT lease_id = (second->>'lease_id')::UUID FROM public.player_rating_source_cache
    WHERE game_version = '2K27'), 'Old owner cannot release a replacement lease';
  BEGIN
    PERFORM public.publish_player_rating_snapshot('2K27', token, payload);
    RAISE EXCEPTION 'Unexpected expired publication';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'Player rating refresh lease lost';
  END;

  result := public.publish_player_rating_snapshot('2K27', (second->>'lease_id')::UUID,
    jsonb_set(payload, '{contentHash}', to_jsonb(repeat('b', 64))));
  ASSERT result->>'version_id' <> original_version::TEXT, 'Changed source creates a new version';
  ASSERT (SELECT v.payload->>'contentHash' = repeat('a', 64)
    FROM public.player_rating_source_versions v WHERE v.id = original_version),
    'Publishing a new version preserves the old payload';

  ASSERT NOT has_table_privilege('authenticated', 'public.player_rating_source_versions', 'SELECT');
  ASSERT NOT has_table_privilege('service_role', 'public.player_rating_source_versions', 'UPDATE');
  ASSERT NOT has_table_privilege('service_role', 'public.player_rating_source_versions', 'INSERT');
  ASSERT NOT has_function_privilege('authenticated', 'public.acquire_player_rating_refresh(text)', 'EXECUTE');
  ASSERT NOT has_function_privilege('anon', 'public.publish_player_rating_snapshot(text,uuid,jsonb)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.acquire_player_rating_refresh(text)', 'EXECUTE');
  ASSERT (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN (
    'public.player_rating_source_versions'::regclass, 'public.player_rating_source_cache'::regclass));
END;
$$;

SET LOCAL ROLE service_role;
SELECT public.acquire_player_rating_refresh('2K26');
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.acquire_player_rating_refresh('2K27');
    RAISE EXCEPTION 'Authenticated refresh unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

ROLLBACK;
