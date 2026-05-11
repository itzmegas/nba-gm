import { z } from "zod";

export const GAME_STATUS = {
  INITIALIZING: "initializing",
  ACTIVE: "active",
  ARCHIVED: "archived",
  DELETED: "deleted",
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

export interface Game {
  id: string;
  userId: string;
  name: string;
  selectedTeamId: string;
  seasonYear: number;
  simulationDate: Date;
  status: GameStatus;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const gameStatusValues = Object.values(GAME_STATUS) as [GameStatus, ...GameStatus[]];

export const gameSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    name: z.string({ error: "Game name is required" }).min(1).max(80),
    selectedTeamId: z.uuid(),
    seasonYear: z.number().int(),
    simulationDate: z.date(),
    status: z.enum(gameStatusValues),
    deletedAt: z.date().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .refine(
    (game) => {
      if (game.status === GAME_STATUS.DELETED) {
        return game.deletedAt instanceof Date;
      }

      return game.deletedAt === undefined;
    },
    {
      error: "Deleted games require deletedAt, other statuses must not include deletedAt",
      path: ["deletedAt"],
    }
  );
