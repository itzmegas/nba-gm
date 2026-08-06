import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";
import { getMonthEnd, useAdvanceRange } from "@/application/hooks/simulation/useAdvanceRange";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";

interface RpcResponse {
  data: Array<{ new_date: string; season_complete: boolean }> | null;
  error: { message: string } | null;
}

const rpc = vi.fn<() => Promise<RpcResponse>>(async () => ({
  data: [{ new_date: "2026-10-15", season_complete: false }],
  error: null,
}));
const client = { rpc } as unknown as SupabaseClient;
const invalidateQueries = vi.fn();

vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: {
    mutationFn: (input: {
      gameId: string;
      simulationDate: Date;
      mode?: "month" | "season";
      seasonYear?: number;
    }) => Promise<unknown>;
    onSuccess?: (data: unknown, input: { gameId: string; simulationDate: Date }) => Promise<void>;
    onSettled?: (
      data: unknown,
      error: Error | null,
      input: {
        gameId: string;
        simulationDate: Date;
        mode?: "month" | "season";
        seasonYear?: number;
      }
    ) => Promise<void>;
  }) => ({
    mutateAsync: async (input: {
      gameId: string;
      simulationDate: Date;
      mode?: "month" | "season";
      seasonYear?: number;
    }) => {
      let data: unknown;
      let error: Error | null = null;
      try {
        data = await options.mutationFn(input);
      } catch (caught) {
        error = caught instanceof Error ? caught : new Error("Unknown error");
      }
      if (error) {
        await options.onSettled?.(undefined, error, input);
        throw error;
      }
      await options.onSuccess?.(data, input);
      await options.onSettled?.(data, null, input);
      return data;
    },
  }),
}));

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({
    data: [{ new_date: "2026-10-15", season_complete: false }],
    error: null,
  });
  invalidateQueries.mockReset();
  useBatchSimulationStore.setState({
    isActive: false,
    mode: null,
    completedDays: 0,
    totalDays: null,
    error: null,
  });
});

describe("useAdvanceDay", () => {
  it("sends the current simulation date as the RPC idempotency guard", async () => {
    await useAdvanceDay().mutateAsync({
      gameId: "11111111-1111-4111-8111-111111111111",
      simulationDate: new Date("2026-10-14T00:00:00.000Z"),
    });

    expect(rpc).toHaveBeenCalledWith("advance_simulation_day", {
      p_game_id: "11111111-1111-4111-8111-111111111111",
      p_expected_date: "2026-10-14",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["schedule", "11111111-1111-4111-8111-111111111111"],
    });
  });

  it("does not overlap one-day simulation with an active batch", async () => {
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await expect(
      useAdvanceDay().mutateAsync({
        gameId: "11111111-1111-4111-8111-111111111111",
        simulationDate: new Date("2026-10-14T00:00:00.000Z"),
      })
    ).rejects.toThrow("Another simulation is already active.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not start a batch while one-day simulation owns the shared lock", () => {
    expect(useBatchSimulationStore.getState().startDay()).toBe(true);
    expect(useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 2)).toBe(
      false
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("batch simulation", () => {
  const input = {
    gameId: "11111111-1111-4111-8111-111111111111",
    simulationDate: new Date("2026-10-30T00:00:00.000Z"),
    mode: BATCH_SIMULATION_MODE.MONTH,
    seasonYear: 2026,
  } as const;

  it("caps month simulation at the calendar month end", async () => {
    expect(getMonthEnd(input.simulationDate, input.seasonYear)).toBe("2026-10-31");
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-10-31", season_complete: false }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(input.mode, 2);

    await useAdvanceRange().mutateAsync(input);

    expect(rpc).toHaveBeenNthCalledWith(1, "advance_simulation_day", {
      p_game_id: input.gameId,
      p_expected_date: "2026-10-30",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
    expect(invalidateQueries).toHaveBeenCalledTimes(5);
  });

  it("treats month end as a zero-day boundary", async () => {
    const monthEndInput = { ...input, simulationDate: new Date("2026-10-31T00:00:00.000Z") };
    useBatchSimulationStore.getState().startBatch(input.mode, 0);

    await useAdvanceRange().mutateAsync(monthEndInput);

    expect(rpc).not.toHaveBeenCalled();
    expect(useBatchSimulationStore.getState().completedDays).toBe(0);
  });

  it("caps month simulation at the season end", async () => {
    const seasonCapInput = { ...input, simulationDate: new Date("2027-04-14T00:00:00.000Z") };
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2027-04-15", season_complete: false }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(input.mode, 1);

    await useAdvanceRange().mutateAsync(seasonCapInput);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
  });

  it("hands the returned date to the next season call and stops on completion", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ new_date: "2026-10-31", season_complete: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ new_date: "2026-11-01", season_complete: true }],
        error: null,
      });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON });

    expect(rpc).toHaveBeenLastCalledWith("advance_simulation_day", {
      p_game_id: input.gameId,
      p_expected_date: "2026-10-31",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
  });

  it("keeps committed progress and stops after a failed call", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ new_date: "2026-10-31", season_complete: false }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "stale simulation date" } });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await expect(
      useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON })
    ).rejects.toThrow("stale simulation date");

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
    expect(useBatchSimulationStore.getState().error).toBe("stale simulation date");
    expect(invalidateQueries).toHaveBeenCalledTimes(5);
  });

  it("retries after failure from the persisted date", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ new_date: "2026-10-31", season_complete: false }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "temporary failure" } });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await expect(
      useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON })
    ).rejects.toThrow("temporary failure");
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);

    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-11-01", season_complete: true }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);
    await useAdvanceRange().mutateAsync({
      ...input,
      mode: BATCH_SIMULATION_MODE.SEASON,
      simulationDate: new Date("2026-10-31T00:00:00.000Z"),
    });

    expect(rpc).toHaveBeenLastCalledWith("advance_simulation_day", {
      p_game_id: input.gameId,
      p_expected_date: "2026-10-31",
    });
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
  });

  it("does not count a terminal no-op and retries from the persisted date", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-10-30", season_complete: true }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON });

    expect(useBatchSimulationStore.getState().completedDays).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-11-01", season_complete: true }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);
    await useAdvanceRange().mutateAsync({
      ...input,
      mode: BATCH_SIMULATION_MODE.SEASON,
      simulationDate: new Date("2026-10-31T00:00:00.000Z"),
    });

    expect(rpc).toHaveBeenLastCalledWith("advance_simulation_day", {
      p_game_id: input.gameId,
      p_expected_date: "2026-10-31",
    });
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
  });

  it("settles a zero-day month without calling the RPC", async () => {
    const zeroDayInput = {
      ...input,
      simulationDate: new Date("2027-04-16T00:00:00.000Z"),
    };
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 0);

    await useAdvanceRange().mutateAsync(zeroDayInput);

    expect(rpc).not.toHaveBeenCalled();
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
    expect(invalidateQueries).toHaveBeenCalledTimes(5);
  });

  it("does not start a second active batch", () => {
    expect(useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null)).toBe(
      true
    );
    expect(useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 3)).toBe(
      false
    );
  });
});
