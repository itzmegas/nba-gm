BEGIN;

CREATE TABLE public.player_rating_source_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_version TEXT NOT NULL CHECK (game_version ~ '^2K[0-9]{2}$'),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  stored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_version, content_hash),
  UNIQUE (id, game_version)
);

CREATE TABLE public.player_rating_source_cache (
  game_version TEXT PRIMARY KEY CHECK (game_version ~ '^2K[0-9]{2}$'),
  version_id UUID,
  revalidated_at TIMESTAMPTZ,
  lease_id UUID,
  lease_expires_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  FOREIGN KEY (version_id, game_version)
    REFERENCES public.player_rating_source_versions(id, game_version),
  CHECK ((version_id IS NULL) = (revalidated_at IS NULL)),
  CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL))
);

ALTER TABLE public.player_rating_source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_rating_source_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_rating_source_versions, public.player_rating_source_cache
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.player_rating_source_versions, public.player_rating_source_cache TO service_role;

CREATE FUNCTION public.acquire_player_rating_refresh(p_game_version TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  head public.player_rating_source_cache%ROWTYPE;
  token UUID;
  v_now TIMESTAMPTZ;
  snapshot JSONB;
BEGIN
  IF p_game_version IS NULL OR p_game_version !~ '^2K[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid player rating edition';
  END IF;
  INSERT INTO public.player_rating_source_cache(game_version) VALUES (p_game_version)
    ON CONFLICT DO NOTHING;
  SELECT * INTO head FROM public.player_rating_source_cache
    WHERE game_version = p_game_version FOR UPDATE;
  v_now := clock_timestamp();
  IF head.next_refresh_at <= v_now
     AND (head.lease_expires_at IS NULL OR head.lease_expires_at <= v_now) THEN
    token := gen_random_uuid();
    UPDATE public.player_rating_source_cache SET lease_id = token,
      lease_expires_at = v_now + interval '60 seconds'
      WHERE game_version = p_game_version;
  END IF;
  IF head.version_id IS NOT NULL THEN
    SELECT jsonb_build_object('version_id', v.id, 'revalidated_at', head.revalidated_at,
      'snapshot', v.payload) INTO snapshot
      FROM public.player_rating_source_versions v WHERE v.id = head.version_id;
  END IF;
  RETURN jsonb_build_object('lease_id', token, 'current', snapshot,
    'refresh_in_progress', COALESCE(head.lease_expires_at > v_now AND token IS NULL, false),
    'fresh', COALESCE(head.revalidated_at > v_now - interval '24 hours', false));
END;
$$;

CREATE FUNCTION public.publish_player_rating_snapshot(
  p_game_version TEXT, p_lease_id UUID, p_snapshot JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  head public.player_rating_source_cache%ROWTYPE;
  version_uuid UUID;
  hash TEXT := p_snapshot->>'contentHash';
  v_now TIMESTAMPTZ;
  snapshot JSONB;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object'
     OR p_snapshot->>'source' IS DISTINCT FROM 'nba2kapi'
     OR p_snapshot->>'sourceUrl' IS DISTINCT FROM 'https://api.nba2kapi.com/api/players/bulk?teamType=curr'
     OR p_snapshot->>'gameVersion' IS DISTINCT FROM p_game_version
     OR hash IS NULL OR hash !~ '^[a-f0-9]{64}$'
     OR jsonb_typeof(p_snapshot->'players') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_snapshot->'excludedPlayers') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid player rating snapshot';
  END IF;
  IF jsonb_array_length(p_snapshot->'players') = 0
     OR jsonb_array_length(p_snapshot->'players') + jsonb_array_length(p_snapshot->'excludedPlayers') > 10000 THEN
    RAISE EXCEPTION 'Invalid player rating snapshot size';
  END IF;
  SELECT * INTO head FROM public.player_rating_source_cache
    WHERE game_version = p_game_version FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR p_lease_id IS NULL OR head.lease_id IS DISTINCT FROM p_lease_id
     OR head.lease_expires_at <= v_now THEN
    RAISE EXCEPTION 'Player rating refresh lease lost';
  END IF;
  INSERT INTO public.player_rating_source_versions(game_version, content_hash, payload)
    VALUES (p_game_version, hash, p_snapshot)
    ON CONFLICT (game_version, content_hash) DO NOTHING RETURNING id INTO version_uuid;
  IF version_uuid IS NULL THEN
    SELECT id INTO version_uuid FROM public.player_rating_source_versions
      WHERE game_version = p_game_version AND content_hash = hash;
  END IF;
  UPDATE public.player_rating_source_cache SET version_id = version_uuid,
    revalidated_at = v_now, next_refresh_at = v_now + interval '24 hours',
    lease_id = NULL, lease_expires_at = NULL WHERE game_version = p_game_version;
  SELECT payload INTO snapshot FROM public.player_rating_source_versions WHERE id = version_uuid;
  RETURN jsonb_build_object('version_id', version_uuid, 'revalidated_at', v_now,
    'snapshot', snapshot);
END;
$$;

CREATE FUNCTION public.fail_player_rating_refresh(p_game_version TEXT, p_lease_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.player_rating_source_cache SET lease_id = NULL, lease_expires_at = NULL,
    next_refresh_at = clock_timestamp() + interval '5 minutes'
    WHERE game_version = p_game_version AND lease_id = p_lease_id;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_player_rating_refresh(TEXT),
  public.publish_player_rating_snapshot(TEXT, UUID, JSONB),
  public.fail_player_rating_refresh(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acquire_player_rating_refresh(TEXT),
  public.publish_player_rating_snapshot(TEXT, UUID, JSONB),
  public.fail_player_rating_refresh(TEXT, UUID) TO service_role;

COMMIT;
