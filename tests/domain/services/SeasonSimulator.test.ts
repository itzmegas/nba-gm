import { describe, expect, it } from "vitest";
import { SeasonSimulator } from "@/domain/services/SeasonSimulator";

describe("SeasonSimulator", () => {
  it("replays the same game deterministically", () => {
    const seed = SeasonSimulator.computeSeed("game", "2026-10-15", "home", "away");

    expect(SeasonSimulator.simulateGame(80, 75, seed)).toEqual(
      SeasonSimulator.simulateGame(80, 75, seed)
    );
  });

  it("keeps the home-court advantage over repeated games", () => {
    let homeWins = 0;

    for (let seed = 0; seed < 1000; seed += 1) {
      const result = SeasonSimulator.simulateGame(75, 75, seed);
      if (result.homeScore > result.awayScore) homeWins += 1;
    }

    expect(homeWins).toBeGreaterThan(500);
  });
});
