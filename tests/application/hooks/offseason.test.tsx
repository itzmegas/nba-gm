// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useEnterOffseason } from "@/application/hooks/offseason/useEnterOffseason";
import { useOffseason } from "@/application/hooks/offseason/useOffseason";

const { getEntry, enter } = vi.hoisted(() => ({ getEntry: vi.fn(), enter: vi.fn() }));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/infrastructure/repositories/SupabaseOffseasonRepository", () => ({
  SupabaseOffseasonRepository: class {
    getEntry = getEntry;
    enter = enter;
  },
}));
const gameId = "11111111-1111-4111-8111-111111111111";
const entry = { seasonYear: 2026, enteredAt: "2026-10-25T00:00:00.000Z" };
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function setup(id = gameId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => ({ query: useOffseason(id, 2026), mutation: useEnterOffseason() }), {
      wrapper,
    }),
  };
}

it("keeps an entry isolated by career and season", async () => {
  getEntry.mockResolvedValue(entry);
  const { client, result } = setup();
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  expect(getEntry).toHaveBeenCalledWith(gameId, 2026);
  expect(client.getQueryData(["offseason", gameId, 2026])).toEqual(entry);
  expect(client.getQueryData(["offseason", gameId, 2027])).toBeUndefined();
  expect(client.getQueryData(["offseason", "other", 2026])).toBeUndefined();
});

it("uses the persisted mutation response without advancing the career or refetching history", async () => {
  getEntry.mockResolvedValue(null);
  enter.mockResolvedValue(entry);
  const { client, result } = setup();
  const historic = { championTeamId: "team", phase: "complete" };
  client.setQueryData(["postseason", gameId], historic);
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  await act(async () => {
    await result.current.mutation.mutateAsync({ gameId, seasonYear: 2026 });
  });
  expect(enter).toHaveBeenCalledExactlyOnceWith(gameId, 2026);
  await waitFor(() => expect(result.current.query.data).toEqual(entry));
  expect(getEntry).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(["postseason", gameId])).toEqual(historic);
});

it("surfaces failures without caching a successful transition", async () => {
  getEntry.mockResolvedValue(null);
  enter.mockRejectedValue(new Error("no champion"));
  const { client, result } = setup();
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  await act(async () => {
    await expect(result.current.mutation.mutateAsync({ gameId, seasonYear: 2026 })).rejects.toThrow(
      "no champion"
    );
  });
  expect(client.getQueryData(["offseason", gameId, 2026])).toBeNull();
});

it("does not let an older in-flight read erase a confirmed entry", async () => {
  let finishRead = () => {};
  const olderRead = new Promise<null>((resolve) => {
    finishRead = () => resolve(null);
  });
  getEntry.mockResolvedValueOnce(null).mockReturnValueOnce(olderRead);
  enter.mockResolvedValue(entry);
  const { client, result } = setup();
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
  act(() => {
    void result.current.query.refetch();
  });
  await waitFor(() => expect(getEntry).toHaveBeenCalledTimes(2));
  await act(async () => {
    await result.current.mutation.mutateAsync({ gameId, seasonYear: 2026 });
  });
  await act(async () => {
    finishRead();
  });
  await waitFor(() => expect(result.current.query.isFetching).toBe(false));
  expect(client.getQueryData(["offseason", gameId, 2026])).toEqual(entry);
});

it("does not read a missing career", () => {
  setup("");
  expect(getEntry).not.toHaveBeenCalled();
});
