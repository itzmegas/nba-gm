import { BOX_SCORE_SIDE, type GameBoxScore } from "@/domain/entities/GameBoxScore";

export function boxScoreFixture(): GameBoxScore {
  return {
    engineVersion: "possessions-v1",
    overtimes: 0,
    homeScore: 10,
    awayScore: 8,
    players: Array.from({ length: 10 }, (_, index) => ({
      playerId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      playerName: `Player ${index + 1}`,
      side: index < 5 ? BOX_SCORE_SIDE.HOME : BOX_SCORE_SIDE.AWAY,
      seconds: 2880,
      fieldGoalsMade: index === 0 ? 5 : index === 5 ? 4 : 0,
      fieldGoalsAttempted: index === 0 ? 8 : index === 5 ? 9 : 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      personalFouls: 0,
      points: index === 0 ? 10 : index === 5 ? 8 : 0,
    })),
  };
}
