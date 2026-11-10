BEGIN;

-- Versioned entry prevents the new HTTP route from silently using the old, weaker RPC.
CREATE FUNCTION public.execute_trade_authoritative(
  p_game_id UUID, p_team_a_id UUID, p_team_b_id UUID, p_assets JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  g public.games%ROWTYPE;
  a JSONB;
  asset_id UUID;
  sender UUID;
  recipient UUID;
  pick public.game_pick_inventory%ROWTYPE;
  trade_id UUID;
  metadata JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION USING ERRCODE = 'P2002', MESSAGE = 'UNAUTHORIZED';
  END IF;
  -- Same first lock as release/signing/day-advance: no check-then-act window.
  SELECT * INTO g FROM public.games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR g.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P2003', MESSAGE = 'GAME_NOT_FOUND';
  END IF;
  IF g.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION USING ERRCODE = 'P2004', MESSAGE = 'GAME_NOT_ACTIVE';
  END IF;
  IF p_team_a_id IS NULL OR p_team_b_id IS NULL OR p_team_a_id = p_team_b_id
    OR g.selected_team_id NOT IN (p_team_a_id, p_team_b_id)
    OR EXISTS (
      SELECT 1 FROM unnest(ARRAY[p_team_a_id, p_team_b_id]) t(id)
      WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE id = t.id)
        OR NOT (t.id = g.selected_team_id
          OR EXISTS (SELECT 1 FROM public.game_player_states WHERE game_id = g.id AND team_id = t.id)
          OR EXISTS (SELECT 1 FROM public.league_standings WHERE game_id = g.id AND team_id = t.id)
          OR EXISTS (SELECT 1 FROM public.game_pick_inventory WHERE game_id = g.id AND owner_team_id = t.id))
    ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2005', MESSAGE = 'INVALID_TEAMS';
  END IF;
  IF p_assets IS NULL OR jsonb_typeof(p_assets) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  IF jsonb_array_length(p_assets) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
  END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(p_assets) LOOP
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    IF NOT (a ?& ARRAY['asset_type','asset_id','from_team_id'])
      OR (a - ARRAY['asset_type','asset_id','from_team_id']) <> '{}'::JSONB
      OR jsonb_typeof(a->'asset_type') IS DISTINCT FROM 'string'
      OR jsonb_typeof(a->'asset_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(a->'from_team_id') IS DISTINCT FROM 'string'
      OR (a->>'asset_type') NOT IN ('player','pick') THEN
      RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
    END IF;
    BEGIN
      asset_id := (a->>'asset_id')::UUID;
      sender := (a->>'from_team_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
    END;
    IF sender NOT IN (p_team_a_id, p_team_b_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assets) entry
      GROUP BY entry->>'asset_type', (entry->>'asset_id')::UUID HAVING count(*) > 1)
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_assets) entry WHERE (entry->>'from_team_id')::UUID = p_team_a_id)
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_assets) entry WHERE (entry->>'from_team_id')::UUID = p_team_b_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P2001', MESSAGE = 'INVALID_REQUEST';
  END IF;

  INSERT INTO public.executed_trades(game_id, team_a_id, team_b_id)
    VALUES (g.id, p_team_a_id, p_team_b_id) RETURNING id INTO trade_id;
  FOR a IN SELECT value FROM jsonb_array_elements(p_assets) LOOP
    asset_id := (a->>'asset_id')::UUID;
    sender := (a->>'from_team_id')::UUID;
    recipient := CASE WHEN sender = p_team_a_id THEN p_team_b_id ELSE p_team_a_id END;
    IF a->>'asset_type' = 'player' THEN
      -- No authoritative hard-cap source exists. Never infer that missing means unrestricted.
      -- This also blocks all salary/roster mutations until their complete rules can be enforced.
      RAISE EXCEPTION USING ERRCODE = 'P2007', MESSAGE = 'HARD_CAP_UNKNOWN';
    END IF;
    SELECT * INTO pick FROM public.game_pick_inventory
      WHERE game_id = g.id AND id = asset_id FOR UPDATE;
    IF NOT FOUND OR pick.owner_team_id IS DISTINCT FROM sender OR NOT pick.is_transferable THEN
      RAISE EXCEPTION USING ERRCODE = 'P2006', MESSAGE = 'STALE_ASSET';
    END IF;
    SELECT jsonb_build_object('pick_id', p.id, 'draft_year', p.draft_year,
      'draft_round', p.draft_round, 'protection', p.protection,
      'original_team_id', p.original_team_id) INTO metadata
      FROM public.draft_picks p WHERE p.id = pick.draft_pick_id;
    UPDATE public.game_pick_inventory SET owner_team_id = recipient, updated_at = now() WHERE id = pick.id;
    INSERT INTO public.trade_asset_snapshots(executed_trade_id, asset_type, asset_id, from_team_id, to_team_id, metadata)
      VALUES (trade_id, 'pick', asset_id, sender, recipient, metadata);
  END LOOP;
  RETURN trade_id;
END;
$$;
REVOKE ALL ON FUNCTION public.execute_trade_authoritative(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.execute_trade_authoritative(UUID, UUID, UUID, JSONB) TO authenticated;

-- Compatibility name shares the same authority: direct invocation cannot bypass the new gate.
CREATE OR REPLACE FUNCTION public.execute_trade_transactional(
  p_game_id UUID, p_team_a_id UUID, p_team_b_id UUID, p_assets JSONB
) RETURNS UUID
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$ SELECT public.execute_trade_authoritative(p_game_id, p_team_a_id, p_team_b_id, p_assets); $$;
REVOKE ALL ON FUNCTION public.execute_trade_transactional(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.execute_trade_transactional(UUID, UUID, UUID, JSONB) TO authenticated;

COMMIT;
