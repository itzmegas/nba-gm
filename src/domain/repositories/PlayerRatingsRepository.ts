import type { PlayerRatings } from "@/domain/entities/PlayerAttributes";

export interface PlayerRatingsRepository {
  getByPlayers(
    gameId: string,
    seasonYear: number,
    playerIds: readonly string[]
  ): Promise<Map<string, PlayerRatings>>;
}
