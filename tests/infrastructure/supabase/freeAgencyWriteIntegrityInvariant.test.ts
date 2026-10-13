import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../scripts/migrations/023_free_agency_write_integrity.sql", import.meta.url),
  "utf8"
);

function mirroredMigration(marker: string, endMarker: string): string {
  const start = schema.indexOf(marker);
  const end = schema.indexOf(endMarker, start + marker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return `${schema.slice(start + marker.length, end).trimEnd()}\n`;
}

describe("free agency direct-write guard migration", () => {
  it("mirrors migration 023 independently of the later trade migration", () => {
    expect(
      mirroredMigration(
        "-- Canonical schema mirror for migration 023. Keep byte-identical below.\n",
        "-- End canonical schema mirror for migration 023.\n"
      )
    ).toBe(migration);
    expect(migration).not.toContain("execute_trade_transactional");
  });

  it("uses invoker identity and has no caller-settable bypass", () => {
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("current_user NOT IN ('authenticated', 'anon')");
    expect(migration).toContain("current_user IN ('authenticated', 'anon')");
    expect(migration).not.toMatch(/current_setting\s*\(/iu);
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION guard_game_player_state_writes() FROM PUBLIC, anon, authenticated, service_role"
    );
  });

  it("guards authoritative fields while leaving low-risk state writable", () => {
    expect(migration).toContain("NEW.team_id, NEW.is_active");
    expect(migration).toContain("Direct roster insertion is not permitted");
    expect(migration).toContain("Direct roster deletion is not permitted");
    expect(migration).toContain("Legacy contract identity and salary are authoritative");
    expect(migration).toContain("Game ownership, identity, and simulation clock are authoritative");
    expect(migration).toContain("NEW.status = 'initializing' AND OLD.status <> 'initializing'");
    expect(migration).not.toContain("morale");
    expect(migration).not.toContain("fatigue");
    expect(migration).not.toContain("is_injured");
  });
});
