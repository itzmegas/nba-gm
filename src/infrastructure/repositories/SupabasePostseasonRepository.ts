import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  PLAY_IN_STAGE,
  POSTSEASON_CONFERENCE,
  POSTSEASON_PHASE,
  type PostseasonState,
} from "@/domain/entities/Postseason";
import type { PostseasonRepository } from "@/domain/repositories/PostseasonRepository";

const conference = z.enum(POSTSEASON_CONFERENCE);
const seed = z.object({
  teamId: z.uuid(),
  conference: z.enum(["East", "West"]),
  seed: z.number().int().min(1).max(15),
});
export const postseasonStateSchema = z.object({
  phase: z.enum(POSTSEASON_PHASE),
  championTeamId: z.uuid().nullable(),
  runnerUpTeamId: z.uuid().nullable(),
  qualification: z.array(seed),
  playoffSeeds: z.array(seed.extend({ seed: z.number().int().min(1).max(8) })),
  series: z.array(
    z.object({
      id: z.uuid(),
      round: z.number().int().min(1).max(4),
      conference,
      bracketSlot: z.number().int().min(1).max(4),
      homeTeamId: z.uuid(),
      awayTeamId: z.uuid(),
      homeWins: z.number().int().min(0).max(4),
      awayWins: z.number().int().min(0).max(4),
      winnerTeamId: z.uuid().nullable(),
    })
  ),
  games: z.array(
    z.object({
      id: z.uuid(),
      seriesId: z.uuid().nullable(),
      stage: z.enum(PLAY_IN_STAGE).nullable(),
      conference,
      gameNumber: z.number().int().min(1).max(7).nullable(),
      gameDate: z.iso.date(),
      homeTeamId: z.uuid(),
      awayTeamId: z.uuid(),
      homeScore: z.number().int().nonnegative().nullable(),
      awayScore: z.number().int().nonnegative().nullable(),
      winnerTeamId: z.uuid().nullable(),
      status: z.enum(["scheduled", "completed"]),
    })
  ),
});

export class SupabasePostseasonRepository implements PostseasonRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getState(gameId: string): Promise<PostseasonState> {
    const { data, error } = await this.client.rpc("get_postseason_state", {
      p_game_id: z.uuid().parse(gameId),
    });
    if (error) throw new Error("Failed to load postseason state");
    return postseasonStateSchema.parse(data);
  }
}
