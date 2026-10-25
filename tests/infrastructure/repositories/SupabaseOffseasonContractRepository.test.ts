import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseOffseasonContractRepository } from "@/infrastructure/repositories/SupabaseOffseasonContractRepository";

const gameId = "8d2d44b9-9634-4a74-94fc-0732825122e8";
const playerId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const row = {
  player_id: playerId,
  team_id: teamId,
  season_year: 2026,
  classification: "team_option",
  decision: null,
  next_salary: 100,
};
function setup(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const query = { select: vi.fn(), eq: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  const from = vi.fn().mockReturnValue(query);
  return {
    repo: new SupabaseOffseasonContractRepository({ rpc, from } as unknown as SupabaseClient),
    rpc,
    from,
  };
}
describe("offseason ledger boundary", () => {
  it("reads only the separate game/year ledger", async () => {
    const { repo, from, rpc } = setup([row]);
    expect(await repo.get(gameId, 2026)).toEqual([
      {
        playerId,
        teamId,
        seasonYear: 2026,
        status: "team_option",
        decision: null,
        nextSalary: 100,
      },
    ]);
    expect(from).toHaveBeenCalledWith("game_offseason_contracts");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("prepares explicitly and validates RPC output", async () => {
    const { repo, rpc } = setup([row]);
    await repo.prepare(gameId, 2026);
    expect(rpc).toHaveBeenCalledWith("prepare_offseason_contracts", {
      p_game_id: gameId,
      p_season_year: 2026,
    });
    await expect(
      setup([{ ...row, season_year: 2027 }]).repo.prepare(gameId, 2026)
    ).rejects.toThrow();
  });
  it("validates decision input before sending and verifies the saved decision", async () => {
    const { repo, rpc } = setup({ ...row, decision: "exercise" });
    await expect(repo.decide("bad", 2026, playerId, "exercise")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect((await repo.decide(gameId, 2026, playerId, "exercise")).decision).toBe("exercise");
    await expect(setup(row).repo.decide(gameId, 2026, playerId, "exercise")).rejects.toThrow();
  });
  it.each([
    { data: [{ ...row, next_salary: -1 }] },
    { data: [{ ...row, classification: "unknown" }] },
    { data: [row, row] },
  ])("rejects malformed or duplicate rows", async ({ data }) => {
    await expect(setup(data).repo.get(gameId, 2026)).rejects.toThrow();
  });
  it("propagates backend failures", async () => {
    await expect(setup(null, { message: "denied" }).repo.prepare(gameId, 2026)).rejects.toThrow(
      "Unable to prepare"
    );
  });
});
