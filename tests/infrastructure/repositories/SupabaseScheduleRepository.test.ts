import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseScheduleRepository } from "@/infrastructure/repositories/SupabaseScheduleRepository";

function createClient(
  data: unknown,
  resolveData: (filters: Array<[string, unknown]>) => unknown = () => data,
  error: { message: string } | null = null
) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    or: (value: string) => {
      filters.push(["or", value]);
      return query;
    },
    gt: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve({ data: resolveData(filters), error }),
    // biome-ignore lint/suspicious/noThenProperty: test double for Supabase's awaitable query builder.
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null })),
  };

  return { client: { from: () => query } as unknown as SupabaseClient, filters };
}

describe("SupabaseScheduleRepository", () => {
  it("filters the selected team game by exact date and returns null when there is none", async () => {
    const mock = createClient(null);
    const repository = new SupabaseScheduleRepository(mock.client);

    await expect(
      repository.getForTeamOnDate("game", "team", new Date("2026-10-15T23:00:00-03:00"))
    ).resolves.toBeNull();
    expect(mock.filters).toEqual([
      ["game_id", "game"],
      ["game_date", "2026-10-16"],
      ["or", "home_team_id.eq.team,away_team_id.eq.team"],
    ]);
  });

  it("preserves exact-date query errors", async () => {
    const mock = createClient(null, undefined, { message: "query failed" });
    const repository = new SupabaseScheduleRepository(mock.client);

    await expect(
      repository.getForTeamOnDate("game", "team", new Date("2026-10-15T00:00:00Z"))
    ).rejects.toThrow("query failed");
  });

  it("maps the next scheduled game from snake case", async () => {
    const mock = createClient({
      id: "11111111-1111-4111-8111-111111111111",
      game_id: "22222222-2222-4222-8222-222222222222",
      game_date: "2026-10-15",
      home_team_id: "33333333-3333-4333-8333-333333333333",
      away_team_id: "44444444-4444-4444-8444-444444444444",
      status: "scheduled",
    });
    const repository = new SupabaseScheduleRepository(mock.client);

    await expect(
      repository.getNextForTeam("game", "team", new Date("2026-10-14T00:00:00Z"))
    ).resolves.toMatchObject({
      gameId: "22222222-2222-4222-8222-222222222222",
      homeTeamId: "33333333-3333-4333-8333-333333333333",
    });
    expect(mock.filters).toContainEqual(["game_date", "2026-10-14"]);
  });

  it("selects only a future game after the simulation date", async () => {
    const games = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        game_id: "22222222-2222-4222-8222-222222222222",
        game_date: "2026-10-14",
        home_team_id: "33333333-3333-4333-8333-333333333333",
        away_team_id: "44444444-4444-4444-8444-444444444444",
        status: "scheduled",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        game_id: "66666666-6666-4666-8666-666666666666",
        game_date: "2026-10-15",
        home_team_id: "33333333-3333-4333-8333-333333333333",
        away_team_id: "77777777-7777-4777-8777-777777777777",
        status: "scheduled",
      },
    ];
    const mock = createClient(games, (filters) =>
      games.find((game) =>
        filters.every(([column, value]) => column !== "game_date" || game.game_date > String(value))
      )
    );
    const repository = new SupabaseScheduleRepository(mock.client);

    await expect(
      repository.getNextForTeam("game", "team", new Date("2026-10-14T00:00:00Z"))
    ).resolves.toMatchObject({
      gameId: "66666666-6666-4666-8666-666666666666",
      date: "2026-10-15",
    });
    expect(mock.filters).toContainEqual(["game_date", "2026-10-14"]);
  });

  it("keeps the migration row variables distinct", async () => {
    const sql = await readFile(
      new URL("../../../scripts/migrations/009_season_simulation.sql", import.meta.url),
      "utf8"
    );

    expect(sql).toMatch(
      /v_game games%ROWTYPE;[\s\S]*v_match scheduled_games%ROWTYPE;[\s\S]*FOR v_match IN/
    );
    expect(sql).not.toContain("v_game scheduled_games%ROWTYPE;");
    expect(sql).toContain("wins = league_standings.wins");
    expect(sql).toContain("losses = league_standings.losses");
  });

  it("guards dates and uses round-robin scheduling in both RPC definitions", async () => {
    const migration = await readFile(
      new URL("../../../scripts/migrations/009_season_simulation.sql", import.meta.url),
      "utf8"
    );
    const schema = await readFile(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("advance_simulation_day(p_game_id UUID, p_expected_date DATE)");
      expect(sql).toMatch(
        /FOR UPDATE;[\s\S]*simulation_date IS DISTINCT FROM p_expected_date[\s\S]*new_date := v_game\.simulation_date[\s\S]*RETURN NEXT;[\s\S]*RETURN;[\s\S]*v_new_date :=/
      );
      expect(sql).toContain("DROP FUNCTION IF EXISTS advance_simulation_day(UUID);");
      expect(sql).toContain("advance_simulation_day(UUID, DATE)");
      expect(sql).not.toMatch(/row_number\(\)[\s\S]*% 183/);
      expect(sql).toContain("generate_series(0, 28)");
      expect(sql).toContain("generate_series(1, 14)");
      expect(sql).toContain("((c * 29 + r) * 182 / 57)");
      expect(sql).toContain("home.slot = CASE WHEN c = 0 THEN home_slot ELSE away_slot END");
      expect(sql).toMatch(/,\s*home\.id,\s*away\.id\s+FROM rounds/);
    }

    const firstCycle: Array<[number, number]> = [];
    for (let round = 0; round < 29; round += 1) {
      firstCycle.push([0, 1 + (round % 29)]);
      for (let pair = 1; pair <= 14; pair += 1) {
        firstCycle.push([1 + ((round + pair) % 29), 1 + ((round - pair + 29) % 29)]);
      }
    }
    const secondCycle = firstCycle.map(([home, away]) => [away, home] as [number, number]);
    const directedPairs = [...firstCycle, ...secondCycle].map(([home, away]) => `${home}:${away}`);

    expect(directedPairs).toHaveLength(870);
    expect(new Set(directedPairs)).toHaveLength(870);
    expect(secondCycle).toEqual(firstCycle.map(([home, away]) => [away, home]));
  });
});
