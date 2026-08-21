import type { PlayerState } from "@/domain/entities";

export interface PlayerStateRepository {
  getByGameId(gameId: string): Promise<PlayerState[]>;
  getByGameAndTeam(gameId: string, teamId: string): Promise<PlayerState[]>;
  getByGameAndPlayer(gameId: string, playerId: string): Promise<PlayerState | null>;
  bulkCreateForGame(
    gameId: string,
    playerStates: Omit<PlayerState, "id" | "gameId" | "createdAt" | "updatedAt">[]
  ): Promise<PlayerState[]>;
  updateByGameAndPlayer(
    gameId: string,
    playerId: string,
    playerState: Partial<PlayerState>
  ): Promise<PlayerState>;
}
