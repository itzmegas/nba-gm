import type { PlayerState } from "@/domain/entities";
import type { ReleasePlayerInput } from "@/domain/roster/ReleasePlayer";

export interface PlayerStateRepository {
  release(input: ReleasePlayerInput): Promise<string>;
  getReleaseCapCharge(gameId: string, teamId: string, seasonYear: number): Promise<number>;
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
