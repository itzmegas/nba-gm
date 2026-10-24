import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each([
  "044_possession_engine",
  "045_game_box_scores",
  "046_daily_possession_simulation",
  "047_possession_rotation_calibration",
])("keeps %s in the canonical schema", (name) => {
  const version = name.slice(0, 3);
  const migration = readFileSync(`scripts/migrations/${name}.sql`, "utf8");
  const schema = readFileSync("scripts/schema.sql", "utf8");
  const marker = `-- Canonical schema mirror for migration ${version}. Keep byte-identical below.\n`;
  const end = `-- End canonical schema mirror for migration ${version}.`;
  expect(schema.split(marker)).toHaveLength(2);
  expect(schema.split(marker)[1].split(end)[0]).toBe(migration);
});
