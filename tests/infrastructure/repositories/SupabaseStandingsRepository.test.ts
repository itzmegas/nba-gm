import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseStandingsRepository } from "@/infrastructure/repositories/SupabaseStandingsRepository";

function createClient(data: unknown) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    // biome-ignore lint/suspicious/noThenProperty: test double for Supabase's awaitable query builder.
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: data as unknown[], error: null })),
  };

  return { from: () => query } as unknown as SupabaseClient;
}

describe("SupabaseStandingsRepository", () => {
  it("maps standings from snake case", async () => {
    const repository = new SupabaseStandingsRepository(
      createClient([
        {
          game_id: "22222222-2222-4222-8222-222222222222",
          team_id: "33333333-3333-4333-8333-333333333333",
          wins: 4,
          losses: 1,
        },
      ])
    );

    await expect(repository.getByGameId("game")).resolves.toEqual([
      {
        gameId: "22222222-2222-4222-8222-222222222222",
        teamId: "33333333-3333-4333-8333-333333333333",
        wins: 4,
        losses: 1,
      },
    ]);
  });
});
