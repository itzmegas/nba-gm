import type { SupabaseClient } from "@supabase/supabase-js";
import type { Team } from "@/domain/entities/Team";
import type { TeamRepository } from "@/domain/repositories/TeamRepository";

export class SupabaseTeamRepository implements TeamRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<Team[]> {
    const { data, error } = await this.client
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getById(id: string): Promise<Team | null> {
    const { data, error } = await this.client
      .from("teams")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByNbaId(nbaId: number): Promise<Team | null> {
    const { data, error } = await this.client
      .from("teams")
      .select("*")
      .eq("nba_id", nbaId)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  // Mapper privado para convertir de Snake Case (DB) a Camel Case (Dominio)
  private mapToEntity(row: any): Team {
    return {
      id: row.id,
      nbaId: row.nba_id,
      name: row.name,
      city: row.city,
      abbreviation: row.abbreviation,
      conference: row.conference,
      division: row.division,
      logoUrl: row.logo_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
