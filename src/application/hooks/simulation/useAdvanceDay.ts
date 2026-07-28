import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/infrastructure/supabase/client";

export interface AdvanceDayInput {
  gameId: string;
  simulationDate: Date;
}

export function useAdvanceDay() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AdvanceDayInput>({
    mutationFn: async ({ gameId, simulationDate }) => {
      const { data, error } = await createClient().rpc("advance_simulation_day", {
        p_game_id: gameId,
        p_expected_date: simulationDate.toISOString().slice(0, 10),
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async (_, { gameId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", "next", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["standings", gameId] }),
      ]);
    },
  });
}
