BEGIN;

-- Simulated agreements are game-owned runtime state, never imported observations.
CREATE TABLE game_runtime_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  origin_kind TEXT NOT NULL CHECK (origin_kind = 'simulated-agreement'),
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL CHECK (end_year BETWEEN start_year AND start_year + 4),
  annual_salary BIGINT NOT NULL CHECK (annual_salary > 0),
  is_player_option BOOLEAN NOT NULL DEFAULT false,
  is_team_option BOOLEAN NOT NULL DEFAULT false,
  is_guaranteed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id),
  CHECK (NOT (is_player_option AND is_team_option))
);

CREATE INDEX idx_game_runtime_contracts_game_player
  ON game_runtime_contracts(game_id, player_id);

ALTER TABLE game_runtime_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_runtime_contracts_owner_read ON game_runtime_contracts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM games g WHERE g.id = game_runtime_contracts.game_id AND g.user_id = auth.uid()
  ));

REVOKE ALL ON TABLE game_runtime_contracts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE game_runtime_contracts TO authenticated;
REVOKE ALL ON TABLE game_runtime_contracts FROM service_role;

COMMIT;
