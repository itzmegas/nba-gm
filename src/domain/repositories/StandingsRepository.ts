import type { LeagueStanding } from "@/domain/entities/LeagueStanding";

export interface StandingsRepository {
  getByGameId(gameId: string): Promise<LeagueStanding[]>;
}
