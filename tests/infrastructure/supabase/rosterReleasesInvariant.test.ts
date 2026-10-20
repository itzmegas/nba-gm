import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it.each([
  "035_roster_releases",
  "036_roster_release_salary_coverage",
])("keeps %s byte-identical in the canonical schema", (name) => {
  const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL(`../../../scripts/migrations/${name}.sql`, import.meta.url),
    "utf8"
  );
  const version = name.slice(0, 3);
  const marker = `-- Canonical schema mirror for migration ${version}. Keep byte-identical below.\n`;
  const endMarker = `-- End canonical schema mirror for migration ${version}.\n`;
  expect(schema.split(marker)).toHaveLength(2);
  expect(schema.split(marker)[1].split(endMarker)[0]).toBe(migration);
});
