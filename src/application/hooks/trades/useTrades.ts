import { useMutation, useQuery } from "@tanstack/react-query";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { Contract } from "@/domain/entities/Contract";
import type { TradePackage } from "@/domain/entities/Trade";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getTradeEngine = () => {
  const supabase = createClient();
  const contractRepo = new SupabaseContractRepository(supabase);
  return new TradeEngine(contractRepo);
};

// Hook para simular un trade (validación sin ejecutar)
export function useSimulateTrade(
  teamAContracts: Contract[],
  teamBContracts: Contract[],
  packageA: TradePackage | null,
  packageB: TradePackage | null
) {
  return useQuery({
    queryKey: ["trade-simulation", packageA, packageB],
    queryFn: async () => {
      if (!packageA || !packageB) {
        throw new Error("Both trade packages are required");
      }
      const engine = getTradeEngine();
      return engine.simulateTrade(teamAContracts, teamBContracts, packageA, packageB);
    },
    enabled: !!packageA && !!packageB && teamAContracts.length > 0 && teamBContracts.length > 0,
  });
}

// Hook para ejecutar un trade
export function useExecuteTrade() {
  return useMutation({
    mutationFn: async ({
      teamAContracts,
      teamBContracts,
      packageA,
      packageB,
    }: {
      teamAContracts: Contract[];
      teamBContracts: Contract[];
      packageA: TradePackage;
      packageB: TradePackage;
    }) => {
      const engine = getTradeEngine();
      return engine.executeTrade(teamAContracts, teamBContracts, packageA, packageB);
    },
  });
}
