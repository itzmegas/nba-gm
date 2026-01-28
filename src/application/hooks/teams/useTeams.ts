import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/infrastructure/supabase/client";
import { SupabaseTeamRepository } from "@/infrastructure/repositories/SupabaseTeamRepository";

// Factory para instanciar el repositorio
// En una app más grande, esto iría en un contenedor de inyección de dependencias
const getTeamRepository = () => {
  const supabase = createClient();
  return new SupabaseTeamRepository(supabase);
};

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const repository = getTeamRepository();
      return await repository.getAll();
    },
  });
}
