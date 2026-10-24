import { useQuery } from "@tanstack/react-query";
import { SupabaseSeasonStatisticsRepository } from "@/infrastructure/repositories/SupabaseSeasonStatisticsRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useSeasonStatistics(gameId: string, seasonYear: number) {
  return useQuery({
    queryKey: ["season-statistics", gameId, seasonYear, "regular_season"],
    queryFn: () =>
      new SupabaseSeasonStatisticsRepository(createClient()).getRegularSeason(gameId, seasonYear),
  });
}
