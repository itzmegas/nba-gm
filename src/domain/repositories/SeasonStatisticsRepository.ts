import type { SeasonStatistics } from "@/domain/entities/PlayerSeasonStatistics";

export interface SeasonStatisticsRepository {
  getRegularSeason(gameId: string, seasonYear: number): Promise<SeasonStatistics>;
}
