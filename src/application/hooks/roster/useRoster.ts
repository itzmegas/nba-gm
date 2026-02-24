import { useQuery } from "@tanstack/react-query";
import type { Contract } from "@/domain/entities/Contract";
import type { Player } from "@/domain/entities/Player";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { createClient } from "@/infrastructure/supabase/client";

export interface RosterPlayer {
  player: Player;
  contract: Contract | null;
}

export function useRoster(teamId: string | null) {
  return useQuery({
    queryKey: ["roster", teamId],
    queryFn: async (): Promise<RosterPlayer[]> => {
      if (!teamId) return [];

      const supabase = createClient();
      const playerRepo = new SupabasePlayerRepository(supabase);
      const contractRepo = new SupabaseContractRepository(supabase);

      const [players, contracts] = await Promise.all([
        playerRepo.getByTeamId(teamId),
        contractRepo.getByTeamId(teamId),
      ]);

      const contractByPlayerId = new Map<string, Contract>();
      for (const contract of contracts) {
        // Si hay múltiples contratos, quedarse con el de mayor salario (el activo)
        const existing = contractByPlayerId.get(contract.playerId);
        if (!existing || contract.salaryY1 > existing.salaryY1) {
          contractByPlayerId.set(contract.playerId, contract);
        }
      }

      return players.map((player) => ({
        player,
        contract: contractByPlayerId.get(player.id) ?? null,
      }));
    },
    enabled: !!teamId,
    staleTime: 2 * 60 * 1000,
  });
}
