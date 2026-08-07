import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseTradeRepository } from "@/infrastructure/repositories/SupabaseTradeRepository";

const IDS = {
  trade: "11111111-1111-4111-8111-111111111111",
  game: "22222222-2222-4222-8222-222222222222",
  teamA: "33333333-3333-4333-8333-333333333333",
  teamB: "44444444-4444-4444-8444-444444444444",
  player: "55555555-5555-4555-8555-555555555555",
} as const;

const historyRow = {
  id: IDS.trade,
  game_id: IDS.game,
  team_a_id: IDS.teamA,
  team_b_id: IDS.teamB,
  executed_at: "2026-01-01T00:00:00.000Z",
  trade_asset_snapshots: [
    {
      asset_type: "player",
      asset_id: IDS.player,
      from_team_id: IDS.teamA,
      to_team_id: IDS.teamB,
      metadata: { player_id: IDS.player },
    },
  ],
};

describe("SupabaseTradeRepository", () => {
  it("maps history and sends both packages to the transactional RPC", async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: [historyRow], error: null })),
    };
    const client = {
      from: () => query,
      rpc: (_name: string, args: Record<string, unknown>) => {
        rpcArgs = args;
        return Promise.resolve({ data: IDS.trade, error: null });
      },
    } as unknown as SupabaseClient;
    const repository = new SupabaseTradeRepository(client);

    const result = await repository.execute(
      IDS.game,
      IDS.teamA,
      IDS.teamB,
      {
        teamId: IDS.teamA,
        teamName: "A",
        outgoingAssets: [
          {
            type: "player" as const,
            player: {
              id: IDS.player,
              nbaId: 1,
              firstName: "A",
              lastName: "Player",
              fullName: "A Player",
              yearsOfExperience: 1,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        incomingAssets: [],
      },
      {
        teamId: IDS.teamB,
        teamName: "B",
        outgoingAssets: [
          {
            type: "player" as const,
            player: {
              id: IDS.player,
              nbaId: 1,
              firstName: "A",
              lastName: "Player",
              fullName: "A Player",
              yearsOfExperience: 1,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        incomingAssets: [],
      }
    );

    expect(result.assets[0].playerId).toBe(IDS.player);
    expect(rpcArgs).toMatchObject({ p_game_id: IDS.game, p_team_a_id: IDS.teamA });
    expect(rpcArgs?.p_assets).toEqual([
      { asset_type: "player", asset_id: IDS.player, from_team_id: IDS.teamA },
      { asset_type: "player", asset_id: IDS.player, from_team_id: IDS.teamB },
    ]);
  });
});
