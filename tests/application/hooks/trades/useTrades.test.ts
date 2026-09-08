import { describe, expect, it } from "vitest";
import { hasBilateralTradeAssets } from "@/application/hooks/trades/useTrades";
import type { TradePackage } from "@/domain/entities/Trade";

function tradePackage(assetCount: number): TradePackage {
  return {
    teamId: crypto.randomUUID(),
    teamName: "Test Team",
    outgoingAssets: Array.from({ length: assetCount }, () => ({
      type: "pick" as const,
      pickId: crypto.randomUUID(),
    })),
    incomingAssets: [],
  };
}

describe("hasBilateralTradeAssets", () => {
  it("does not validate the initial empty state", () => {
    expect(hasBilateralTradeAssets(tradePackage(0), tradePackage(0))).toBe(false);
  });

  it("does not validate a unilateral selection", () => {
    expect(hasBilateralTradeAssets(tradePackage(1), tradePackage(0))).toBe(false);
  });

  it("validates a bilateral trade", () => {
    expect(hasBilateralTradeAssets(tradePackage(1), tradePackage(1))).toBe(true);
  });
});
