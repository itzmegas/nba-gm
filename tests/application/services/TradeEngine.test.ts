import { describe, expect, it, vi } from "vitest";
import { TradeEngine } from "@/application/services/TradeEngine";
import type { Contract } from "@/domain/entities/Contract";
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

  it("uses the game season for simulation and execution validation", async () => {
    const execute = vi.fn();
    const repository: TradeRepository = { execute, getHistory: vi.fn(async () => []) };
    const engine = new TradeEngine(repository);
    const contract = (salaryY1: number): Contract => ({ salaryY1 }) as Contract;
    const teamA = {
      contracts: Array.from({ length: 15 }, () => contract(190_000_000 / 15)),
      rosterSize: 15,
    };
    const teamB = {
      contracts: Array.from({ length: 15 }, () => contract(190_000_000 / 15)),
      rosterSize: 15,
    };
    const packageA: TradePackage = {
      ...packageFor(IDS[2]),
      outgoingAssets: [{ type: "player", contract: contract(20_000_000) }],
    };
    const packageB: TradePackage = {
      ...packageFor(IDS[3]),
      outgoingAssets: [{ type: "player", contract: contract(22_000_000) }],
    };

    expect(engine.simulateTrade(IDS[1], teamA, teamB, packageA, packageB, 2026).isValid).toBe(true);
    const result = await engine.executeTrade(IDS[1], teamA, teamB, packageA, packageB, true, 2024);
    expect(result.success).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});
