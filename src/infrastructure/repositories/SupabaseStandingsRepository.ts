import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { StandingsRepository } from "@/domain/repositories/StandingsRepository";

export class SupabaseStandingsRepository implements StandingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByGameId(gameId: string): Promise<LeagueStanding[]> {
    const { data, error } = await this.client
      .from("league_standings")
      .select("*")
      .eq("game_id", gameId)
      .order("wins", { ascending: false })
      .order("losses", { ascending: true });

    if (error) throw new Error(error.message);
    return data.map((row) => ({
      gameId: row.game_id as string,
      teamId: row.team_id as string,
      wins: row.wins as number,
      losses: row.losses as number,
    }));
  }
}
