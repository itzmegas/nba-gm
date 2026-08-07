import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

describe("contracts database invariants", () => {
  it("serializes one ownership contract per game and player", () => {
    expect(schema).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_game_player_unique\s+ON contracts\(game_id, player_id\)/
    );
  });

  it("creates an immutable game snapshot only during initialization", () => {
    const seedFunction = schema.match(
      /CREATE OR REPLACE FUNCTION seed_game_data[\s\S]*?REVOKE ALL ON FUNCTION seed_game_data/
    )?.[0];

    expect(seedFunction).toContain("g.status = 'initializing'");
    expect(seedFunction?.match(/ON CONFLICT \(game_id, player_id\) DO NOTHING/g)).toHaveLength(4);
    expect(seedFunction).not.toContain("DO UPDATE");
    expect(seedFunction).toContain("v_contract_count <> v_roster_count");
  });

  it("supports draft inventory for every configured historical era", () => {
    expect(schema).toContain(
      "ADD CONSTRAINT draft_picks_draft_year_check CHECK (draft_year >= 1947)"
    );
    expect(schema.indexOf("DROP CONSTRAINT IF EXISTS draft_picks_draft_year_check")).toBeLessThan(
      schema.indexOf("INSERT INTO draft_picks")
    );
  });
});
