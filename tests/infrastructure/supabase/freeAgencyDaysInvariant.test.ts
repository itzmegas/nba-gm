import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const migrations = ["027_free_agency_team_finances.sql"] as const;
describe("free-agency daily market schema", () => {
  for (const name of migrations) {
    it(`mirrors ${name} exactly once`, () => {
      const id = name.slice(0, 3);
      const marker = `-- Canonical schema mirror for migration ${id}. Keep byte-identical below.\n`;
      const endMarker = `-- End canonical schema mirror for migration ${id}.\n`;
      const start = schema.indexOf(marker);
      const end = schema.indexOf(endMarker, start + marker.length);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      expect(schema.indexOf(marker, start + marker.length)).toBe(-1);
      expect(schema.indexOf(endMarker, end + endMarker.length)).toBe(-1);
      expect(`${schema.slice(start + marker.length, end).trimEnd()}\n`).toBe(
        readFileSync(new URL(`../../../scripts/migrations/${name}`, import.meta.url), "utf8")
      );
    });
  }
});
