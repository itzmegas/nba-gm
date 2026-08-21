import type { Player } from "../entities/Player";

export interface PlayerRepository {
  getAll(): Promise<Player[]>;
  getById(id: string): Promise<Player | null>;
  getByTeamId(teamId: string): Promise<Player[]>;
  getByNbaId(nbaId: number): Promise<Player | null>;
  getActivePlayers(): Promise<Player[]>;
}
