import { useQuery } from "@tanstack/react-query";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getContractRepository = () => {
  const supabase = createClient();
  return new SupabaseContractRepository(supabase);
};

export function useTeamContracts(gameId: string | null, teamId: string | null) {
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
