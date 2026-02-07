import { useQuery } from "@tanstack/react-query";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getContractRepository = () => {
  const supabase = createClient();
  return new SupabaseContractRepository(supabase);
};

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const repository = getContractRepository();
      return await repository.getAll();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ["contracts", id],
    queryFn: async () => {
      const repository = getContractRepository();
      return await repository.getById(id);
    },
    enabled: !!id,
  });
}

export function useContractsByTeam(teamId: string | null) {
  return useQuery({
    queryKey: ["contracts", "team", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const repository = getContractRepository();
      return await repository.getByTeamId(teamId);
    },
    enabled: !!teamId,
  });
}

export function useContractsByPlayer(playerId: string | null) {
  return useQuery({
    queryKey: ["contracts", "player", playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const repository = getContractRepository();
      return await repository.getByPlayerId(playerId);
    },
    enabled: !!playerId,
  });
}

export function useActiveContracts() {
  return useQuery({
    queryKey: ["contracts", "active"],
    queryFn: async () => {
      const repository = getContractRepository();
      return await repository.getActiveContracts();
    },
    staleTime: 5 * 60 * 1000,
  });
}
