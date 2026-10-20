import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../scripts/migrations/022_free_agency_contract_ownership.sql", import.meta.url),
  "utf8"
);

describe("free agency imported contract ownership migration", () => {
  it("mirrors migration 022 without depending on later guard or trade migrations", () => {
    const marker = "-- Canonical schema mirror for migration 022. Keep byte-identical below.\n";
    const endMarker = "-- End canonical schema mirror for migration 022.\n";
    const start = schema.indexOf(marker);
    const end = schema.indexOf(endMarker, start + marker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(migration);
    expect(migration).not.toContain("guard_game_player_state_writes");
    expect(migration).not.toContain("execute_trade_transactional");
  });

  it("rebinds only game/player identity and retains team provenance and delete protection", () => {
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS game_contract_identities_game_id_player_id_team_id_fkey"
    );
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS game_contract_agreements_game_id_player_id_team_id_fkey"
    );
    expect(migration).toContain("FOREIGN KEY (game_id, player_id)");
    expect(migration).toContain(
      "REFERENCES game_player_states(game_id, player_id) ON DELETE RESTRICT"
    );
    expect(migration).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS game_player_states_game_player_identity_unique"
    );
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS game_player_states_game_player_team_unique"
    );
    expect(migration).not.toContain("UPDATE game_contract_identities");
    expect(migration).not.toContain("UPDATE game_contract_agreements");
  });
});
