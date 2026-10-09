import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../scripts/migrations/021_game_runtime_contracts.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

function mirroredSection(source: string): string {
  const marker = "-- Canonical schema mirror for migration 021. Keep byte-identical below.\n";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const contentStart = start + marker.length;
  const end = source.indexOf("-- End canonical schema mirror for migration 021.\n", contentStart);
  expect(end).toBeGreaterThan(contentStart);
  return `${source.slice(contentStart, end).trimEnd()}\n`;
}

describe("game runtime contract database invariants", () => {
  it("mirrors the read-only runtime overlay migration", () => {
    expect(mirroredSection(schema)).toBe(migration);
  });

  it("keeps simulated origin explicit and contracts scoped to one game and player", () => {
    expect(migration).toContain(
      "origin_kind TEXT NOT NULL CHECK (origin_kind = 'simulated-agreement')"
    );
    expect(migration).toContain("UNIQUE (game_id, player_id)");
    expect(migration).toContain("REFERENCES games(id) ON DELETE CASCADE");
    expect(migration).toContain("REFERENCES players(id) ON DELETE RESTRICT");
  });

  it("grants owners read-only access without adding a signing writer", () => {
    expect(migration).toContain("ALTER TABLE game_runtime_contracts ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FOR SELECT TO authenticated");
    expect(migration).toContain("g.user_id = auth.uid()");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE game_runtime_contracts FROM PUBLIC, anon, authenticated"
    );
    expect(migration).toContain("GRANT SELECT ON TABLE game_runtime_contracts TO authenticated");
    expect(migration).toContain("REVOKE ALL ON TABLE game_runtime_contracts FROM service_role");
    expect(migration).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\b/i);
    expect(migration).not.toMatch(/CREATE\s+(?:OR REPLACE\s+)?FUNCTION\b/i);
  });
});
