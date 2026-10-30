import { useQuery } from "@tanstack/react-query";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { CONTRACT_IDENTITY_RESOLUTION_STATUS } from "@/domain/contracts/GameContract";
import { CONTRACT_ORIGIN } from "@/domain/entities/Contract";
import type { PlayerRatings } from "@/domain/entities/PlayerAttributes";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabasePlayerRatingsRepository } from "@/infrastructure/repositories/SupabasePlayerRatingsRepository";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useGamePlayers(gameId: string, seasonYear?: number) {
  return useQuery({
    queryKey: ["games", gameId, "players", seasonYear],
    enabled: !!gameId && seasonYear !== undefined,
    queryFn: async (): Promise<RosterPlayer[]> => {
      if (seasonYear === undefined) return [];
      const client = createClient();
      const [states, players, contracts, identities] = await Promise.all([
        new SupabasePlayerStateRepository(client).getByGameId(gameId),
        new SupabasePlayerRepository(client).getAll(),
        new SupabaseContractRepository(client).getAll(gameId),
        new SupabaseGameContractRepository(client).getAll(gameId),
      ]);
      const playerById = new Map(players.map((player) => [player.id, player]));
      const contractById = new Map<string, (typeof contracts)[number]>();
      for (const contract of contracts) {
        const previous = contractById.get(contract.playerId);
        if (!previous || contract.salaryY1 > previous.salaryY1)
          contractById.set(contract.playerId, contract);
      }
      const identityById = new Map(identities.map((identity) => [identity.playerId, identity]));
      const ratings = new Map<string, PlayerRatings>();
      // Bound URL size and response size; never issue one query per player.
      for (let offset = 0; offset < states.length; offset += 150) {
        const batch = await new SupabasePlayerRatingsRepository(client).getByPlayers(
          gameId,
          seasonYear,
          states.slice(offset, offset + 150).map((state) => state.playerId)
        );
        for (const [id, rating] of batch) ratings.set(id, rating);
      }
      return states.map((state) => {
        const player = playerById.get(state.playerId);
        if (!player) throw new Error("Game player identity is unavailable");
        const contract = contractById.get(state.playerId) ?? null;
        const gameContract = identityById.get(state.playerId) ?? null;
        const isActive =
          state.isActive &&
          (contract?.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT ||
            gameContract?.resolutionStatus !==
              CONTRACT_IDENTITY_RESOLUTION_STATUS.INACTIVE_EXCLUDED);
        return {
          player: { ...player, teamId: state.teamId ?? undefined, isActive },
          contract: isActive && state.teamId && contract?.teamId === state.teamId ? contract : null,
          gameContract: isActive && state.teamId ? gameContract : null,
          ratings: ratings.get(state.playerId) ?? null,
        };
      });
    },
  });
}
