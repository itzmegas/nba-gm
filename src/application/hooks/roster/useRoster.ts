import { useQuery } from "@tanstack/react-query";
import type { Contract } from "@/domain/entities/Contract";
import type { Player } from "@/domain/entities/Player";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import { createClient } from "@/infrastructure/supabase/client";

export interface RosterPlayer {
  player: Player;
  contract: Contract | null;
}

export function useRoster(gameId: string | null, teamId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "roster", teamId],
    queryFn: async (): Promise<RosterPlayer[]> => {
      if (!gameId || !teamId) return [];

      const supabase = createClient();
      const playerRepo = new SupabasePlayerRepository(supabase);
      const playerStateRepo = new SupabasePlayerStateRepository(supabase);
      const contractRepo = new SupabaseContractRepository(supabase);

      const [playerStates, contracts, allPlayers] = await Promise.all([
        playerStateRepo.getByGameAndTeam(gameId, teamId),
        contractRepo.getByTeamId(gameId, teamId),
        playerRepo.getAll(),
      ]);

      const playerById = new Map<string, Player>(allPlayers.map((player) => [player.id, player]));

      const contractByPlayerId = new Map<string, Contract>();
      for (const contract of contracts) {
        // Si hay múltiples contratos, quedarse con el de mayor salario (el activo)
        const existing = contractByPlayerId.get(contract.playerId);
        if (!existing || contract.salaryY1 > existing.salaryY1) {
          contractByPlayerId.set(contract.playerId, contract);
        }
      }

      const rosterPlayers: RosterPlayer[] = [];

      for (const playerState of playerStates) {
        const player = playerById.get(playerState.playerId);

        if (!player) {
          continue;
        }

        rosterPlayers.push({
          player,
          contract: contractByPlayerId.get(player.id) ?? null,
        });
      }

      return rosterPlayers;
    },
    enabled: !!gameId && !!teamId,
    staleTime: 2 * 60 * 1000,
  });
}
