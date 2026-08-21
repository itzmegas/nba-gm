import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (gameId) => {
      const supabase = createClient();
      const repository = new SupabaseGameRepository(supabase);
      await repository.softDelete(gameId);
    },
    onSuccess: async (_, gameId) => {
      await queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.removeQueries({ queryKey: ["games", gameId], exact: true });
    },
  });
}
