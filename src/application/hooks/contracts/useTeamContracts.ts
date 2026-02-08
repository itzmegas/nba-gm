import { useQuery } from "@tanstack/react-query";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

const getContractRepository = () => {
  const supabase = createClient();
  return new SupabaseContractRepository(supabase);
};

export function useTeamContracts(teamId: string) {
  return useQuery({
    queryKey: ["contracts", teamId],
    queryFn: async () => {
      const repository = getContractRepository();
      return await repository.getByTeamId(teamId);
    },
    enabled: !!teamId, // Solo corre si hay un teamId
  });
}
