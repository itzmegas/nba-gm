import { useQuery } from "@tanstack/react-query";
import {
  SEASON_STATISTICS_PHASE,
  type SeasonStatisticsPhase,
} from "@/domain/entities/PlayerSeasonStatistics";
import { SupabaseSeasonStatisticsRepository } from "@/infrastructure/repositories/SupabaseSeasonStatisticsRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useSeasonStatistics(
  gameId: string,
  seasonYear: number,
  phase: SeasonStatisticsPhase = SEASON_STATISTICS_PHASE.REGULAR_SEASON
) {
  return useQuery({
    queryKey: ["season-statistics", gameId, seasonYear, phase],
    queryFn: () =>
      new SupabaseSeasonStatisticsRepository(createClient()).getByPhase(gameId, seasonYear, phase),
  });
}
