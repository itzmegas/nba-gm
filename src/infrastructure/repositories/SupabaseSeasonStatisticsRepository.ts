import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SeasonStatistics } from "@/domain/entities/PlayerSeasonStatistics";
import type { SeasonStatisticsRepository } from "@/domain/repositories/SeasonStatisticsRepository";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const seasonStatisticsSchema = z
  .object({
    completedGames: count,
    coveredGames: count,
    players: z.array(
      z.object({
        playerId: z.uuid(),
        playerName: z.string().min(1),
        gamesPlayed: count.min(1),
        totals: z.object({
          seconds: count,
          fieldGoalsMade: count,
          fieldGoalsAttempted: count,
          threePointersMade: count,
          threePointersAttempted: count,
          freeThrowsMade: count,
          freeThrowsAttempted: count,
          offensiveRebounds: count,
          defensiveRebounds: count,
          assists: count,
          steals: count,
          blocks: count,
          turnovers: count,
          personalFouls: count,
          points: count,
        }),
      })
    ),
  })
  .refine(
    (s) =>
      s.coveredGames <= s.completedGames &&
      new Set(s.players.map((p) => p.playerId)).size === s.players.length &&
      s.players.every((p) => p.gamesPlayed <= s.coveredGames),
    "Inconsistent season statistics"
  );

export class SupabaseSeasonStatisticsRepository implements SeasonStatisticsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getRegularSeason(gameId: string, seasonYear: number): Promise<SeasonStatistics> {
    const { data, error } = await this.client.rpc("get_player_season_statistics", {
      p_game_id: z.uuid().parse(gameId),
      p_season_year: z.number().int().min(1900).max(3000).parse(seasonYear),
      p_phase: "regular_season",
    });
    if (error) throw new Error("Failed to load season statistics");
    return seasonStatisticsSchema.parse(data);
  }
}
