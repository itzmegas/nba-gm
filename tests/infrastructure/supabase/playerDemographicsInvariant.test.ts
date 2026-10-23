import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("mirrors migration 043 and preserves existing demographics when the provider omits them", () => {
  const migration = readFileSync("scripts/migrations/043_player_demographics.sql", "utf8");
  const schema = readFileSync("scripts/schema.sql", "utf8");
  const marker = "-- Canonical schema mirror for migration 043. Keep byte-identical below.\n";
  expect(schema.split(marker)).toHaveLength(2);
  expect(
    schema.split(marker)[1].split("-- End canonical schema mirror for migration 043.")[0]
  ).toBe(migration);
  expect(migration).toContain("age = COALESCE(NULLIF(s.payload->>'age', '')::SMALLINT, p.age)");
  expect(migration).toContain(
    "birth_date = COALESCE(NULLIF(s.payload->>'birth_date', '')::DATE, p.birth_date)"
  );
  expect(migration).toContain("FROM PUBLIC, anon, authenticated");
});
