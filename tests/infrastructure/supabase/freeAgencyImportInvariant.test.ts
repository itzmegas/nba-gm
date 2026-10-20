import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps migration 033 and the canonical schema byte-identical", () => {
  const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../scripts/migrations/033_initial_free_agent_import.sql", import.meta.url),
    "utf8"
  );
  const marker = "-- Canonical schema mirror for migration 033. Keep byte-identical below.\n";
  const endMarker = "-- End canonical schema mirror for migration 033.\n";
  const start = schema.indexOf(marker);
  const end = schema.indexOf(endMarker, start + marker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(migration);
});
