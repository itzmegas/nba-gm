import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../scripts/migrations/020_free_agency_offers.sql", import.meta.url),
  "utf8"
);

function canonicalMigration(source: string): string {
  const startMarker = "-- Canonical schema mirror for migration 020. Keep byte-identical below.\n";
  const endMarker = "-- End canonical schema mirror for migration 020.\n";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return `${source.slice(start + startMarker.length, end).trimEnd()}\n`;
}

describe("free agency offer SQL invariants", () => {
  it("mirrors migration 020 and keeps enrollment privileged", () => {
    expect(canonicalMigration(schema)).toBe(migration);
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION enroll_simulated_free_agents(UUID, UUID[]) TO service_role"
    );
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM game_contract_materializations");
    expect(migration).toContain("simulation-bootstrap-enrollment");
    expect(migration).toContain("game_contract_agreements a WHERE a.game_id = p_game_id");
    expect(migration).not.toContain("INSERT INTO game_contract_agreements");
  });

  it("derives offer ownership, team and due date while denying direct writes", () => {
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("v_game.selected_team_id");
    expect(migration).toContain("v_game.simulation_date + 1");
    expect(migration).toContain("Idempotency key reused with changed offer payload");
    expect(migration).toContain(
      "status TEXT NOT NULL DEFAULT 'pending' CHECK (status = 'pending')"
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE free_agency_availability_enrollments, free_agency_pending_offers"
    );
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION submit_free_agency_offer");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION list_pending_free_agency_offers");
  });

  it("scopes canonical and legacy payroll to effective game-team ownership", () => {
    expect(migration).toContain(
      "JOIN game_player_states state ON state.game_id = a.game_id AND state.player_id = a.player_id\n      AND state.team_id = v_game.selected_team_id"
    );
    expect(migration).toContain(
      "JOIN game_player_states state ON state.game_id = c.game_id AND state.player_id = c.player_id\n      AND state.team_id = v_game.selected_team_id"
    );
  });
});
