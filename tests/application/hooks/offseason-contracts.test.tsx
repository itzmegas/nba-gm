// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useOffseasonContracts } from "@/application/hooks/offseason/useOffseasonContracts";

const { get, prepare, decide } = vi.hoisted(() => ({
  get: vi.fn(),
  prepare: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/infrastructure/repositories/SupabaseOffseasonContractRepository", () => ({
  SupabaseOffseasonContractRepository: class {
    get = get;
    prepare = prepare;
    decide = decide;
  },
}));
const row = {
  playerId: "player",
  teamId: "owner",
  seasonYear: 2026,
  status: "team_option",
  decision: null,
  nextSalary: 100,
};
const saved = { ...row, decision: "exercise" };
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    wrapper,
    ...renderHook(() => useOffseasonContracts("career", 2026), { wrapper }),
  };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("reads once for concurrent consumers and never prepares while reading", async () => {
  get.mockResolvedValue([row]);
  const { wrapper, result } = setup();
  renderHook(() => useOffseasonContracts("career", 2026), { wrapper });
  await waitFor(() => expect(result.current.ledger.isSuccess).toBe(true));
  expect(get).toHaveBeenCalledTimes(1);
  expect(prepare).not.toHaveBeenCalled();
  expect(decide).not.toHaveBeenCalled();
});
it("reloads persisted decisions on remount without another write", async () => {
  get.mockResolvedValue([saved]);
  const { result, unmount, wrapper } = setup();
  await waitFor(() => expect(result.current.ledger.data).toEqual([saved]));
  unmount();
  const again = renderHook(() => useOffseasonContracts("career", 2026), { wrapper });
  await waitFor(() => expect(again.result.current.ledger.data).toEqual([saved]));
  expect(prepare).not.toHaveBeenCalled();
  expect(decide).not.toHaveBeenCalled();
});
it("prepares and refreshes only the ledger, preserving history", async () => {
  get.mockResolvedValueOnce([]).mockResolvedValue([row]);
  prepare.mockResolvedValue([row]);
  const { client, result } = setup();
  client.setQueryData(["postseason", "career"], { champion: "team" });
  await waitFor(() => expect(result.current.ledger.isSuccess).toBe(true));
  await act(async () => {
    await result.current.prepare.mutateAsync();
  });
  expect(client.getQueryData(["offseason-contracts", "career", 2026])).toEqual([row]);
  expect(client.getQueryData(["postseason", "career"])).toEqual({ champion: "team" });
  expect(client.getQueryData(["offseason-contracts", "career", 2027])).toBeUndefined();
});
it("cancels a stale read before caching and refreshing a confirmed decision", async () => {
  let finish = () => {};
  const oldRead = new Promise<unknown>((resolve) => {
    finish = () => resolve([row]);
  });
  get.mockResolvedValueOnce([row]).mockReturnValueOnce(oldRead).mockResolvedValue([saved]);
  decide.mockResolvedValue(saved);
  const { result } = setup();
  await waitFor(() => expect(result.current.ledger.isSuccess).toBe(true));
  act(() => {
    void result.current.ledger.refetch();
  });
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  await act(async () => {
    await result.current.decide.mutateAsync({ playerId: "player", decision: "exercise" });
  });
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(result.current.ledger.data).toEqual([saved]));
});
it("retains the saved decision if refresh fails, and exposes mutation failures", async () => {
  get.mockResolvedValueOnce([row]).mockRejectedValue(new Error("offline"));
  decide.mockResolvedValue(saved);
  const { result } = setup();
  await waitFor(() => expect(result.current.ledger.isSuccess).toBe(true));
  await act(async () => {
    await result.current.decide.mutateAsync({ playerId: "player", decision: "exercise" });
  });
  await waitFor(() => expect(result.current.ledger.data).toEqual([saved]));
  prepare.mockRejectedValue(new Error("denied"));
  await act(async () => {
    await expect(result.current.prepare.mutateAsync()).rejects.toThrow("denied");
  });
  expect(result.current.ledger.data).toEqual([saved]);
});
