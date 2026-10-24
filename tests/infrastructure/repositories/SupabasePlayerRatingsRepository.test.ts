import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { SupabasePlayerRatingsRepository } from "@/infrastructure/repositories/SupabasePlayerRatingsRepository";

const gameId = "11111111-1111-4111-8111-111111111111";
const playerId = "22222222-2222-4222-8222-222222222222";
const attributes = {
  closeShot: 80,
  midRangeShot: 81,
  threePointShot: 99,
  freeThrow: 90,
  drawFoul: 70,
  ballHandle: 92,
  passAccuracy: 88,
  interiorDefense: 40,
  perimeterDefense: 75,
  steal: 65,
  block: 0,
  offensiveRebound: 35,
  defensiveRebound: 60,
  stamina: 95,
};

function repository(data: unknown = [], error: { message: string } | null = null) {
  const inPlayers = vi.fn().mockResolvedValue({ data, error });
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: inPlayers };
  const from = vi.fn(() => query);
  const repo = new SupabasePlayerRatingsRepository({ from } as unknown as SupabaseClient);
  return { repo, query, from };
}

it.each([
  "nba2kapi",
  "estimated",
])("reads %s ratings scoped to game, season and roster", async (origin) => {
  const overall = origin === "estimated" ? null : 94;
  const { repo, query, from } = repository([
    { player_id: playerId, origin, attributes, source_overall: overall },
  ]);
  const result = await repo.getByPlayers(gameId, 2026, [playerId]);
  expect(from).toHaveBeenCalledWith("game_player_attributes");
  expect(query.eq.mock.calls).toEqual([
    ["game_id", gameId],
    ["season_year", 2026],
  ]);
  expect(query.in).toHaveBeenCalledWith("player_id", [playerId]);
  expect(query.select).toHaveBeenCalledWith("player_id, origin, attributes, source_overall");
  expect(result.get(playerId)).toEqual({ attributes, estimated: origin === "estimated", overall });
});

it("does not query an empty roster and leaves absent ratings missing", async () => {
  const { repo, from } = repository();
  expect(await repo.getByPlayers(gameId, 2026, [])).toEqual(new Map());
  expect(from).not.toHaveBeenCalled();
  expect(await repo.getByPlayers(gameId, 2026, [playerId])).toEqual(new Map());
});

it("propagates read errors", async () => {
  const { repo } = repository(null, { message: "Access failed" });
  await expect(repo.getByPlayers(gameId, 2026, [playerId])).rejects.toThrow("Access failed");
});

it.each([
  {},
  { ...attributes, block: 100 },
  { ...attributes, block: -1 },
])("rejects invalid attributes", async (invalid) => {
  const { repo } = repository([
    { player_id: playerId, origin: "nba2kapi", attributes: invalid, source_overall: 94 },
  ]);
  await expect(repo.getByPlayers(gameId, 2026, [playerId])).rejects.toThrow();
});

it.each([-1, 100, 90.5])("rejects invalid overall %s", async (overall) => {
  const { repo } = repository([
    { player_id: playerId, origin: "nba2kapi", attributes, source_overall: overall },
  ]);
  await expect(repo.getByPlayers(gameId, 2026, [playerId])).rejects.toThrow();
});
