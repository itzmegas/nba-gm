import type { GameBoxScore } from "@/domain/entities/GameBoxScore";

export interface BoxScoreRepository {
  getForFixture(gameId: string, fixtureId: string): Promise<GameBoxScore | null>;
}
