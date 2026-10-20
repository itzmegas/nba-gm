import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("mirrors the standard roster slot migration without changing existing payroll rules", () => {
  const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../scripts/migrations/034_standard_roster_slots.sql", import.meta.url),
    "utf8"
  );
  const marker = "-- Canonical schema mirror for migration 034. Keep byte-identical below.\n";
  const endMarker = "-- End canonical schema mirror for migration 034.\n";
  expect(schema.split(marker)).toHaveLength(2);
  expect(schema.split(marker)[1].split(endMarker)[0]).toBe(migration);
  const previous = readFileSync(
    new URL("../../../scripts/migrations/027_free_agency_team_finances.sql", import.meta.url),
    "utf8"
  );
  const payroll = (sql: string) =>
    sql.slice(
      sql.indexOf("  IF EXISTS ("),
      sql.indexOf("  SELECT count(*)::INTEGER INTO roster_count")
    );
  expect(payroll(migration)).toBe(payroll(previous));
});
