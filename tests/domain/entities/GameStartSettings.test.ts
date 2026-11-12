import { describe, expect, it } from "vitest";
import { GAME_START_MODE, getGameStartCutoff } from "@/domain/entities/GameStartSettings";

describe("game start cutoffs", () => {
  it.each([
    ["2026-11-12T18:00:00Z", "2026-11-12T05:00:00Z"],
    ["2026-07-12T18:00:00Z", "2026-07-12T04:00:00Z"],
    ["2026-11-12T02:00:00Z", "2026-11-11T05:00:00Z"],
    ["2026-03-08T18:00:00Z", "2026-03-08T05:00:00Z"],
    ["2026-11-01T18:00:00Z", "2026-11-01T04:00:00Z"],
    ["2026-01-01T02:00:00Z", "2025-12-31T05:00:00Z"],
  ])("starts today at New York midnight for %s", (instant, cutoff) => {
    const now = new Date(instant);
    expect(getGameStartCutoff(GAME_START_MODE.TODAY, now).toISOString()).toBe(
      new Date(cutoff).toISOString()
    );
    expect(now.toISOString()).toBe(new Date(instant).toISOString());
  });

  it("uses the approved 2026-27 opening cutoff, not the team's first game", () => {
    expect(
      getGameStartCutoff(GAME_START_MODE.SEASON_START, new Date("2026-11-12")).toISOString()
    ).toBe("2026-10-20T04:00:00.000Z");
  });

  it("rejects an invalid clock instead of returning a misleading cutoff", () => {
    expect(() => getGameStartCutoff(GAME_START_MODE.TODAY, new Date(Number.NaN))).toThrow(
      "Invalid creation time"
    );
  });
});
