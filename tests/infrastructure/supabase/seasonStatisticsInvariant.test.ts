import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the canonical season-statistics schema identical to migration 048", () => {
  const migration = readFileSync("scripts/migrations/048_player_season_statistics.sql", "utf8");
  const schema = readFileSync("scripts/schema.sql", "utf8");
  const mirror = schema
    .split("-- Canonical schema mirror for migration 048.")[1]
    .split("-- End canonical schema mirror for migration 048.")[0];
  const normalize = (sql: string) =>
    sql
      .replace(/--[^\n]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  expect(normalize(mirror)).toBe(normalize(migration));
});
