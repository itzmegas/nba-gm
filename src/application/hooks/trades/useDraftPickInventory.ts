import { useQuery } from "@tanstack/react-query";
import { SupabaseDraftPickRepository } from "@/infrastructure/repositories/SupabaseDraftPickRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useDraftPickInventory(gameId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "draft-picks"],
    queryFn: () => new SupabaseDraftPickRepository(createClient()).getByGameId(gameId as string),
    enabled: !!gameId,
  });
}
