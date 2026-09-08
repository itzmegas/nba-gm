import { describe, expect, it, vi } from "vitest";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { ExecutedTrade, TradePackage } from "@/domain/entities/Trade";
import type { TradeRepository } from "@/domain/repositories/TradeRepository";

const IDS = Array.from(
  { length: 4 },
  (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`
);
const packageFor = (teamId: string): TradePackage => ({
  teamId,
  teamName: teamId,
  outgoingAssets: [{ type: "pick", pickId: IDS[3] }],
  incomingAssets: [],
});

describe("TradeEngine", () => {
  it("delegates execution to the transactional repository", async () => {
    const trade: ExecutedTrade = {
      id: IDS[0],
      gameId: IDS[1],
      teamAId: IDS[2],
      teamBId: IDS[3],
      executedAt: new Date("2026-08-07T00:00:00Z"),
      assets: [],
    };
    const execute = vi.fn(async () => trade);
    const repository: TradeRepository = { execute, getHistory: vi.fn(async () => []) };
    const packageA = packageFor(IDS[2]);
    const packageB = packageFor(IDS[3]);

    const result = await new TradeEngine(repository).executeTrade(
      IDS[1],
      { contracts: [], rosterSize: 0 },
      { contracts: [], rosterSize: 0 },
      packageA,
      packageB,
      false
    );

    expect(execute).toHaveBeenCalledWith(IDS[1], IDS[2], IDS[3], packageA, packageB);
    expect(result).toMatchObject({ success: true, trade, executedAt: trade.executedAt });
  });
});
