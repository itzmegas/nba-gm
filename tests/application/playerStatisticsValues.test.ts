import { describe, expect, it } from "vitest";
import { playerStatisticsValues } from "@/application/statistics/playerStatisticsValues";
import type { PlayerSeasonStatistics } from "@/domain/entities/PlayerSeasonStatistics";

const player: PlayerSeasonStatistics = {
  playerId: "a0000000-0000-4000-8000-000000000001",
  playerName: "Test Player",
  gamesPlayed: 2,
  totals: {
    seconds: 3600,
    points: 25,
    fieldGoalsMade: 10,
    fieldGoalsAttempted: 25,
    threePointersMade: 5,
    threePointersAttempted: 10,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 2,
    defensiveRebounds: 8,
    assists: 6,
    steals: 2,
    blocks: 1,
    turnovers: 4,
    personalFouls: 5,
  },
};

describe("season statistics presentation", () => {
  it("keeps totals, derives minutes and combines rebounds", () => {
    expect(playerStatisticsValues(player, false)).toMatchObject({
      gamesPlayed: 2,
      points: 25,
      minutes: 60,
      rebounds: 10,
    });
  });
  it("divides by appearances, not fixtures, and keeps GP and percentages unchanged", () => {
    expect(playerStatisticsValues(player, true)).toMatchObject({
      gamesPlayed: 2,
      points: 12.5,
      minutes: 30,
      rebounds: 5,
      fieldGoalPercentage: 40,
      threePointPercentage: 50,
    });
  });
  it("does not invent a percentage without attempts", () => {
    expect(playerStatisticsValues(player, true).freeThrowPercentage).toBeNull();
  });
});
