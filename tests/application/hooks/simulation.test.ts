import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AdvanceDayInput, useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";
import {
  type AdvanceRangeInput,
  getMonthEnd,
  useAdvanceRange,
} from "@/application/hooks/simulation/useAdvanceRange";
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
type SimulationInput = AdvanceDayInput & Partial<AdvanceRangeInput>;

vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: {
    mutationFn: (input: SimulationInput) => Promise<unknown>;
    onSuccess?: (data: unknown, input: { gameId: string; simulationDate: Date }) => Promise<void>;
    onSettled?: (data: unknown, error: Error | null, input: SimulationInput) => Promise<void>;
  }) => ({
    mutateAsync: async (input: SimulationInput) => {
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
    stopRequested: false,
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

  it("simulates every league day through the next fixture, across a month boundary", async () => {
    for (const date of ["2026-10-31", "2026-11-01", "2026-11-02"]) {
      rpc.mockResolvedValueOnce({
        data: [{ new_date: date, season_complete: false }],
        error: null,
      });
    }
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 3);
    await useAdvanceRange().mutateAsync({
      ...input,
      mode: BATCH_SIMULATION_MODE.NEXT_GAME,
      targetDate: "2026-11-02",
    });
    expect(rpc).toHaveBeenCalledTimes(3);
    for (const [index, date] of ["2026-10-30", "2026-10-31", "2026-11-01"].entries()) {
      expect(rpc).toHaveBeenNthCalledWith(index + 1, "advance_simulation_day", {
        p_game_id: input.gameId,
        p_expected_date: date,
      });
    }
    expect(useBatchSimulationStore.getState().completedDays).toBe(3);
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
    expect(invalidateQueries).toHaveBeenCalledTimes(18);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["season-statistics", input.gameId],
    });
  });

  it.each([
    undefined,
    "not-a-date",
    "2026-10-30",
    "2026-10-29",
  ])("rejects an invalid next-game boundary %s without advancing", async (targetDate) => {
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 1);
    await expect(
      useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.NEXT_GAME, targetDate })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
  });

  it("pauses next-game simulation after the committed day", async () => {
    rpc.mockImplementationOnce(async () => {
      useBatchSimulationStore.getState().requestStop();
      return { data: [{ new_date: "2026-10-31", season_complete: false }], error: null };
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 3);
    await useAdvanceRange().mutateAsync({
      ...input,
      mode: BATCH_SIMULATION_MODE.NEXT_GAME,
      targetDate: "2026-11-02",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
  });

  it("accepts a play-in target after April 15", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2027-04-17", season_complete: false }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 1);
    await useAdvanceRange().mutateAsync({
      ...input,
      simulationDate: new Date("2027-04-16T00:00:00Z"),
      mode: BATCH_SIMULATION_MODE.NEXT_GAME,
      targetDate: "2027-04-17",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
  });

  it("refreshes newly generated fixtures even when a phase transition does not move the date", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-10-30", season_complete: false }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);
    await useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON });
    expect(useBatchSimulationStore.getState().completedDays).toBe(0);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["schedule", input.gameId] });
  });

  it("rejects malformed RPC dates without counting progress or advancing again", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2026-99-99", season_complete: false }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 1);
    await expect(
      useAdvanceRange().mutateAsync({
        ...input,
        mode: BATCH_SIMULATION_MODE.NEXT_GAME,
        targetDate: "2026-10-31",
      })
    ).rejects.toThrow("Invalid simulation response.");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(0);
  });

  it("caps month simulation at the calendar month end", async () => {
    expect(getMonthEnd(input.simulationDate)).toBe("2026-10-31");
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
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it("treats month end as a zero-day boundary", async () => {
    const monthEndInput = { ...input, simulationDate: new Date("2026-10-31T00:00:00.000Z") };
    useBatchSimulationStore.getState().startBatch(input.mode, 0);

    await useAdvanceRange().mutateAsync(monthEndInput);

    expect(rpc).not.toHaveBeenCalled();
    expect(useBatchSimulationStore.getState().completedDays).toBe(0);
  });

  it("continues beyond April 15 and stops when the server marks completion", async () => {
    const seasonCapInput = { ...input, simulationDate: new Date("2027-04-14T00:00:00.000Z") };
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2027-04-15", season_complete: false }],
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: [{ new_date: "2027-04-16", season_complete: true }],
      error: null,
    });
    useBatchSimulationStore.getState().startBatch(input.mode, 1);

    await useAdvanceRange().mutateAsync(seasonCapInput);

    expect(getMonthEnd(seasonCapInput.simulationDate)).toBe("2027-04-30");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(useBatchSimulationStore.getState().completedDays).toBe(2);
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
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
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
      simulationDate: new Date("2027-04-30T00:00:00.000Z"),
    };
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 0);

    await useAdvanceRange().mutateAsync(zeroDayInput);

    expect(rpc).not.toHaveBeenCalled();
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not start a second active batch", () => {
    expect(useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null)).toBe(
      true
    );
    expect(useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 3)).toBe(
      false
    );
  });

  it("uses the same guarded daily RPC sequence for a range and individual days", async () => {
    const dates = ["2026-10-31", "2026-11-01", "2026-11-02"];
    const responses = () => {
      for (const [index, date] of dates.entries()) {
        rpc.mockResolvedValueOnce({
          data: [{ new_date: date, season_complete: index === dates.length - 1 }],
          error: null,
        });
      }
    };
    responses();
    const advanceDay = useAdvanceDay();
    for (const date of ["2026-10-30", ...dates.slice(0, -1)]) {
      await advanceDay.mutateAsync({
        gameId: input.gameId,
        simulationDate: new Date(`${date}T00:00:00.000Z`),
      });
    }
    const dailyCalls = [...rpc.mock.calls];
    rpc.mockClear();
    invalidateQueries.mockClear();
    responses();
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);
    await useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON });
    expect(rpc.mock.calls).toEqual(dailyCalls);
    expect(useBatchSimulationStore.getState().completedDays).toBe(3);
    expect(
      invalidateQueries.mock.calls.filter(([key]) => key.queryKey[0] === "games")
    ).toHaveLength(3);
  });

  it("stops before the next day when pause is requested", async () => {
    rpc.mockImplementationOnce(async () => {
      useBatchSimulationStore.getState().requestStop();
      return {
        data: [{ new_date: "2026-10-31", season_complete: false }],
        error: null,
      };
    });
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);

    await useAdvanceRange().mutateAsync({ ...input, mode: BATCH_SIMULATION_MODE.SEASON });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useBatchSimulationStore.getState().completedDays).toBe(1);
    expect(useBatchSimulationStore.getState().isActive).toBe(false);
  });
});
