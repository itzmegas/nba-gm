import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SupabaseOffseasonRepository } from "@/infrastructure/repositories/SupabaseOffseasonRepository";
import { createClient } from "@/infrastructure/supabase/client";

interface EnterOffseasonInput {
  gameId: string;
  seasonYear: number;
}

export function useEnterOffseason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gameId, seasonYear }: EnterOffseasonInput) =>
      new SupabaseOffseasonRepository(createClient()).enter(gameId, seasonYear),
    onSuccess: async (entry, { gameId, seasonYear }) => {
      await queryClient.cancelQueries({ queryKey: ["offseason", gameId, seasonYear] });
      queryClient.setQueryData(["offseason", gameId, seasonYear], entry);
    },
  });
}
