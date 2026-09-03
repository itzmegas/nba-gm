import type { GamePlayerContractState } from "@/domain/contracts/GameContract";

export interface GameContractRepository {
  getByTeam(gameId: string, teamId: string): Promise<readonly GamePlayerContractState[]>;
}
