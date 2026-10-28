import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OffseasonPlayerOption } from "@/domain/entities/OffseasonPlayerOption";
import { SupabaseOffseasonPlayerOptionRepository } from "@/infrastructure/repositories/SupabaseOffseasonPlayerOptionRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useOffseasonPlayerOptions(gameId: string, seasonYear: number, enabled: boolean) {
  const queryClient = useQueryClient();
  const queryKey = ["offseason-player-options", gameId, seasonYear];
  const repository = () => new SupabaseOffseasonPlayerOptionRepository(createClient());
  const options = useQuery({
    queryKey,
    queryFn: () => repository().get(gameId, seasonYear),
    enabled,
  });
  const resolve = useMutation({
    mutationFn: () => repository().resolve(gameId, seasonYear),
    onSuccess: async (rows) => {
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<OffseasonPlayerOption[]>(queryKey, (existing) => {
        const saved = new Map(existing?.map((row) => [row.playerId, row]));
        for (const row of rows) saved.set(row.playerId, row);
        return [...saved.values()];
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: ["offseason-contracts", gameId, seasonYear],
          exact: true,
        }),
      ]);
    },
  });
  return { options, resolve };
}
