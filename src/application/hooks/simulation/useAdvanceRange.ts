import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
  targetDate?: string;
}

export interface AdvanceSimDayResult {
  new_date: string;
  season_complete: boolean;
}

export function getMonthEnd(date: Date): string {
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return monthEnd.toISOString().slice(0, 10);
}

function getAdvanceResult(data: unknown): AdvanceSimDayResult {
  const result = Array.isArray(data) ? data[0] : data;
  const parsed = z
    .object({ new_date: z.iso.date(), season_complete: z.boolean() })
    .safeParse(result);
  if (!parsed.success) {
    throw new Error("Invalid simulation response.");
  }
  return parsed.data;
}

export function useAdvanceRange() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, AdvanceRangeInput>({
    mutationFn: async ({ gameId, simulationDate, mode, targetDate }) => {
      const store = useBatchSimulationStore.getState();
      if (!store.isActive) {
        throw new Error("No active batch simulation.");
      }

      let endDate = mode === BATCH_SIMULATION_MODE.MONTH ? getMonthEnd(simulationDate) : null;
      let currentDate = simulationDate.toISOString().slice(0, 10);
      if (mode === BATCH_SIMULATION_MODE.NEXT_GAME) {
        endDate = z.iso.date().parse(targetDate);
        if (endDate <= currentDate) {
          throw new Error("Next game must be after the current day.");
        }
      }
      let completedDays = 0;

      while (endDate === null || currentDate < endDate) {
        if (useBatchSimulationStore.getState().stopRequested) break;

        const previousDate = currentDate;
        const { data, error } = await createClient().rpc("advance_simulation_day", {
          p_game_id: gameId,
          p_expected_date: currentDate,
        });
        if (error) throw new Error(error.message);

        const result = getAdvanceResult(data);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["games", gameId] }),
          queryClient.invalidateQueries({ queryKey: ["schedule", "next", gameId] }),
          queryClient.invalidateQueries({ queryKey: ["schedule", "current", gameId] }),
          queryClient.invalidateQueries({ queryKey: ["schedule", gameId] }),
          queryClient.invalidateQueries({ queryKey: ["standings", gameId] }),
          queryClient.invalidateQueries({ queryKey: ["season-statistics", gameId] }),
        ]);
        if (result.new_date <= previousDate) break;
        completedDays += 1;
        store.updateProgress(completedDays);
        currentDate = result.new_date;
        if (result.season_complete) break;
      }

      return completedDays;
    },
    onSettled: (_data, error) => {
      if (error) useBatchSimulationStore.getState().failBatch(error.message);
      else useBatchSimulationStore.getState().finishBatch();
    },
  });
}
