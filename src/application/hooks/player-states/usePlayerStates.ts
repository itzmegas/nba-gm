import { useQuery } from "@tanstack/react-query";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function usePlayerStates(gameId: string | null, teamId?: string | null) {
  return useQuery<PlayerState[]>({
    queryKey: ["games", gameId, "player-states", teamId ?? "all"],
    queryFn: async () => {
      if (!gameId) {
        return [];
      }

      const supabase = createClient();
      const repository = new SupabasePlayerStateRepository(supabase);

      if (teamId) {
        return repository.getByGameAndTeam(gameId, teamId);
      }

      return repository.getByGameId(gameId);
    },
    enabled: !!gameId,
  });
}
