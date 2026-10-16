// @vitest-environment happy-dom

import type { SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useFreeAgencyMarket,
  useSubmitFreeAgencyOffer,
} from "@/application/hooks/free-agency/useFreeAgencyMarket";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";

const gameId = "11111111-1111-4111-8111-111111111111";
const playerId = "22222222-2222-4222-8222-222222222222";
const teamId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => client }));

const market = {
  game_id: gameId,
  supported: false,
  context: null,
  candidates: [],
  offers: [],
};
const submittedOffer = {
  id: "55555555-5555-4555-8555-555555555555",
  request_id: requestId,
  game_id: gameId,
  player_id: playerId,
  team_id: teamId,
  season: "2026-27",
  annual_salary: 2_625_627,
  years: 1,
  due_date: "2026-10-03",
  status: "pending",
};
const refreshedMarket = {
  ...market,
  offers: [
    {
      ...submittedOffer,
      owner_id: "66666666-6666-4666-8666-666666666666",
      created_at: "2026-10-02T12:00:00Z",
      resolved_at: null,
      resolved_date: null,
      resolution_reason: null,
      resolution_detail: null,
      resolved_contract_id: null,
      offer_origin: "human",
      ai_decision_date: null,
      player_name: "First Player",
      team_name: "Example Team",
    },
  ],
};

describe("free agency hooks", () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    rpc.mockReset();
    useBatchSimulationStore.setState({ isActive: false, mode: null });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  it("loads the market and submits the supplied idempotency UUID and exact terms, then reconciles", async () => {
    let marketReads = 0;
    rpc.mockImplementation(async (name: string) => {
      if (name === "get_free_agency_market") {
        marketReads += 1;
        return { data: marketReads === 1 ? market : refreshedMarket, error: null };
      }
      if (name === "submit_free_agency_offer") return { data: submittedOffer, error: null };
      return { data: null, error: { message: `Unexpected RPC: ${name}` } };
    });
    const { result } = renderHook(
      () => ({ market: useFreeAgencyMarket(gameId), submit: useSubmitFreeAgencyOffer() }),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.market.data).toMatchObject({ gameId, supported: false })
    );

    await act(async () =>
      result.current.submit.mutateAsync({
        gameId,
        playerId,
        requestId,
        offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      })
    );

    expect(rpc).toHaveBeenCalledWith("submit_free_agency_offer", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_request_id: requestId,
      p_season: "2026-27",
      p_annual_salary: 2_625_627,
      p_years: 1,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_free_agency_market",
      "submit_free_agency_offer",
      "get_free_agency_market",
    ]);
    await waitFor(() =>
      expect(result.current.market.data?.offers).toMatchObject([
        { requestId, status: "pending", origin: "human", playerName: "First Player" },
      ])
    );
    expect(result.current.market.fetchStatus).toBe("idle");
  });

  it("blocks submission during any active simulation before making an RPC", async () => {
    useBatchSimulationStore.setState({ isActive: true });
    const { result } = renderHook(() => useSubmitFreeAgencyOffer(), { wrapper });

    await expect(
      result.current.mutateAsync({
        gameId,
        playerId,
        requestId,
        offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      })
    ).rejects.toThrow("A simulation is already active.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reconciles the market after an uncertain submission error", async () => {
    let marketReads = 0;
    rpc.mockImplementation(async (name: string) => {
      if (name === "get_free_agency_market") {
        marketReads += 1;
        return { data: marketReads === 1 ? market : refreshedMarket, error: null };
      }
      return { data: null, error: { message: "connection lost after submit" } };
    });
    const { result } = renderHook(
      () => ({ market: useFreeAgencyMarket(gameId), submit: useSubmitFreeAgencyOffer() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.market.data).toBeDefined());

    await expect(
      result.current.submit.mutateAsync({
        gameId,
        playerId,
        requestId,
        offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      })
    ).rejects.toThrow("connection lost after submit");

    await waitFor(() =>
      expect(result.current.market.data?.offers).toMatchObject([{ requestId, status: "pending" }])
    );
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_free_agency_market",
      "submit_free_agency_offer",
      "get_free_agency_market",
    ]);
  });

  it("does not retry market reads after an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "market unavailable" } });
    const { result } = renderHook(() => useFreeAgencyMarket(gameId), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
