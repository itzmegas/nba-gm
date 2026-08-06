import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import { createClient } from "@/infrastructure/supabase/client";

export interface AdvanceRangeInput {
  gameId: string;
  simulationDate: Date;
  mode: (typeof BATCH_SIMULATION_MODE)[keyof typeof BATCH_SIMULATION_MODE];
  seasonYear: number;
}

export interface AdvanceSimDayResult {
  new_date: string;
  season_complete: boolean;
}

export function getMonthEnd(date: Date, seasonYear: number): string {
  const seasonEnd = new Date(Date.UTC(seasonYear + 1, 3, 15));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return (monthEnd <= seasonEnd ? monthEnd : seasonEnd).toISOString().slice(0, 10);
}

function getAdvanceResult(data: unknown): AdvanceSimDayResult {
  const result = Array.isArray(data) ? data[0] : data;
  if (
    typeof result !== "object" ||
    result === null ||
    !("new_date" in result) ||
    typeof result.new_date !== "string" ||
    !("season_complete" in result) ||
    typeof result.season_complete !== "boolean"
  ) {
    throw new Error("Invalid simulation response.");
  }
  return result as AdvanceSimDayResult;
}

export function useAdvanceRange() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, AdvanceRangeInput>({
    mutationFn: async ({ gameId, simulationDate, mode, seasonYear }) => {
      const store = useBatchSimulationStore.getState();
      if (!store.isActive) {
        throw new Error("No active batch simulation.");
      }

      const monthEnd =
        mode === BATCH_SIMULATION_MODE.MONTH ? getMonthEnd(simulationDate, seasonYear) : null;
      let currentDate = simulationDate.toISOString().slice(0, 10);
      let completedDays = 0;

      while (monthEnd === null || currentDate < monthEnd) {
        const previousDate = currentDate;
        const { data, error } = await createClient().rpc("advance_simulation_day", {
          p_game_id: gameId,
          p_expected_date: currentDate,
        });
        if (error) throw new Error(error.message);

        const result = getAdvanceResult(data);
        if (result.new_date <= previousDate) break;
        completedDays += 1;
        store.updateProgress(completedDays);
        currentDate = result.new_date;
        if (result.season_complete) break;
      }

      return completedDays;
    },
    onSettled: async (_data, error, { gameId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", "next", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", "current", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule", gameId] }),
        queryClient.invalidateQueries({ queryKey: ["standings", gameId] }),
      ]);
      if (error) useBatchSimulationStore.getState().failBatch(error.message);
      else useBatchSimulationStore.getState().finishBatch();
    },
  });
}
