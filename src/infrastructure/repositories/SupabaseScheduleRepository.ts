import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduledGame } from "@/domain/entities/ScheduledGame";
import type { ScheduleRepository } from "@/domain/repositories/ScheduleRepository";

export class SupabaseScheduleRepository implements ScheduleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getForTeamOnDate(
    gameId: string,
    teamId: string,
    simulationDate: Date
  ): Promise<ScheduledGame | null> {
    const { data, error } = await this.client
      .from("scheduled_games")
      .select("*")
      .eq("game_id", gameId)
      .eq("game_date", simulationDate.toISOString().slice(0, 10))
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? this.mapToEntity(data) : null;
  }

  async getNextForTeam(
    gameId: string,
    teamId: string,
    simulationDate: Date
  ): Promise<ScheduledGame | null> {
    const { data, error } = await this.client
      .from("scheduled_games")
      .select("*")
      .eq("game_id", gameId)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq("status", "scheduled")
      .gt("game_date", simulationDate.toISOString().slice(0, 10))
      .order("game_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToEntity(data);
  }

  async getByGameId(gameId: string): Promise<ScheduledGame[]> {
    const { data, error } = await this.client
      .from("scheduled_games")
      .select("*")
      .eq("game_id", gameId)
      .order("game_date", { ascending: true });

    if (error) throw new Error(error.message);
    return data.map(this.mapToEntity);
  }

  private mapToEntity(row: Record<string, unknown>): ScheduledGame {
    return {
      id: row.id as string,
      gameId: row.game_id as string,
      date: row.game_date as string,
      homeTeamId: row.home_team_id as string,
      awayTeamId: row.away_team_id as string,
      status: row.status as ScheduledGame["status"],
      homeScore: row.home_score as number | undefined,
      awayScore: row.away_score as number | undefined,
    };
  }
}
