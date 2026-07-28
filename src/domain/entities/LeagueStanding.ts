import { z } from "zod";

export interface LeagueStanding {
  gameId: string;
  teamId: string;
  wins: number;
  losses: number;
}

export const leagueStandingSchema = z.object({
  gameId: z.uuid(),
  teamId: z.uuid(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
});
