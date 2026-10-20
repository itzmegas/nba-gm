import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import type { ReleasePlayerInput } from "@/domain/roster/ReleasePlayer";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useReleasePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (input: ReleasePlayerInput) => {
      if (useBatchSimulationStore.getState().isActive) {
        throw new Error("A simulation is already active.");
      }
      return new SupabasePlayerStateRepository(createClient()).release(input);
    },
    onSettled: async (_data, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: ["games", input.gameId] });
    },
  });
}

export function useReleaseCapCharge(gameId: string, teamId: string | null, seasonYear: number) {
  return useQuery({
    queryKey: ["games", gameId, "release-cap-charge", teamId, seasonYear],
    queryFn: () => {
      if (!teamId) throw new Error("A team is required to read release cap charges.");
      return new SupabasePlayerStateRepository(createClient()).getReleaseCapCharge(
        gameId,
        teamId,
        seasonYear
      );
    },
    enabled: Boolean(teamId),
  });
}
