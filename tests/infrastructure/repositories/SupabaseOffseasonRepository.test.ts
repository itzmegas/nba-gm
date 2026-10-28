import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseOffseasonRepository } from "@/infrastructure/repositories/SupabaseOffseasonRepository";

const gameId = "11111111-1111-4111-8111-111111111111";
const entry = { seasonYear: 2026, enteredAt: "2026-10-25T00:00:00.000Z" };

function setup(data: unknown = null, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  const from = vi.fn().mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return {
    repo: new SupabaseOffseasonRepository({ from, rpc } as unknown as SupabaseClient),
    from,
    rpc,
    query,
  };
}

describe("offseason repository", () => {
  it("accepts PostgreSQL timestamps with fractional seconds and UTC offsets", async () => {
    const persisted = { ...entry, enteredAt: "2026-10-25T00:00:00.123456+00:00" };
    await expect(setup(persisted).repo.enter(gameId, 2026)).resolves.toEqual(persisted);
  });

  it("reads only the requested career and completed season", async () => {
    const { repo, from, query } = setup({ season_year: 2026, entered_at: entry.enteredAt });
    await expect(repo.getEntry(gameId, 2026)).resolves.toEqual(entry);
    expect(from).toHaveBeenCalledExactlyOnceWith("game_offseasons");
    expect(query.eq.mock.calls).toEqual([
      ["game_id", gameId],
      ["season_year", 2026],
    ]);
    expect(query.select).toHaveBeenCalledWith("season_year, entered_at");
  });

  it("distinguishes an absent entry from a failed read", async () => {
    await expect(setup().repo.getEntry(gameId, 2026)).resolves.toBeNull();
    await expect(setup(null, { message: "denied" }).repo.getEntry(gameId, 2026)).rejects.toThrow(
      "Failed to load offseason entry"
    );
  });

  it("calls only the guarded entry RPC with validated input", async () => {
    const { repo, rpc, from } = setup(entry);
    await expect(repo.enter(gameId, 2026)).resolves.toEqual(entry);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("enter_offseason", {
      p_game_id: gameId,
      p_season_year: 2026,
    });
    expect(from).not.toHaveBeenCalled();
    await expect(repo.enter("invalid", 2026)).rejects.toThrow();
    await expect(repo.enter(gameId, 2026.5)).rejects.toThrow();
    await expect(repo.getEntry("invalid", 2026)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects errors and malformed or mismatched backend data", async () => {
    await expect(setup(null, { message: "no champion" }).repo.enter(gameId, 2026)).rejects.toThrow(
      "Failed to enter offseason"
    );
    for (const data of [null, { ...entry, enteredAt: "invalid" }, { ...entry, seasonYear: 2027 }])
      await expect(setup(data).repo.enter(gameId, 2026)).rejects.toThrow();
    for (const data of [
      { season_year: 2027, entered_at: entry.enteredAt },
      { season_year: 2026, entered_at: "invalid" },
    ])
      await expect(setup(data).repo.getEntry(gameId, 2026)).rejects.toThrow();
  });
});
