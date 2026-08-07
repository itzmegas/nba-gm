import { useQuery } from "@tanstack/react-query";
import { SupabaseTradeRepository } from "@/infrastructure/repositories/SupabaseTradeRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useTradeHistory(gameId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "trade-history"],
    queryFn: () => new SupabaseTradeRepository(createClient()).getHistory(gameId as string),
    enabled: !!gameId,
  });
}
