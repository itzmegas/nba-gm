import { useQuery } from "@tanstack/react-query";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getContractRepository = () => {
  const supabase = createClient();
  return new SupabaseContractRepository(supabase);
};

export function useContracts(gameId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "contracts"],
    queryFn: async () => {
      if (!gameId) return [];
      const repository = getContractRepository();
      return await repository.getAll(gameId);
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContract(gameId: string | null, id: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "contracts", id],
    queryFn: async () => {
      if (!gameId || !id) return null;
      const repository = getContractRepository();
      return await repository.getById(gameId, id);
    },
    enabled: !!gameId && !!id,
  });
}

export function useContractsByTeam(gameId: string | null, teamId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "contracts", "team", teamId],
    queryFn: async () => {
      if (!gameId || !teamId) return [];
      const repository = getContractRepository();
      return await repository.getByTeamId(gameId, teamId);
    },
    enabled: !!gameId && !!teamId,
  });
}

export function useContractsByPlayer(gameId: string | null, playerId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "contracts", "player", playerId],
    queryFn: async () => {
      if (!gameId || !playerId) return null;
      const repository = getContractRepository();
      return await repository.getByPlayerId(gameId, playerId);
    },
    enabled: !!gameId && !!playerId,
  });
}

export function useActiveContracts(gameId: string | null) {
  return useQuery({
    queryKey: ["games", gameId, "contracts", "active"],
    queryFn: async () => {
      if (!gameId) return [];
      const repository = getContractRepository();
      return await repository.getActiveContracts(gameId);
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}
