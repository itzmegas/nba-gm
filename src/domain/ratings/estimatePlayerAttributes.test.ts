import { describe, expect, it, vi } from "vitest";
import { estimatePlayerAttributes } from "@/domain/ratings/estimatePlayerAttributes";

describe("estimatePlayerAttributes", () => {
  it("repeats the same initial estimate for the same canonical player", () => {
    expect(estimatePlayerAttributes("player-one", "PG")).toEqual(
      estimatePlayerAttributes("player-one", "PG")
    );
    expect(estimatePlayerAttributes("player-two", "PG")).not.toEqual(
      estimatePlayerAttributes("player-one", "PG")
    );
  });

  it.each([
    "PG",
    "SG",
    "G",
    "SF",
    "PF",
    "C",
    "F",
    "G-F",
    "F-C",
    null,
    "unknown",
  ])("produces all 14 bounded integer attributes for position %s", (position) => {
    for (let index = 0; index < 50; index += 1) {
      const attributes = estimatePlayerAttributes(`player-${index}`, position);
      expect(Object.keys(attributes)).toHaveLength(14);
      for (const value of Object.values(attributes)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(99);
      }
    }
  });

  it("gives guards and bigs distinct replacement-level profiles", () => {
    const guard = estimatePlayerAttributes("player-one", "PG");
    const big = estimatePlayerAttributes("player-one", "C");
    expect(guard.ballHandle).toBeGreaterThan(big.ballHandle);
    expect(guard.threePointShot).toBeGreaterThan(big.threePointShot);
    expect(big.interiorDefense).toBeGreaterThan(guard.interiorDefense);
    expect(big.defensiveRebound).toBeGreaterThan(guard.defensiveRebound);
  });

  it("normalizes primary positions without sharing mutable attribute objects", () => {
    const first = estimatePlayerAttributes("player-one", " pg-sg ");
    const second = estimatePlayerAttributes("player-one", "PG");
    expect(first).toEqual(second);
    first.ballHandle = 0;
    expect(estimatePlayerAttributes("player-one", "PG")).toEqual(second);
  });

  it("does not depend on real time or random state", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Random state must not be used");
    });
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Real time must not be used");
    });
    try {
      expect(Object.keys(estimatePlayerAttributes("player-one", null))).toHaveLength(14);
    } finally {
      random.mockRestore();
      clock.mockRestore();
    }
  });
});
