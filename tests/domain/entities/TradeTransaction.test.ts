import { describe, expect, it } from "vitest";
import { executedTradeSchema, tradeAssetInputSchema } from "@/domain/entities";

const IDS = {
  trade: "11111111-1111-4111-8111-111111111111",
  game: "22222222-2222-4222-8222-222222222222",
  teamA: "33333333-3333-4333-8333-333333333333",
  teamB: "44444444-4444-4444-8444-444444444444",
  player: "55555555-5555-4555-8555-555555555555",
  pick: "66666666-6666-4666-8666-666666666666",
} as const;

describe("trade transaction boundary schemas", () => {
  it("accepts a player transfer input and executed history", () => {
    expect(
      tradeAssetInputSchema.parse({
        assetType: "player",
        assetId: IDS.player,
        fromTeamId: IDS.teamA,
      })
    ).toMatchObject({ assetType: "player" });

    expect(
      executedTradeSchema.parse({
        id: IDS.trade,
        gameId: IDS.game,
        teamAId: IDS.teamA,
        teamBId: IDS.teamB,
        executedAt: new Date(),
        assets: [
          {
            assetType: "player",
            assetId: IDS.player,
            fromTeamId: IDS.teamA,
            toTeamId: IDS.teamB,
            playerId: IDS.player,
          },
        ],
      })
    ).toHaveProperty("assets", expect.any(Array));
  });

  it("rejects cash and malformed history assets", () => {
    expect(() =>
      tradeAssetInputSchema.parse({ assetType: "cash", assetId: IDS.player, fromTeamId: IDS.teamA })
    ).toThrow();
    expect(() =>
      executedTradeSchema.parse({
        id: IDS.trade,
        gameId: IDS.game,
        teamAId: IDS.teamA,
        teamBId: IDS.teamB,
        executedAt: new Date(),
        assets: [
          {
            assetType: "player",
            assetId: IDS.player,
            fromTeamId: IDS.teamA,
            toTeamId: IDS.teamB,
          },
        ],
      })
    ).toThrow();
    expect(() =>
      executedTradeSchema.parse({
        id: IDS.trade,
        gameId: IDS.game,
        teamAId: IDS.teamA,
        teamBId: IDS.teamB,
        executedAt: new Date(),
        assets: [
          {
            assetType: "pick",
            assetId: IDS.pick,
            fromTeamId: IDS.teamA,
            toTeamId: IDS.teamB,
          },
        ],
      })
    ).toThrow();
  });
});
