import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/domain/entities/Player";
import type { PlayerRepository } from "@/domain/repositories/PlayerRepository";

export class SupabasePlayerRepository implements PlayerRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<Player[]> {
    const { data, error } = await this.client
      .from("players")
      .select("*")
      .order("last_name", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getById(id: string): Promise<Player | null> {
    const { data, error } = await this.client.from("players").select("*").eq("id", id).single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByTeamId(teamId: string): Promise<Player[]> {
    // Deprecated for gameplay roster reads: use PlayerStateRepository (game-scoped source of truth).
    // Kept for static/ETL flows where players.team_id remains useful.
    const { data, error } = await this.client
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getByNbaId(nbaId: number): Promise<Player | null> {
    const { data, error } = await this.client
      .from("players")
      .select("*")
      .eq("nba_id", nbaId)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getActivePlayers(): Promise<Player[]> {
    const { data, error } = await this.client
      .from("players")
      .select("*")
      .eq("is_active", true)
      .order("last_name", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  private mapToEntity(row: Record<string, unknown>): Player {
    const nbaId = row.nba_id as number;
    return {
      id: row.id as string,
      nbaId,
      teamId: row.team_id as string | undefined,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      fullName: row.full_name as string,
      position: row.position as Player["position"],
      height: row.height as string | undefined,
      weight: row.weight as string | undefined,
      jerseyNumber: row.jersey_number as string | undefined,
      headshotUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`,
      yearsOfExperience: row.years_of_experience as number,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
