import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { importInitialFreeAgents } from "@/application/freeAgency/importInitialFreeAgents";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import type { SubmitFreeAgencyOfferInput } from "@/domain/freeAgency/FreeAgencyMarketSnapshot";
import { SupabaseFreeAgencyRepository } from "@/infrastructure/freeAgency/SupabaseFreeAgencyRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function freeAgencyMarketKey(gameId: string | null) {
  return ["games", gameId, "free-agency"] as const;
}

function getRepository() {
  return new SupabaseFreeAgencyRepository(createClient());
}

export function useImportInitialFreeAgents(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: () => {
      if (useBatchSimulationStore.getState().isActive) {
        throw new Error("A simulation is already active.");
      }
      return importInitialFreeAgents(gameId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["games", gameId] });
    },
  });
}

export function useFreeAgencyMarket(gameId: string | null) {
  return useQuery({
    queryKey: freeAgencyMarketKey(gameId),
    queryFn: () => {
      if (!gameId) throw new Error("A game is required to read the free agency market.");
      return getRepository().getMarket(gameId);
    },
    enabled: Boolean(gameId),
    retry: false,
  });
}

export function useSubmitFreeAgencyOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: (input: SubmitFreeAgencyOfferInput) => {
      if (useBatchSimulationStore.getState().isActive) {
        throw new Error("A simulation is already active.");
      }
      return getRepository().submitOffer(input);
    },
    onSettled: async (_data, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: freeAgencyMarketKey(input.gameId) });
    },
  });
}
