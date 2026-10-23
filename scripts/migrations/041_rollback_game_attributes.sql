BEGIN;

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

  DELETE FROM game_player_attributes WHERE game_id = p_game_id;
  DELETE FROM game_attribute_materializations WHERE game_id = p_game_id;
  DELETE FROM free_agency_imports WHERE game_id = p_game_id;
  DELETE FROM free_agency_availability_enrollments WHERE game_id = p_game_id;
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
