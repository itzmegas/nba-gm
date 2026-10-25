import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OffseasonContract, OffseasonDecision } from "@/domain/entities/OffseasonContract";
import { SupabaseOffseasonContractRepository } from "@/infrastructure/repositories/SupabaseOffseasonContractRepository";
import { createClient } from "@/infrastructure/supabase/client";

export function useOffseasonContracts(gameId: string, seasonYear: number) {
  const queryClient = useQueryClient();
  const queryKey = ["offseason-contracts", gameId, seasonYear];
  const repository = () => new SupabaseOffseasonContractRepository(createClient());
  const ledger = useQuery({ queryKey, queryFn: () => repository().get(gameId, seasonYear) });
  const prepare = useMutation({
    mutationFn: () => repository().prepare(gameId, seasonYear),
    onSuccess: async (rows) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, rows);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const decide = useMutation({
    mutationFn: ({ playerId, decision }: { playerId: string; decision: OffseasonDecision }) =>
      repository().decide(gameId, seasonYear, playerId, decision),
    onSuccess: async (row) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<OffseasonContract[]>(queryKey, (rows) =>
        rows?.map((existing) => (existing.playerId === row.playerId ? row : existing))
      );
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  return { ledger, prepare, decide };
}
