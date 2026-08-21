import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const rosterMigration = readFileSync(
  new URL("../../../scripts/migrations/011_current_roster_refresh.sql", import.meta.url),
  "utf8"
);

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

  it("persists and backfills the durable game season era", () => {
    expect(schema).toContain("season_era_id TEXT NOT NULL DEFAULT 'modern'");
    expect(rosterMigration).toContain("UPDATE games");
    expect(rosterMigration).toContain("WHEN 2010 THEN 'lebron'");
    expect(rosterMigration).toContain("WHEN 1995 THEN 'jordan'");
    expect(rosterMigration).toContain("ELSE 'modern'");
  });

  it("defines service-role-only roster refresh promotion", () => {
    for (const source of [schema, rosterMigration]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS roster_refresh_staging");
      expect(source).toContain("CREATE TABLE IF NOT EXISTS roster_refresh_runs");
      expect(source).toContain("CREATE OR REPLACE FUNCTION promote_current_roster");
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("ALTER TABLE roster_refresh_staging ENABLE ROW LEVEL SECURITY");
      expect(source).toContain(
        "REVOKE ALL ON TABLE roster_refresh_staging FROM PUBLIC, anon, authenticated"
      );
    }
  });
});
