import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { Contract } from "@/domain/entities/Contract";
import type { TradePackage } from "@/domain/entities/Trade";
import { SupabaseTradeRepository } from "@/infrastructure/repositories/SupabaseTradeRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getTradeEngine = () => {
  const supabase = createClient();
  return new TradeEngine(new SupabaseTradeRepository(supabase));
};

// Hook para simular un trade (validación sin ejecutar)
export function useSimulateTrade(
  gameId: string | null,
  teamAContracts: Contract[],
  teamBContracts: Contract[],
  packageA: TradePackage | null,
  packageB: TradePackage | null
) {
  return useQuery({
    queryKey: ["games", gameId, "trade-simulation", packageA, packageB],
    queryFn: async () => {
      if (!gameId || !packageA || !packageB) {
        throw new Error("Both trade packages are required");
      }
      const engine = getTradeEngine();
      return engine.simulateTrade(gameId, teamAContracts, teamBContracts, packageA, packageB);
    },
    enabled:
      !!gameId &&
      !!packageA &&
      !!packageB &&
      teamAContracts.length > 0 &&
      teamBContracts.length > 0,
  });
}

// Hook para ejecutar un trade
export function useExecuteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      teamAContracts,
      teamBContracts,
      packageA,
      packageB,
    }: {
      gameId: string;
      teamAContracts: Contract[];
      teamBContracts: Contract[];
      packageA: TradePackage;
      packageB: TradePackage;
    }) => {
      const engine = getTradeEngine();
      return engine.executeTrade(gameId, teamAContracts, teamBContracts, packageA, packageB);
    },
    onSuccess: async (result, variables) => {
      if (!result.success) return;
      const { gameId, packageA, packageB } = variables;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games", gameId, "contracts"] }),
        queryClient.invalidateQueries({
          queryKey: ["games", gameId, "contracts", "team", packageA.teamId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["games", gameId, "contracts", "team", packageB.teamId],
        }),
        queryClient.invalidateQueries({ queryKey: ["games", gameId, "roster", packageA.teamId] }),
        queryClient.invalidateQueries({ queryKey: ["games", gameId, "roster", packageB.teamId] }),
        queryClient.invalidateQueries({ queryKey: ["games", gameId, "trade-history"] }),
        queryClient.invalidateQueries({ queryKey: ["games", gameId, "draft-picks"] }),
      ]);
    },
  });
}
