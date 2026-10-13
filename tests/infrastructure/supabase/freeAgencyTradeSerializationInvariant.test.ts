import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../scripts/migrations/024_free_agency_trade_serialization.sql", import.meta.url),
  "utf8"
);

describe("free agency trade serialization migration", () => {
  it("mirrors migration 024 independently of ownership and guard migrations", () => {
    const marker = "-- Canonical schema mirror for migration 024. Keep byte-identical below.\n";
    const endMarker = "-- End canonical schema mirror for migration 024.\n";
    const start = schema.indexOf(marker);
    const end = schema.indexOf(endMarker, start + marker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(migration);
    expect(migration).not.toContain("guard_game_player_state_writes");
    expect(migration).not.toContain("game_contract_identities_game_player_fkey");
  });

  it("takes the owned game lock before any player or legacy-contract lock", () => {
    const gameLock = migration.indexOf(
      "FROM games WHERE id = p_game_id AND user_id = auth.uid() FOR UPDATE"
    );
    const rosterLock = migration.indexOf(
      "FROM game_player_states\n      WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE"
    );
    const contractLock = migration.indexOf(
      "WHERE game_id = p_game_id AND player_id = v_id FOR UPDATE LOOP"
    );
    expect(gameLock).toBeGreaterThanOrEqual(0);
    expect(rosterLock).toBeGreaterThan(gameLock);
    expect(contractLock).toBeGreaterThan(gameLock);
    expect(migration).toContain("SET search_path = pg_catalog, public");
  });
});
