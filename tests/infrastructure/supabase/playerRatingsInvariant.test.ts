import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

describe("player attribute schema mirrors", () => {
  it.each([
    "037_player_rating_source_cache",
    "038_game_player_attributes",
    "039_materialize_game_player_attributes",
    "040_initialize_attributes_before_activation",
    "041_rollback_game_attributes",
    "042_player_attribute_simulation_strength",
  ])("keeps %s byte-identical exactly once", (name) => {
    const number = name.slice(0, 3);
    const migration = readFileSync(
      new URL(`../../../scripts/migrations/${name}.sql`, import.meta.url),
      "utf8"
    );
    const startMarker = `-- Canonical schema mirror for migration ${number}. Keep byte-identical below.\n`;
    const endMarker = `-- End canonical schema mirror for migration ${number}.\n`;
    const start = schema.indexOf(startMarker);
    const end = schema.indexOf(endMarker, start + startMarker.length);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(schema.indexOf(startMarker, start + startMarker.length)).toBe(-1);
    expect(`${schema.slice(start + startMarker.length, end).trimEnd()}\n`).toBe(migration);
  });
});
