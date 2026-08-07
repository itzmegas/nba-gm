import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

describe("contracts database invariants", () => {
  it("serializes one ownership contract per game and player", () => {
    expect(schema).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_game_player_unique\s+ON contracts\(game_id, player_id\)/
    );
  });
});
