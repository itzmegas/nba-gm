BEGIN;

-- Contract copy tables are immutable during normal operation, but an owned
-- initializing game may be safely compensated after a failed initialization.
CREATE OR REPLACE FUNCTION enforce_game_contract_copy_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_id UUID;
BEGIN
  v_game_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.game_id ELSE NEW.game_id END;
  IF NOT EXISTS (
    SELECT 1
    FROM games
    WHERE id = v_game_id
      AND status = 'initializing'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Game contract snapshots may only be changed while the game is initializing';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Game contract snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rollback_seed_game_data(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  SELECT * INTO v_game
  FROM games
  WHERE id = p_game_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rollback_seed_game_data aborted: game % is not owned by the caller', p_game_id;
  END IF;
  IF v_game.status <> 'initializing' OR v_game.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'rollback_seed_game_data aborted: game % is not initializing', p_game_id;
  END IF;

  -- Delete only game-owned initialization state. Canonical players, teams,
  -- roster promotion rows, and global source snapshots remain untouched.
  DELETE FROM game_contract_provenance WHERE game_id = p_game_id;
  DELETE FROM game_contract_seasons WHERE game_id = p_game_id;
  DELETE FROM game_contract_identities WHERE game_id = p_game_id;
  DELETE FROM game_contract_agreements WHERE game_id = p_game_id;
  DELETE FROM game_contract_materializations WHERE game_id = p_game_id;
  DELETE FROM contracts WHERE game_id = p_game_id;
  DELETE FROM game_player_states WHERE game_id = p_game_id;
  DELETE FROM game_pick_inventory WHERE game_id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION rollback_seed_game_data(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rollback_seed_game_data(UUID) TO authenticated;

COMMIT;
