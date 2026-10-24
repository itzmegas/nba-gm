import { useQuery } from "@tanstack/react-query";
import { SupabaseOffseasonRepository } from "@/infrastructure/repositories/SupabaseOffseasonRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useOffseason(gameId: string, seasonYear: number) {
  return useQuery({
    queryKey: ["offseason", gameId, seasonYear],
    queryFn: () => new SupabaseOffseasonRepository(createClient()).getEntry(gameId, seasonYear),
    enabled: !!gameId,
  });
}
