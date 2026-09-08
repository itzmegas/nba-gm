import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { TradePackage, TradeTeamSnapshot } from "@/domain/entities/Trade";
import { SupabaseTradeRepository } from "@/infrastructure/repositories/SupabaseTradeRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getTradeEngine = () => {
  const supabase = createClient();
  return new TradeEngine(new SupabaseTradeRepository(supabase));
};

// Hook para simular un trade (validación sin ejecutar)
export function useSimulateTrade(
  gameId: string | null,
  teamA: TradeTeamSnapshot | null,
  teamB: TradeTeamSnapshot | null,
  packageA: TradePackage | null,
  packageB: TradePackage | null,
  seasonYear: number
) {
  return useQuery({
    queryKey: ["games", gameId, "trade-simulation", seasonYear, teamA, teamB, packageA, packageB],
    queryFn: async () => {
      if (!gameId || !teamA || !teamB || !packageA || !packageB) {
        throw new Error("Both trade teams and packages are required");
      }
      const engine = getTradeEngine();
      return engine.simulateTrade(gameId, teamA, teamB, packageA, packageB, seasonYear);
    },
    enabled:
      !!gameId &&
      !!teamA &&
      !!teamB &&
      !!packageA &&
      !!packageB &&
      hasBilateralTradeAssets(packageA, packageB),
  });
}

// Hook para ejecutar un trade
export function useExecuteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      teamA,
      teamB,
      packageA,
      packageB,
      seasonYear,
    }: {
      gameId: string;
      teamA: TradeTeamSnapshot;
      teamB: TradeTeamSnapshot;
      packageA: TradePackage;
      packageB: TradePackage;
      seasonYear: number;
    }) => {
      const engine = getTradeEngine();
      return engine.executeTrade(gameId, teamA, teamB, packageA, packageB, true, seasonYear);
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

export function hasBilateralTradeAssets(
  packageA: TradePackage | null,
  packageB: TradePackage | null
): boolean {
  return Boolean(packageA?.outgoingAssets.length && packageB?.outgoingAssets.length);
}
