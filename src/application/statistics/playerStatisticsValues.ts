import type { PlayerSeasonStatistics } from "@/domain/entities/PlayerSeasonStatistics";

export function playerStatisticsValues(player: PlayerSeasonStatistics, perGame: boolean) {
  const t = player.totals;
  const d = perGame ? player.gamesPlayed : 1;
  const percentage = (made: number, attempted: number) =>
    attempted > 0 ? (100 * made) / attempted : null;
  return {
    gamesPlayed: player.gamesPlayed,
    minutes: t.seconds / 60 / d,
    points: t.points / d,
    offensiveRebounds: t.offensiveRebounds / d,
    defensiveRebounds: t.defensiveRebounds / d,
    rebounds: (t.offensiveRebounds + t.defensiveRebounds) / d,
    assists: t.assists / d,
    steals: t.steals / d,
    blocks: t.blocks / d,
    turnovers: t.turnovers / d,
    personalFouls: t.personalFouls / d,
    fieldGoalsMade: t.fieldGoalsMade / d,
    fieldGoalsAttempted: t.fieldGoalsAttempted / d,
    threePointersMade: t.threePointersMade / d,
    threePointersAttempted: t.threePointersAttempted / d,
    freeThrowsMade: t.freeThrowsMade / d,
    freeThrowsAttempted: t.freeThrowsAttempted / d,
    fieldGoalPercentage: percentage(t.fieldGoalsMade, t.fieldGoalsAttempted),
    threePointPercentage: percentage(t.threePointersMade, t.threePointersAttempted),
    freeThrowPercentage: percentage(t.freeThrowsMade, t.freeThrowsAttempted),
  };
}
