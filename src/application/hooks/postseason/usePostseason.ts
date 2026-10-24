import { useQuery } from "@tanstack/react-query";
import { SupabasePostseasonRepository } from "@/infrastructure/repositories/SupabasePostseasonRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function usePostseason(gameId: string) {
  return useQuery({
    queryKey: ["postseason", gameId],
    queryFn: () => new SupabasePostseasonRepository(createClient()).getState(gameId),
    enabled: !!gameId,
  });
}
