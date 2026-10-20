import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../scripts/migrations/032_roster_simulation_strength.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

describe("roster simulation strength migration", () => {
  it("is mirrored exactly once in the canonical schema", () => {
    const startMarker =
      "-- Canonical schema mirror for migration 032. Keep byte-identical below.\n";
    const endMarker = "-- End canonical schema mirror for migration 032.\n";
    const start = schema.indexOf(startMarker);
    const end = schema.indexOf(endMarker, start + startMarker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(schema.indexOf(startMarker, start + startMarker.length)).toBe(-1);
    expect(`${schema.slice(start + startMarker.length, end).trimEnd()}\n`).toBe(migration);
  });

  it("keeps rating calculation private and feeds it into both existing score reads", () => {
    expect(migration).toContain("SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).toContain("base + 2 * (LEAST(available, 15) - 12)");
    expect(migration).toContain(
      "public.get_simulation_team_rating(p_game_id, v_match.home_team_id)"
    );
    expect(migration).toContain(
      "public.get_simulation_team_rating(p_game_id, v_match.away_team_id)"
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role;");
  });
});
