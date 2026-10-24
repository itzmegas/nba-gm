import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PlayerRatings } from "@/domain/entities/PlayerAttributes";
import type { PlayerRatingsRepository } from "@/domain/repositories/PlayerRatingsRepository";
import { playerAttributesSchema } from "@/infrastructure/ratings/playerAttributesSchema";

const ratingsRowSchema = z.object({
  player_id: z.uuid(),
  origin: z.enum(["nba2kapi", "estimated"]),
  attributes: playerAttributesSchema,
  source_overall: z.number().int().min(0).max(99).nullable(),
});

export class SupabasePlayerRatingsRepository implements PlayerRatingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByPlayers(
    gameId: string,
    seasonYear: number,
    playerIds: readonly string[]
  ): Promise<Map<string, PlayerRatings>> {
    if (playerIds.length === 0) return new Map();
    const { data, error } = await this.client
      .from("game_player_attributes")
      .select("player_id, origin, attributes, source_overall")
      .eq("game_id", z.uuid().parse(gameId))
      .eq("season_year", z.number().int().parse(seasonYear))
      .in("player_id", z.array(z.uuid()).parse(playerIds));
    if (error) throw new Error(error.message);
    return new Map(
      z
        .array(ratingsRowSchema)
        .parse(data ?? [])
        .map((row) => [
          row.player_id,
          {
            attributes: row.attributes,
            estimated: row.origin === "estimated",
            overall: row.source_overall,
          },
        ])
    );
  }
}
