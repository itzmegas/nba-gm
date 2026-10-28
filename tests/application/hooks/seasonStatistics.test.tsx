// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useSeasonStatistics } from "@/application/hooks/schedule/useSeasonStatistics";
import type { SeasonStatisticsPhase } from "@/domain/entities/PlayerSeasonStatistics";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({ rpc }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("defaults to regular season and caches each competition phase separately", async () => {
  rpc.mockImplementation((_name, { p_phase }) =>
    Promise.resolve({
      data: {
        completedGames: p_phase === "regular_season" ? 82 : p_phase === "play_in" ? 2 : 0,
        coveredGames: 0,
        players: [],
      },
      error: null,
    })
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const gameId = "a0000000-0000-4000-8000-000000000001";
  const { result, rerender } = renderHook(
    ({ phase }: { phase?: SeasonStatisticsPhase }) => useSeasonStatistics(gameId, 2026, phase),
    { wrapper, initialProps: {} }
  );
  await waitFor(() => expect(result.current.data?.completedGames).toBe(82));
  rerender({ phase: "play_in" });
  await waitFor(() => expect(result.current.data?.completedGames).toBe(2));
  rerender({ phase: "playoffs" });
  await waitFor(() => expect(result.current.data?.completedGames).toBe(0));
  for (const [phase, completedGames] of [
    ["regular_season", 82],
    ["play_in", 2],
    ["playoffs", 0],
  ] as const) {
    expect(queryClient.getQueryData(["season-statistics", gameId, 2026, phase])).toMatchObject({
      completedGames,
    });
  }
  rerender({ phase: "regular_season" });
  expect(result.current.data?.completedGames).toBe(82);
  expect(rpc).toHaveBeenCalledTimes(3);
});
