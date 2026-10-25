// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useOffseasonPlayerOptions } from "@/application/hooks/offseason/useOffseasonPlayerOptions";

const { get, resolve } = vi.hoisted(() => ({ get: vi.fn(), resolve: vi.fn() }));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/infrastructure/repositories/SupabaseOffseasonPlayerOptionRepository", () => ({
  SupabaseOffseasonPlayerOptionRepository: class {
    get = get;
    resolve = resolve;
  },
}));
const saved = {
  gameId: "career",
  playerId: "player",
  teamId: "owner",
  seasonYear: 2026,
  currentSalary: 100,
  nextSalary: 120,
  decision: "exercise",
  reason: "salary_not_lower",
  policyVersion: "salary-comparison-v1",
  resolvedAt: "2027-06-10T00:00:00Z",
};
const key = ["offseason-player-options", "career", 2026];
function setup(enabled = true, gameId = "career", seasonYear = 2026) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    wrapper,
    ...renderHook(() => useOffseasonPlayerOptions(gameId, seasonYear, enabled), { wrapper }),
  };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("waits for offseason ledger candidates before reading and never resolves on render", async () => {
  const { result } = setup(false);
  expect(result.current.options.fetchStatus).toBe("idle");
  expect(get).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
});
it("deduplicates concurrent consumers and scopes reads to game/year", async () => {
  get.mockResolvedValue([]);
  const { wrapper, result } = setup();
  renderHook(() => useOffseasonPlayerOptions("career", 2026, true), { wrapper });
  await waitFor(() => expect(result.current.options.isSuccess).toBe(true));
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith("career", 2026);
  expect(resolve).not.toHaveBeenCalled();
});
it("reloads persisted results with a fresh query client and no write", async () => {
  get.mockResolvedValue([saved]);
  const first = setup();
  await waitFor(() => expect(first.result.current.options.data).toEqual([saved]));
  first.unmount();
  const fresh = setup();
  await waitFor(() => expect(fresh.result.current.options.data).toEqual([saved]));
  expect(get).toHaveBeenCalledTimes(2);
  expect(resolve).not.toHaveBeenCalled();
});
it("refreshes only the two current offseason ledgers, retaining original team decisions and history", async () => {
  get.mockResolvedValueOnce([]).mockResolvedValue([saved]);
  resolve.mockResolvedValue([saved]);
  const { client, result } = setup();
  const teamPlan = [{ playerId: "team-option", decision: "exercise" }];
  const originalPlayerPlan = { playerId: "player", status: "player_option", decision: null };
  const otherKeys = [
    ["postseason", "career"],
    ["offseason-player-options", "other", 2026],
    ["offseason-player-options", "career", 2027],
    ["roster", "career"],
    ["game", "career"],
  ];
  const ledgerKey = ["offseason-contracts", "career", 2026];
  client.setQueryData(ledgerKey, [...teamPlan, originalPlayerPlan]);
  for (const otherKey of otherKeys) client.setQueryData(otherKey, { preserved: true });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await waitFor(() => expect(result.current.options.isSuccess).toBe(true));
  await act(async () => {
    await result.current.resolve.mutateAsync();
  });
  expect(resolve).toHaveBeenCalledWith("career", 2026);
  expect(client.getQueryData(key)).toEqual([saved]);
  expect(client.getQueryData(ledgerKey)).toEqual([...teamPlan, originalPlayerPlan]);
  expect(invalidate.mock.calls).toEqual([
    [{ queryKey: key, exact: true }],
    [{ queryKey: ledgerKey, exact: true }],
  ]);
  for (const otherKey of otherKeys) {
    expect(client.getQueryData(otherKey)).toEqual({ preserved: true });
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
  }
});
it("cancels a stale read before caching and refreshing the resolution", async () => {
  let finish = () => {};
  const stale = new Promise<unknown>((done) => {
    finish = () => done([]);
  });
  get.mockResolvedValueOnce([]).mockReturnValueOnce(stale).mockResolvedValue([saved]);
  resolve.mockResolvedValue([saved]);
  const { client, result } = setup();
  await waitFor(() => expect(result.current.options.isSuccess).toBe(true));
  act(() => {
    void result.current.options.refetch();
  });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  const cancel = vi.spyOn(client, "cancelQueries");
  const cache = vi.spyOn(client, "setQueryData");
  await act(async () => {
    await result.current.resolve.mutateAsync();
  });
  expect(cancel).toHaveBeenCalledWith({ queryKey: key, exact: true });
  expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(cache.mock.invocationCallOrder[0]);
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(result.current.options.data).toEqual([saved]));
});
it("merges results without losing saved rows when refresh fails; omitted unknowns stay absent", async () => {
  const previous = { ...saved, playerId: "previous-player" };
  get.mockResolvedValueOnce([previous]).mockRejectedValue(new Error("offline"));
  resolve.mockResolvedValue([saved]);
  const { result } = setup();
  await waitFor(() => expect(result.current.options.isSuccess).toBe(true));
  await act(async () => {
    await result.current.resolve.mutateAsync();
  });
  await waitFor(() => expect(result.current.options.data).toEqual([previous, saved]));
  resolve.mockResolvedValue([]);
  await act(async () => {
    await result.current.resolve.mutateAsync();
  });
  await waitFor(() => expect(result.current.options.data).toEqual([previous, saved]));
});
it("exposes read and mutation failures without inventing saved results", async () => {
  get.mockRejectedValue(new Error("offline"));
  resolve.mockRejectedValue(new Error("denied"));
  const { result } = setup();
  await waitFor(() => expect(result.current.options.isError).toBe(true));
  await act(async () => {
    await expect(result.current.resolve.mutateAsync()).rejects.toThrow("denied");
  });
  await waitFor(() => expect(result.current.resolve.isError).toBe(true));
  expect(result.current.options.data).toBeUndefined();
});
