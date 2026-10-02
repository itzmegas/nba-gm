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
