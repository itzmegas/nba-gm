import { useQuery } from "@tanstack/react-query";
import type { Game } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useGame(gameId: string | null) {
  return useQuery<Game | null>({
    queryKey: ["games", gameId],
    queryFn: async () => {
      if (!gameId) {
        return null;
      }

      const supabase = createClient();
      const repository = new SupabaseGameRepository(supabase);
      return repository.getById(gameId);
    },
    enabled: !!gameId,
  });
}
