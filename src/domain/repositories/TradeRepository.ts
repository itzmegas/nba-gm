import type { ExecutedTrade, TradePackage } from "@/domain/entities";

export interface TradeRepository {
  getHistory(gameId: string): Promise<ExecutedTrade[]>;
  execute(
    gameId: string,
    teamAId: string,
    teamBId: string,
    packageA: TradePackage,
    packageB: TradePackage
  ): Promise<ExecutedTrade>;
}
