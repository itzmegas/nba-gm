import { useQuery } from "@tanstack/react-query";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getPlayerRepository = () => {
  const supabase = createClient();
  return new SupabasePlayerRepository(supabase);
};

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const repository = getPlayerRepository();
      return await repository.getAll();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ["players", id],
    queryFn: async () => {
      const repository = getPlayerRepository();
      return await repository.getById(id);
    },
    enabled: !!id,
  });
}

export function usePlayersByTeam(teamId: string | null) {
  return useQuery({
    queryKey: ["players", "team", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const repository = getPlayerRepository();
      return await repository.getByTeamId(teamId);
    },
    enabled: !!teamId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

export function useActivePlayers() {
  return useQuery({
    queryKey: ["players", "active"],
    queryFn: async () => {
      const repository = getPlayerRepository();
      return await repository.getActivePlayers();
    },
    staleTime: 5 * 60 * 1000,
  });
}
