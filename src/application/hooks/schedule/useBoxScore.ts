import { useQuery } from "@tanstack/react-query";
import { SupabaseBoxScoreRepository } from "@/infrastructure/repositories/SupabaseBoxScoreRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useBoxScore(gameId: string, fixtureId: string) {
  return useQuery({
    queryKey: ["box-score", gameId, fixtureId],
    queryFn: () => new SupabaseBoxScoreRepository(createClient()).getForFixture(gameId, fixtureId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
