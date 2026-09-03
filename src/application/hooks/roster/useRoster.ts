import { useQuery } from "@tanstack/react-query";
import {
  CONTRACT_IDENTITY_RESOLUTION_STATUS,
  type GamePlayerContractState,
} from "@/domain/contracts/GameContract";
import type { Contract } from "@/domain/entities/Contract";
import type { Player } from "@/domain/entities/Player";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import { createClient } from "@/infrastructure/supabase/client";

export interface RosterPlayer {
  player: Player;
  contract: Contract | null;
  gameContract: GamePlayerContractState | null;
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
      const gameContractRepo = new SupabaseGameContractRepository(supabase);

      const [playerStates, contracts, allPlayers, gameContracts] = await Promise.all([
        playerStateRepo.getByGameAndTeam(gameId, teamId),
        contractRepo.getByTeamId(gameId, teamId),
        playerRepo.getAll(),
        gameContractRepo.getByTeam(gameId, teamId),
      ]);

      const playerById = new Map<string, Player>(allPlayers.map((player) => [player.id, player]));

      const contractByPlayerId = new Map<string, Contract>();
      for (const contract of contracts) {
        // Compatibility rows are derived from the game's canonical current-season row.
        const existing = contractByPlayerId.get(contract.playerId);
        if (!existing || contract.salaryY1 > existing.salaryY1) {
          contractByPlayerId.set(contract.playerId, contract);
        }
      }

      const rosterPlayers: RosterPlayer[] = [];
      const gameContractByPlayerId = new Map(gameContracts.map((state) => [state.playerId, state]));

      for (const playerState of playerStates) {
        const player = playerById.get(playerState.playerId);
        const gameContract = gameContractByPlayerId.get(playerState.playerId) ?? null;

        if (
          !player ||
          gameContract?.resolutionStatus === CONTRACT_IDENTITY_RESOLUTION_STATUS.INACTIVE_EXCLUDED
        ) {
          continue;
        }

        rosterPlayers.push({
          player,
          contract: contractByPlayerId.get(player.id) ?? null,
          gameContract,
        });
      }

      return rosterPlayers;
    },
    enabled: !!gameId && !!teamId,
    staleTime: 2 * 60 * 1000,
  });
}
