import type {
  SeasonStatistics,
  SeasonStatisticsPhase,
} from "@/domain/entities/PlayerSeasonStatistics";

export interface SeasonStatisticsRepository {
  getByPhase(
    gameId: string,
    seasonYear: number,
    phase?: SeasonStatisticsPhase
  ): Promise<SeasonStatistics>;
}
