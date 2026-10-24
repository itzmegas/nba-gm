import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("postseason qualification schema", () => {
  it.each([
    ["049", "postseason_qualification"],
    ["050", "play_in_tournament"],
    ["051", "missing_team_conferences"],
  ])("keeps the canonical schema identical to migration %s", (number, name) => {
    const migration = readFileSync(`scripts/migrations/${number}_${name}.sql`, "utf8");
    const schema = readFileSync("scripts/schema.sql", "utf8");
    const mirror = schema
      .split(`-- Canonical schema mirror for migration ${number}.\n`)[1]
      ?.split(`-- End canonical schema mirror for migration ${number}.`)[0];
    expect(mirror?.trim()).toBe(migration.trim());
  });
});
