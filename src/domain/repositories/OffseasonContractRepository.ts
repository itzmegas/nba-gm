import type { OffseasonContract, OffseasonDecision } from "@/domain/entities/OffseasonContract";

export interface OffseasonContractRepository {
  get(gameId: string, seasonYear: number): Promise<OffseasonContract[]>;
  prepare(gameId: string, seasonYear: number): Promise<OffseasonContract[]>;
  decide(
    gameId: string,
    seasonYear: number,
    playerId: string,
    decision: OffseasonDecision
  ): Promise<OffseasonContract>;
}
