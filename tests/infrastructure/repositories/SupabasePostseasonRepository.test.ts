import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  postseasonFixture,
  postseasonGameFixture,
  postseasonId,
} from "@/infrastructure/repositories/postseason.test-fixture";
import {
  postseasonStateSchema,
  SupabasePostseasonRepository,
} from "@/infrastructure/repositories/SupabasePostseasonRepository";

describe("postseason readonly repository", () => {
  it("calls only the owner read RPC with a validated career ID", async () => {
    const state = postseasonFixture();
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    const repo = new SupabasePostseasonRepository({ rpc } as unknown as SupabaseClient);
    await expect(repo.getState(postseasonId(100))).resolves.toEqual(state);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_postseason_state", {
      p_game_id: postseasonId(100),
    });
    await expect(repo.getState("invalid")).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects RPC errors rather than inventing a regular-season state", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "not authorized" } });
    await expect(
      new SupabasePostseasonRepository({ rpc } as unknown as SupabaseClient).getState(
        postseasonId(100)
      )
    ).rejects.toThrow("Failed to load postseason state");
  });

  it("validates nullable play-in and playoff game fields", () => {
    for (const game of [
      postseasonGameFixture(),
      postseasonGameFixture({ seriesId: null, gameNumber: null, stage: "seven_eight" }),
      postseasonGameFixture({
        status: "scheduled",
        homeScore: null,
        awayScore: null,
        winnerTeamId: null,
      }),
    ])
      expect(postseasonStateSchema.safeParse(postseasonFixture({ games: [game] })).success).toBe(
        true
      );
  });

  it.each([
    { phase: "offseason" },
    { championTeamId: "invalid" },
    { qualification: [{ teamId: postseasonId(1), conference: "Finals", seed: 1 }] },
    { qualification: [{ teamId: postseasonId(1), conference: "East", seed: 16 }] },
    { playoffSeeds: [{ teamId: postseasonId(1), conference: "West", seed: 9 }] },
    { games: [postseasonGameFixture({ gameDate: "2027-02-30" })] },
    { games: [postseasonGameFixture({ gameNumber: 8 })] },
    { games: [postseasonGameFixture({ homeScore: -1 })] },
    { games: [{ ...postseasonGameFixture(), status: "cancelled" }] },
    {
      series: [
        {
          id: postseasonId(101),
          round: 1,
          conference: "East",
          bracketSlot: 1,
          homeTeamId: postseasonId(1),
          awayTeamId: postseasonId(8),
          homeWins: 5,
          awayWins: 0,
          winnerTeamId: null,
        },
      ],
    },
  ])("rejects malformed contract data %j", (overrides) => {
    expect(postseasonStateSchema.safeParse({ ...postseasonFixture(), ...overrides }).success).toBe(
      false
    );
  });
});
