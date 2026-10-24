import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { boxScoreFixture } from "@/infrastructure/repositories/boxScore.test-fixture";
import {
  gameBoxScoreSchema,
  SupabaseBoxScoreRepository,
} from "@/infrastructure/repositories/SupabaseBoxScoreRepository";

const gameId = "10000000-0000-4000-8000-000000000001";
const fixtureId = "20000000-0000-4000-8000-000000000001";

function mockClient(data: unknown, error: unknown = null) {
  const filters: Array<[string, string]> = [];
  const query = {
    select: () => query,
    eq: (key: string, value: string) => {
      filters.push([key, value]);
      return query;
    },
    maybeSingle: async () => ({ data, error }),
  };
  return { client: { from: () => query } as unknown as SupabaseClient, filters };
}

describe("SupabaseBoxScoreRepository", () => {
  it("reads persisted statistics scoped to career and fixture", async () => {
    const saved = boxScoreFixture();
    const mock = mockClient({ payload: saved });
    await expect(
      new SupabaseBoxScoreRepository(mock.client).getForFixture(gameId, fixtureId)
    ).resolves.toEqual(saved);
    expect(mock.filters).toEqual([
      ["game_id", gameId],
      ["scheduled_game_id", fixtureId],
    ]);
  });

  it("distinguishes an old result without statistics from a failed query", async () => {
    await expect(
      new SupabaseBoxScoreRepository(mockClient(null).client).getForFixture(gameId, fixtureId)
    ).resolves.toBeNull();
    await expect(
      new SupabaseBoxScoreRepository(
        mockClient(null, { message: "database failure" }).client
      ).getForFixture(gameId, fixtureId)
    ).rejects.toThrow("Failed to load box score");
  });

  it.each([
    "points",
    "seconds",
    "fieldGoalsMade",
    "threePointersMade",
    "freeThrowsMade",
  ] as const)("rejects inconsistent %s instead of displaying corrupt statistics", (key) => {
    const saved = boxScoreFixture();
    saved.players[0][key] = 9999;
    expect(gameBoxScoreSchema.safeParse(saved).success).toBe(false);
  });

  it("validates overtime minutes, identities, totals and boundary values", () => {
    const saved = boxScoreFixture();
    saved.overtimes = 1;
    expect(gameBoxScoreSchema.safeParse(saved).success).toBe(false);
    for (const p of saved.players) p.seconds += 300;
    expect(gameBoxScoreSchema.safeParse(saved).success).toBe(true);
    saved.players[1].playerId = saved.players[0].playerId;
    expect(gameBoxScoreSchema.safeParse(saved).success).toBe(false);
    expect(gameBoxScoreSchema.safeParse({ ...boxScoreFixture(), homeScore: 8 }).success).toBe(
      false
    );
    expect(gameBoxScoreSchema.safeParse({ ...boxScoreFixture(), homeScore: null }).success).toBe(
      false
    );
  });
});
