import type { ScheduledGame } from "@/domain/entities/ScheduledGame";

export interface ScheduleRepository {
  getForTeamOnDate(
    gameId: string,
    teamId: string,
    simulationDate: Date
  ): Promise<ScheduledGame | null>;
  getNextForTeam(
    gameId: string,
    teamId: string,
    simulationDate: Date
  ): Promise<ScheduledGame | null>;
  getByGameId(gameId: string): Promise<ScheduledGame[]>;
}
