import { z } from "zod";

export interface PlayerState {
  id: string;
  gameId: string;
  playerId: string;
  teamId?: string;
  morale: number;
  fatigue: number;
  isActive: boolean;
  isInjured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const playerStateSchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  playerId: z.uuid(),
  teamId: z.uuid().optional(),
  morale: z.number().int().min(0).max(100),
  fatigue: z.number().int().min(0).max(100),
  isActive: z.boolean(),
  isInjured: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
