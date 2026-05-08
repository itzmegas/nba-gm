import { useQuery } from "@tanstack/react-query";
import type { Game } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useGames() {
  return useQuery<Game[]>({
    queryKey: ["games"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const repository = new SupabaseGameRepository(supabase);
      return repository.getByUserId(user.id);
    },
    staleTime: 2 * 60 * 1000,
  });
}
