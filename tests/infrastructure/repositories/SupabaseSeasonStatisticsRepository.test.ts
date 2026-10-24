import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { SeasonStatisticsPhase } from "@/domain/entities/PlayerSeasonStatistics";
import {
  SupabaseSeasonStatisticsRepository,
  seasonStatisticsSchema,
} from "@/infrastructure/repositories/SupabaseSeasonStatisticsRepository";

describe("season statistics repository", () => {
  it("uses explicit career, season and regular-season parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { completedGames: 1, coveredGames: 0, players: [] },
      error: null,
    });
    const repo = new SupabaseSeasonStatisticsRepository({ rpc } as unknown as SupabaseClient);
    await expect(
      repo.getByPhase("a0000000-0000-4000-8000-000000000001", 2026)
    ).resolves.toMatchObject({ coveredGames: 0 });
    expect(rpc).toHaveBeenCalledWith("get_player_season_statistics", {
      p_game_id: "a0000000-0000-4000-8000-000000000001",
      p_season_year: 2026,
      p_phase: "regular_season",
    });
  });
  it.each([
    "regular_season",
    "play_in",
    "playoffs",
  ] as const)("passes the selected %s phase to the RPC", async (phase) => {
    const rpc = vi.fn().mockResolvedValue({
      data: { completedGames: 0, coveredGames: 0, players: [] },
      error: null,
    });
    const repo = new SupabaseSeasonStatisticsRepository({ rpc } as unknown as SupabaseClient);
    await repo.getByPhase("a0000000-0000-4000-8000-000000000001", 2026, phase);
    expect(rpc).toHaveBeenCalledWith("get_player_season_statistics", {
      p_game_id: "a0000000-0000-4000-8000-000000000001",
      p_season_year: 2026,
      p_phase: phase,
    });
  });
  it("rejects invalid phases before calling the database", async () => {
    const rpc = vi.fn();
    const repo = new SupabaseSeasonStatisticsRepository({ rpc } as unknown as SupabaseClient);
    await expect(
      repo.getByPhase(
        "a0000000-0000-4000-8000-000000000001",
        2026,
        "finals" as SeasonStatisticsPhase
      )
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects impossible coverage", () => {
    expect(
      seasonStatisticsSchema.safeParse({ completedGames: 0, coveredGames: 1, players: [] }).success
    ).toBe(false);
  });
  it("surfaces database errors instead of reporting empty stats", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "missing migration" } });
    await expect(
      new SupabaseSeasonStatisticsRepository({ rpc } as unknown as SupabaseClient).getByPhase(
        "a0000000-0000-4000-8000-000000000001",
        2026
      )
    ).rejects.toThrow("Failed to load");
  });
});
