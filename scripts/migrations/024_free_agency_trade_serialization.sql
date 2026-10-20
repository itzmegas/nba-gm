BEGIN;

-- Trades and later signing transactions share a game-first lock order.
CREATE OR REPLACE FUNCTION execute_trade_transactional(
  p_game_id UUID,
  p_team_a_id UUID,
  p_team_b_id UUID,
  p_assets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_trade_id UUID;
  v_asset JSONB;
  v_type TEXT;
  v_id UUID;
  v_from UUID;
  v_to UUID;
  v_pick game_pick_inventory%ROWTYPE;
  v_state game_player_states%ROWTYPE;
  v_metadata JSONB;
  v_contract contracts%ROWTYPE;
  v_contract_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR p_team_a_id = p_team_b_id THEN
    RAISE EXCEPTION 'Game or participating teams are invalid';
  END IF;
  IF jsonb_typeof(p_assets) <> 'array' OR jsonb_array_length(p_assets) < 2 THEN
    RAISE EXCEPTION 'A trade requires assets from both teams';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_assets) a WHERE NOT (a ? 'asset_type' AND a ? 'asset_id' AND a ? 'from_team_id'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_assets) a WHERE a->>'from_team_id' = p_team_a_id::TEXT) = 0
    OR (SELECT count(*) FROM jsonb_array_elements(p_assets) a WHERE a->>'from_team_id' = p_team_b_id::TEXT) = 0 THEN
    RAISE EXCEPTION 'Each team must send at least one asset';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_assets) a) <> (
    SELECT count(DISTINCT (a->>'asset_type') || ':' || (a->>'asset_id')) FROM jsonb_array_elements(p_assets) a
  ) THEN
    RAISE EXCEPTION 'Duplicate trade asset';
  END IF;

  INSERT INTO executed_trades (game_id, team_a_id, team_b_id)
  VALUES (p_game_id, p_team_a_id, p_team_b_id) RETURNING id INTO v_trade_id;
  FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets) LOOP
    v_type := v_asset->>'asset_type';
    v_id := (v_asset->>'asset_id')::UUID;
    v_from := (v_asset->>'from_team_id')::UUID;
    v_to := CASE WHEN v_from = p_team_a_id THEN p_team_b_id ELSE p_team_a_id END;
    IF v_from NOT IN (p_team_a_id, p_team_b_id) OR v_type NOT IN ('player', 'pick') THEN
      RAISE EXCEPTION 'Asset does not belong to this trade';
    END IF;
    IF v_type = 'player' THEN
      SELECT * INTO v_state FROM game_player_states
      WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE;
      IF NOT FOUND OR v_state.team_id IS DISTINCT FROM v_from THEN
        RAISE EXCEPTION 'Player ownership is stale or invalid';
      END IF;
      SELECT count(*) INTO v_contract_count FROM contracts
      WHERE game_id = p_game_id AND player_id = v_id;
      IF v_contract_count = 0 AND NOT EXISTS (
        SELECT 1 FROM game_runtime_contracts r WHERE r.game_id = p_game_id AND r.player_id = v_id
      ) THEN
        RAISE EXCEPTION 'Player contract is missing';
      END IF;
      UPDATE game_player_states SET team_id = v_to, updated_at = now() WHERE id = v_state.id;
      IF v_contract_count > 0 THEN
        FOR v_contract IN SELECT * FROM contracts
          WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE LOOP
          IF v_contract.team_id IS DISTINCT FROM v_from THEN
            RAISE EXCEPTION 'Player contract ownership is stale or invalid';
          END IF;
        END LOOP;
        UPDATE contracts SET team_id = v_to, updated_at = now()
        WHERE game_id = p_game_id AND player_id = v_id AND team_id = v_from;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        IF v_updated_count <> v_contract_count THEN
          RAISE EXCEPTION 'Player contract transfer was incomplete';
        END IF;
      END IF;
      v_metadata := jsonb_build_object('player_id', v_id);
    ELSE
      SELECT * INTO v_pick FROM game_pick_inventory
      WHERE game_id = p_game_id AND id = v_id FOR UPDATE;
      IF NOT FOUND OR v_pick.owner_team_id IS DISTINCT FROM v_from OR NOT v_pick.is_transferable THEN
        RAISE EXCEPTION 'Draft pick ownership is stale or invalid';
      END IF;
      SELECT jsonb_build_object('pick_id', p.id, 'draft_year', p.draft_year,
        'draft_round', p.draft_round, 'protection', p.protection,
        'original_team_id', p.original_team_id)
      INTO v_metadata FROM draft_picks p WHERE p.id = v_pick.draft_pick_id;
      UPDATE game_pick_inventory SET owner_team_id = v_to, updated_at = now() WHERE id = v_pick.id;
    END IF;
    INSERT INTO trade_asset_snapshots (executed_trade_id, asset_type, asset_id, from_team_id, to_team_id, metadata)
    VALUES (v_trade_id, v_type, v_id, v_from, v_to, coalesce(v_metadata, '{}'::jsonb));
  END LOOP;
  RETURN v_trade_id;
END;
$$;
REVOKE ALL ON FUNCTION execute_trade_transactional(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION execute_trade_transactional(UUID, UUID, UUID, JSONB) TO authenticated;

COMMIT;
