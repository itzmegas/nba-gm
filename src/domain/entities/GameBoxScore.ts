export const BOX_SCORE_SIDE = { HOME: "home", AWAY: "away" } as const;
export type BoxScoreSide = (typeof BOX_SCORE_SIDE)[keyof typeof BOX_SCORE_SIDE];
export const POSSESSION_ENGINE_VERSION = { V1: "possessions-v1", V2: "possessions-v2" } as const;

export interface PlayerBoxScore {
  playerId: string;
  playerName: string;
  side: BoxScoreSide;
  seconds: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personalFouls: number;
  points: number;
}

export interface GameBoxScore {
  engineVersion: (typeof POSSESSION_ENGINE_VERSION)[keyof typeof POSSESSION_ENGINE_VERSION];
  overtimes: number;
  homeScore: number;
  awayScore: number;
  players: PlayerBoxScore[];
}
