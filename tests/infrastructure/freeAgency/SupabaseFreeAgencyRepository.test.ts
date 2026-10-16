import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseFreeAgencyRepository } from "@/infrastructure/freeAgency/SupabaseFreeAgencyRepository";

const validOfferRow = {
  id: "00000000-0000-4000-8000-000000000001",
  request_id: "00000000-0000-4000-8000-000000000002",
  game_id: "00000000-0000-4000-8000-000000000003",
  player_id: "00000000-0000-4000-8000-000000000004",
  team_id: "00000000-0000-4000-8000-000000000005",
  season: "2026-27",
  annual_salary: 2_625_627,
  years: 1,
  due_date: "2026-10-03",
  status: "pending",
};
const gameId = validOfferRow.game_id;
const validMarket = {
  game_id: gameId,
  supported: true,
  context: {
    team_id: validOfferRow.team_id,
    season: "2026-27",
    simulation_date: "2026-10-02",
    salary_cap: 154_647_000,
    payroll: 120_000_000,
    cap_room: 34_647_000,
    roster_count: 14,
  },
  candidates: [
    {
      player_id: validOfferRow.player_id,
      first_name: "First",
      last_name: "Player",
      position: "PG",
      minimum_salary: 2_625_627,
      maximum_salary: 46_394_100,
    },
  ],
  offers: [
    {
      ...validOfferRow,
      owner_id: "00000000-0000-4000-8000-000000000006",
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

function repositoryForRpc(rpc: ReturnType<typeof vi.fn>): SupabaseFreeAgencyRepository {
  return new SupabaseFreeAgencyRepository({ rpc } as unknown as SupabaseClient);
}

describe("SupabaseFreeAgencyRepository", () => {
  it("maps a pending offer and calls the authoritative submission RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validOfferRow, error: null });
    const repository = repositoryForRpc(rpc);

    await expect(
      repository.submitOffer({
        gameId: validOfferRow.game_id,
        playerId: validOfferRow.player_id,
        requestId: validOfferRow.request_id,
        offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      })
    ).resolves.toEqual({
      id: validOfferRow.id,
      requestId: validOfferRow.request_id,
      gameId: validOfferRow.game_id,
      playerId: validOfferRow.player_id,
      teamId: validOfferRow.team_id,
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      dueDate: "2026-10-03",
      status: "pending",
    });
    expect(rpc).toHaveBeenCalledWith("submit_free_agency_offer", {
      p_game_id: validOfferRow.game_id,
      p_player_id: validOfferRow.player_id,
      p_request_id: validOfferRow.request_id,
      p_season: "2026-27",
      p_annual_salary: 2_625_627,
      p_years: 1,
    });
  });

  it("lists only schema-validated pending offer records", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [validOfferRow], error: null });
    const repository = repositoryForRpc(rpc);

    await expect(repository.listPendingOffers(validOfferRow.game_id)).resolves.toHaveLength(1);
    await expect(
      repositoryForRpc(
        vi.fn().mockResolvedValue({ data: [{ ...validOfferRow, status: "signed" }], error: null })
      ).listPendingOffers(validOfferRow.game_id)
    ).rejects.toThrow();
  });

  it("maps a fully validated scoped market snapshot and validates terminal rows", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validMarket, error: null });
    const repository = repositoryForRpc(rpc);

    await expect(repository.getMarket(gameId)).resolves.toEqual({
      gameId,
      supported: true,
      context: {
        teamId: validOfferRow.team_id,
        season: "2026-27",
        simulationDate: "2026-10-02",
        salaryCap: 154_647_000,
        payroll: 120_000_000,
        capRoom: 34_647_000,
        rosterCount: 14,
      },
      candidates: [
        {
          playerId: validOfferRow.player_id,
          firstName: "First",
          lastName: "Player",
          position: "PG",
          minimumSalary: 2_625_627,
          maximumSalary: 46_394_100,
        },
      ],
      offers: [
        {
          id: validOfferRow.id,
          requestId: validOfferRow.request_id,
          gameId,
          playerId: validOfferRow.player_id,
          teamId: validOfferRow.team_id,
          offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
          dueDate: "2026-10-03",
          status: "pending",
          origin: "human",
          playerName: "First Player",
          teamName: "Example Team",
          resolvedDate: null,
          resolutionReason: null,
          resolutionDetail: null,
          resolvedContractId: null,
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("get_free_agency_market", { p_game_id: gameId });

    const terminal = {
      ...validMarket,
      offers: [
        {
          ...validMarket.offers[0],
          status: "accepted",
          resolved_at: "2026-10-03T00:00:00Z",
          resolved_date: "2026-10-03",
          resolution_reason: "selected_offer_accepted",
          resolved_contract_id: "00000000-0000-4000-8000-000000000007",
        },
      ],
    };
    await expect(
      repositoryForRpc(vi.fn().mockResolvedValue({ data: terminal, error: null })).getMarket(gameId)
    ).resolves.toMatchObject({ offers: [{ status: "accepted" }] });

    const rejected = {
      ...validMarket,
      offers: [
        {
          ...validMarket.offers[0],
          status: "rejected",
          resolved_at: "2026-10-03T00:00:00Z",
          resolved_date: "2026-10-03",
          resolution_reason: "offer_no_longer_legal",
          resolution_detail: "Roster maximum reached",
        },
      ],
    };
    await expect(
      repositoryForRpc(vi.fn().mockResolvedValue({ data: rejected, error: null })).getMarket(gameId)
    ).resolves.toMatchObject({ offers: [{ status: "rejected" }] });
  });

  it.each([
    ["foreign game", { ...validMarket, game_id: "00000000-0000-4000-8000-000000000009" }],
    [
      "foreign offer",
      {
        ...validMarket,
        offers: [{ ...validMarket.offers[0], game_id: "00000000-0000-4000-8000-000000000009" }],
      },
    ],
    [
      "unsafe candidate salary",
      {
        ...validMarket,
        candidates: [{ ...validMarket.candidates[0], maximum_salary: Number.MAX_SAFE_INTEGER + 1 }],
      },
    ],
    [
      "invalid origin",
      { ...validMarket, offers: [{ ...validMarket.offers[0], offer_origin: "system" }] },
    ],
    [
      "inconsistent terminal contract",
      {
        ...validMarket,
        offers: [
          {
            ...validMarket.offers[0],
            status: "accepted",
            resolved_at: "2026-10-03T00:00:00Z",
            resolved_date: "2026-10-03",
            resolution_reason: "selected_offer_accepted",
            resolved_contract_id: null,
          },
        ],
      },
    ],
    [
      "missing terminal date",
      {
        ...validMarket,
        offers: [
          {
            ...validMarket.offers[0],
            status: "rejected",
            resolved_at: "2026-10-03T00:00:00Z",
            resolved_date: null,
            resolution_reason: "another_offer_accepted",
          },
        ],
      },
    ],
    [
      "inconsistent terminal reason and detail",
      {
        ...validMarket,
        offers: [
          {
            ...validMarket.offers[0],
            status: "rejected",
            resolved_at: "2026-10-03T00:00:00Z",
            resolved_date: "2026-10-03",
            resolution_reason: "another_offer_accepted",
            resolution_detail: "Not allowed",
          },
        ],
      },
    ],
    ["supported market without context", { ...validMarket, context: null }],
  ])("rejects %s market payloads", async (_label, response) => {
    await expect(
      repositoryForRpc(vi.fn().mockResolvedValue({ data: response, error: null })).getMarket(gameId)
    ).rejects.toThrow();
  });

  it("propagates market RPC errors and rejects missing payloads", async () => {
    await expect(
      repositoryForRpc(
        vi.fn().mockResolvedValue({ data: null, error: { message: "market denied" } })
      ).getMarket(gameId)
    ).rejects.toThrow("market denied");
    await expect(
      repositoryForRpc(vi.fn().mockResolvedValue({ data: null, error: null })).getMarket(gameId)
    ).rejects.toThrow();
  });

  it("rejects malformed inputs and propagates RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: validOfferRow, error: null });
    const repository = repositoryForRpc(rpc);

    await expect(
      repository.submitOffer({
        gameId: "not-a-uuid",
        playerId: validOfferRow.player_id,
        requestId: validOfferRow.request_id,
        offer: { season: "2026-27", annualSalary: 1, years: 1 },
      })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    await expect(
      repositoryForRpc(
        vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } })
      ).listPendingOffers(validOfferRow.game_id)
    ).rejects.toThrow("denied");
  });
});
