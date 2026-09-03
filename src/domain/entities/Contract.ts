import { z } from "zod";

export interface Contract {
  id: string;
  gameId: string;
  playerId: string;
  teamId: string;
  startYear: number;
  endYear: number;
  salaryY1: number;
  salaryY2?: number;
  salaryY3?: number;
  salaryY4?: number;
  salaryY5?: number;
  isPlayerOption: boolean;
  isTeamOption: boolean;
  isGuaranteed: boolean | null;
  /** Derived read-only view over canonical game seasons; never persisted as canonical data. */
  compatibilityProjection?: "observed-season-coverage";
  createdAt: Date;
  updatedAt: Date;
}

export const contractSchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  playerId: z.uuid(),
  teamId: z.uuid(),
  startYear: z.number().int(),
  endYear: z.number().int(),
  salaryY1: z.number().int().nonnegative(),
  salaryY2: z.number().int().nonnegative().optional(),
  salaryY3: z.number().int().nonnegative().optional(),
  salaryY4: z.number().int().nonnegative().optional(),
  salaryY5: z.number().int().nonnegative().optional(),
  isPlayerOption: z.boolean(),
  isTeamOption: z.boolean(),
  isGuaranteed: z.boolean().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
