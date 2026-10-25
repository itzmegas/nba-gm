import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseOffseasonPlayerOptionRepository } from "@/infrastructure/repositories/SupabaseOffseasonPlayerOptionRepository";

const gameId = "8d2d44b9-9634-4a74-94fc-0732825122e8";
const playerId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const row = {
  game_id: gameId,
  season_year: 2026,
  player_id: playerId,
  team_id: teamId,
  current_salary: 100,
  next_salary: 120,
  decision: "exercise",
  reason: "salary_not_lower",
  policy_version: "salary-comparison-v1",
  resolved_at: "2027-06-10T00:00:00+00:00",
};
function setup(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const query = { select: vi.fn(), eq: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  const from = vi.fn().mockReturnValue(query);
  return {
    repo: new SupabaseOffseasonPlayerOptionRepository({ rpc, from } as unknown as SupabaseClient),
    rpc,
    from,
    query,
  };
}
describe("player-option boundary", () => {
  it("reads only the separate game/year resolution ledger without writes", async () => {
    const { repo, from, rpc, query } = setup([row]);
    expect(await repo.get(gameId, 2026)).toEqual([
      {
        gameId,
        seasonYear: 2026,
        playerId,
        teamId,
        currentSalary: 100,
        nextSalary: 120,
        decision: "exercise",
        reason: "salary_not_lower",
        policyVersion: "salary-comparison-v1",
        resolvedAt: row.resolved_at,
      },
    ]);
    expect(from).toHaveBeenCalledWith("game_offseason_player_options");
    expect(query.eq.mock.calls).toEqual([
      ["game_id", gameId],
      ["season_year", 2026],
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("sends only game/year to the server and accepts no new resolutions", async () => {
    const { repo, rpc } = setup([]);
    expect(await repo.resolve(gameId, 2026)).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("resolve_offseason_player_options", {
      p_game_id: gameId,
      p_season_year: 2026,
    });
  });
  it.each([
    { current_salary: 0, next_salary: 0 },
    { current_salary: Number.MAX_SAFE_INTEGER, next_salary: Number.MAX_SAFE_INTEGER },
    { current_salary: 100, next_salary: 0, decision: "decline", reason: "salary_lower" },
  ])("accepts safe known salaries including zero: %j", async (values) => {
    expect(await setup([{ ...row, ...values }]).repo.resolve(gameId, 2026)).toHaveLength(1);
  });
  it.each([
    { game_id: playerId },
    { season_year: 2027 },
    { player_id: "bad" },
    { team_id: "bad" },
    { current_salary: null },
    { next_salary: null },
    { current_salary: -1 },
    { next_salary: 0.5 },
    { next_salary: Number.MAX_SAFE_INTEGER + 1 },
    { current_salary: Number.NaN },
    { decision: "pending" },
    { reason: "unknown" },
    { reason: "salary_lower" },
    { policy_version: "future-policy" },
    { resolved_at: "yesterday" },
  ])("rejects malformed or mismatched output for reads and resolutions: %j", async (values) => {
    await expect(setup([{ ...row, ...values }]).repo.get(gameId, 2026)).rejects.toThrow();
    await expect(setup([{ ...row, ...values }]).repo.resolve(gameId, 2026)).rejects.toThrow();
  });
  it.each([null, row, [row, row]])("rejects invalid result shape or duplicates", async (data) => {
    await expect(setup(data).repo.resolve(gameId, 2026)).rejects.toThrow();
  });
  it.each([
    ["bad", 2026],
    [gameId, 0],
    [gameId, 2026.5],
    [gameId, 9999],
  ] as const)("rejects invalid game/year before querying: %s/%s", async (game, season) => {
    const { repo, rpc, from } = setup([]);
    await expect(repo.get(game, season)).rejects.toThrow();
    await expect(repo.resolve(game, season)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
  it("propagates read and RPC failures", async () => {
    await expect(setup(null, { message: "denied" }).repo.get(gameId, 2026)).rejects.toThrow(
      "Unable to load"
    );
    await expect(setup(null, { message: "denied" }).repo.resolve(gameId, 2026)).rejects.toThrow(
      "Unable to resolve"
    );
  });
});
