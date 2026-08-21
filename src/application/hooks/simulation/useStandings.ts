import { useQuery } from "@tanstack/react-query";
import { SupabaseStandingsRepository } from "@/infrastructure/repositories/SupabaseStandingsRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useStandings(gameId: string) {
  return useQuery({
    queryKey: ["standings", gameId],
    queryFn: () => new SupabaseStandingsRepository(createClient()).getByGameId(gameId),
    enabled: Boolean(gameId),
  });
}
