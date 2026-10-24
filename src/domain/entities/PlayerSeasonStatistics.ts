import type { PlayerBoxScore } from "@/domain/entities/GameBoxScore";

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
