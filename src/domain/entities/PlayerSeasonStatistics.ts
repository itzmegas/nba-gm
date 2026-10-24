import type { PlayerBoxScore } from "@/domain/entities/GameBoxScore";

export const SEASON_STATISTICS_PHASE = {
  REGULAR_SEASON: "regular_season",
  PLAY_IN: "play_in",
  PLAYOFFS: "playoffs",
} as const;

export type SeasonStatisticsPhase =
  (typeof SEASON_STATISTICS_PHASE)[keyof typeof SEASON_STATISTICS_PHASE];

export type PlayerStatTotals = Omit<PlayerBoxScore, "playerId" | "playerName" | "side">;

export interface PlayerSeasonStatistics {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  totals: PlayerStatTotals;
}

export interface SeasonStatistics {
  completedGames: number;
  coveredGames: number;
  players: PlayerSeasonStatistics[];
}
