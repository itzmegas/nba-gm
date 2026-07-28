import { z } from "zod";

export const SCHEDULED_GAME_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
} as const;

export type ScheduledGameStatus =
  (typeof SCHEDULED_GAME_STATUS)[keyof typeof SCHEDULED_GAME_STATUS];

export interface ScheduledGame {
  id: string;
  gameId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  status: ScheduledGameStatus;
  homeScore?: number;
  awayScore?: number;
}

const scheduledGameStatusValues = Object.values(SCHEDULED_GAME_STATUS) as [
  ScheduledGameStatus,
  ...ScheduledGameStatus[],
];

export const scheduledGameSchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  date: z.iso.date(),
  homeTeamId: z.uuid(),
  awayTeamId: z.uuid(),
  status: z.enum(scheduledGameStatusValues),
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
});
