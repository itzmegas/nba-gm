// @vitest-environment happy-dom

import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFreeAgencyMarket } from "@/application/hooks/free-agency/useFreeAgencyMarket";
import { useAdvanceDay } from "@/application/hooks/simulation/useAdvanceDay";
import { useAdvanceRange } from "@/application/hooks/simulation/useAdvanceRange";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";

const gameId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const playerId = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));

describe("simulation refreshes observed game data", () => {
  let queryClient: QueryClient;
  let reads: Record<string, number>;
  let resolved: boolean;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    rpc.mockReset();
    reads = { market: 0, roster: 0, contracts: 0 };
    resolved = false;
    useBatchSimulationStore.setState({ isActive: false, mode: null, stopRequested: false });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    rpc.mockImplementation(async (name: string) => {
      if (name === "advance_simulation_day") {
        resolved = true;
        return { data: [{ new_date: "2026-10-16", season_complete: true }], error: null };
      }
      reads.market += 1;
      return {
        data: {
          game_id: gameId,
          supported: true,
          context: {
            team_id: teamId,
            season: "2026-27",
            simulation_date: resolved ? "2026-10-16" : "2026-10-15",
            salary_cap: 170_111_480,
            payroll: resolved ? 12_625_627 : 10_000_000,
            cap_room: resolved ? 157_485_853 : 160_111_480,
            roster_count: resolved ? 2 : 1,
          },
          candidates: resolved
            ? []
            : [
                {
                  player_id: playerId,
                  first_name: "Alex",
                  last_name: "Player",
                  position: "PG",
                  minimum_salary: 2_625_627,
                  maximum_salary: 42_527_870,
                },
              ],
          offers: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              request_id: "55555555-5555-4555-8555-555555555555",
              owner_id: "66666666-6666-4666-8666-666666666666",
              game_id: gameId,
              player_id: playerId,
              team_id: teamId,
              season: "2026-27",
              annual_salary: 2_625_627,
              years: 1,
              due_date: "2026-10-16",
              created_at: "2026-10-15T00:00:00Z",
              status: resolved ? "accepted" : "pending",
              offer_origin: "human",
              ai_decision_date: null,
              resolved_at: resolved ? "2026-10-16T00:00:00Z" : null,
              resolved_date: resolved ? "2026-10-16" : null,
              resolution_reason: resolved ? "selected_offer_accepted" : null,
              resolution_detail: null,
              resolved_contract_id: resolved ? "77777777-7777-4777-8777-777777777777" : null,
              player_name: "Alex Player",
              team_name: "Team",
            },
          ],
        },
        error: null,
      };
    });
  });

  function useObservedGameData() {
    const market = useFreeAgencyMarket(gameId);
    const roster = useQuery({
      queryKey: ["games", gameId, "roster", teamId],
      queryFn: async () => {
        reads.roster += 1;
        return resolved ? ["existing", playerId] : ["existing"];
      },
    });
    const contracts = useQuery({
      queryKey: ["games", gameId, "contracts", "team", teamId],
      queryFn: async () => {
        reads.contracts += 1;
        return resolved ? [10_000_000, 2_625_627] : [10_000_000];
      },
    });
    return { market, roster, contracts };
  }

  it.each([
    "day",
    "range",
  ] as const)("refreshes market, selected roster, and payroll contracts after %s advancement", async (kind) => {
    const { result } = renderHook(
      () => ({
        data: useObservedGameData(),
        advanceDay: useAdvanceDay(),
        advanceRange: useAdvanceRange(),
      }),
      { wrapper }
    );
    await waitFor(() => expect(reads).toEqual({ market: 1, roster: 1, contracts: 1 }));
    await waitFor(() => expect(result.current.data.market.data?.offers[0].status).toBe("pending"));

    if (kind === "day") {
      await act(async () =>
        result.current.advanceDay.mutateAsync({
          gameId,
          simulationDate: new Date("2026-10-15T00:00:00Z"),
        })
      );
    } else {
      useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.SEASON, null);
      await act(async () =>
        result.current.advanceRange.mutateAsync({
          gameId,
          simulationDate: new Date("2026-10-15T00:00:00Z"),
          mode: BATCH_SIMULATION_MODE.SEASON,
          seasonYear: 2026,
        })
      );
    }

    await waitFor(() => expect(reads).toEqual({ market: 2, roster: 2, contracts: 2 }));
    await waitFor(() => expect(result.current.data.market.data?.offers[0].status).toBe("accepted"));
    expect(result.current.data.market.data?.candidates).toEqual([]);
    expect(result.current.data.market.data?.context?.payroll).toBe(12_625_627);
    expect(result.current.data.market.data?.context?.rosterCount).toBe(2);
    expect(result.current.data.roster.data).toEqual(["existing", playerId]);
    expect(result.current.data.contracts.data?.reduce((sum, salary) => sum + salary, 0)).toBe(
      12_625_627
    );
    expect(rpc.mock.calls.filter(([name]) => name === "get_free_agency_market")).toHaveLength(2);
  });
});
