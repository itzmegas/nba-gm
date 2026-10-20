BEGIN;

-- Imported team IDs are provenance, not mutable roster ownership. Retain the
-- game/player relation while roster rows move between teams.
ALTER TABLE game_contract_identities
  DROP CONSTRAINT IF EXISTS game_contract_identities_game_id_player_id_team_id_fkey;
ALTER TABLE game_contract_identities
  ADD CONSTRAINT game_contract_identities_game_player_fkey
  FOREIGN KEY (game_id, player_id)
  REFERENCES game_player_states(game_id, player_id) ON DELETE RESTRICT;

ALTER TABLE game_contract_agreements
  DROP CONSTRAINT IF EXISTS game_contract_agreements_game_id_player_id_team_id_fkey;
ALTER TABLE game_contract_agreements
  ADD CONSTRAINT game_contract_agreements_game_player_fkey
  FOREIGN KEY (game_id, player_id)
  REFERENCES game_player_states(game_id, player_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS game_player_states_game_player_identity_unique
  ON game_player_states(game_id, player_id);

ALTER TABLE game_player_states
  DROP CONSTRAINT IF EXISTS game_player_states_game_player_team_unique;

COMMIT;
