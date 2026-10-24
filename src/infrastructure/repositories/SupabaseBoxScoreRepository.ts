import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  BOX_SCORE_SIDE,
  type GameBoxScore,
  POSSESSION_ENGINE_VERSION,
} from "@/domain/entities/GameBoxScore";
import type { BoxScoreRepository } from "@/domain/repositories/BoxScoreRepository";

const count = z.number().int().nonnegative();
const playerBoxScoreSchema = z.object({
  playerId: z.uuid(),
  playerName: z.string().min(1),
  side: z.enum(BOX_SCORE_SIDE),
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
});

export const gameBoxScoreSchema = z
  .object({
    engineVersion: z.literal(POSSESSION_ENGINE_VERSION),
    overtimes: count.max(20),
    homeScore: count,
    awayScore: count,
    players: z.array(playerBoxScoreSchema).min(10).max(30),
  })
  .refine((game) => {
    const elapsed = 2880 + game.overtimes * 300;
    if (game.homeScore === game.awayScore) return false;
    if (new Set(game.players.map((p) => p.playerId)).size !== game.players.length) return false;
    for (const p of game.players) {
      if (
        p.seconds > elapsed ||
        p.fieldGoalsMade > p.fieldGoalsAttempted ||
        p.threePointersMade > p.threePointersAttempted ||
        p.threePointersMade > p.fieldGoalsMade ||
        p.threePointersAttempted > p.fieldGoalsAttempted ||
        p.fieldGoalsMade - p.threePointersMade > p.fieldGoalsAttempted - p.threePointersAttempted ||
        p.freeThrowsMade > p.freeThrowsAttempted ||
        p.points !== 2 * p.fieldGoalsMade + p.threePointersMade + p.freeThrowsMade
      )
        return false;
    }
    return Object.values(BOX_SCORE_SIDE).every((side) => {
      const players = game.players.filter((p) => p.side === side);
      return (
        players.length >= 5 &&
        players.length <= 15 &&
        players.reduce((sum, p) => sum + p.seconds, 0) === elapsed * 5 &&
        players.reduce((sum, p) => sum + p.points, 0) ===
          (side === BOX_SCORE_SIDE.HOME ? game.homeScore : game.awayScore) &&
        players.reduce((sum, p) => sum + p.assists, 0) <=
          players.reduce((sum, p) => sum + p.fieldGoalsMade, 0)
      );
    });
  }, "Inconsistent box score");

export class SupabaseBoxScoreRepository implements BoxScoreRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getForFixture(gameId: string, fixtureId: string): Promise<GameBoxScore | null> {
    const { data, error } = await this.client
      .from("game_box_scores")
      .select("payload")
      .eq("game_id", z.uuid().parse(gameId))
      .eq("scheduled_game_id", z.uuid().parse(fixtureId))
      .maybeSingle();
    if (error) throw new Error("Failed to load box score");
    return data ? gameBoxScoreSchema.parse(data.payload) : null;
  }
}
