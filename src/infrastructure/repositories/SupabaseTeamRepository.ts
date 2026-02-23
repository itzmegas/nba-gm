import type { SupabaseClient } from "@supabase/supabase-js";
import type { Team } from "@/domain/entities/Team";
import type { TeamRepository } from "@/domain/repositories/TeamRepository";

const TEAM_CONFERENCES: Record<
  string,
  { conference: string; division: string }
> = {
  ATL: { conference: "East", division: "Southeast" },
  BOS: { conference: "East", division: "Atlantic" },
  BKN: { conference: "East", division: "Atlantic" },
  CHA: { conference: "East", division: "Southeast" },
  CHI: { conference: "East", division: "Central" },
  CLE: { conference: "East", division: "Central" },
  DAL: { conference: "West", division: "Southwest" },
  DEN: { conference: "West", division: "Northwest" },
  DET: { conference: "East", division: "Central" },
  GSW: { conference: "West", division: "Pacific" },
  HOU: { conference: "West", division: "Southwest" },
  IND: { conference: "East", division: "Central" },
  LAC: { conference: "West", division: "Pacific" },
  LAL: { conference: "West", division: "Pacific" },
  MEM: { conference: "West", division: "Southwest" },
  MIA: { conference: "East", division: "Southeast" },
  MIL: { conference: "East", division: "Central" },
  MIN: { conference: "West", division: "Northwest" },
  NOP: { conference: "West", division: "Southwest" },
  NYK: { conference: "East", division: "Atlantic" },
  OKC: { conference: "West", division: "Northwest" },
  ORL: { conference: "East", division: "Southeast" },
  PHI: { conference: "East", division: "Atlantic" },
  PHX: { conference: "West", division: "Pacific" },
  POR: { conference: "West", division: "Northwest" },
  SAC: { conference: "West", division: "Pacific" },
  SAS: { conference: "West", division: "Southwest" },
  TOR: { conference: "East", division: "Atlantic" },
  UTA: { conference: "West", division: "Northwest" },
  WAS: { conference: "East", division: "Southeast" },
};

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
  private mapToEntity(row: Record<string, unknown>): Team {
    const abbreviation = row.abbreviation as string;
    const nbaId = row.nba_id as number;

    // Enriquecemos los datos que faltan desde la base local y la CDN de NBA
    const staticData = TEAM_CONFERENCES[abbreviation] || {
      conference: "Unknown",
      division: "Unknown",
    };
    return {
      id: row.id as string,
      nbaId: nbaId,
      name: row.name as string,
      city: row.city as string,
      abbreviation: abbreviation,
      // Usamos el dato de Supabase si existe, sino usamos nuestro mapa estático
      conference: (row.conference as string) || staticData.conference,
      division: (row.division as string) || staticData.division,
      // Inyectamos la URL del logo oficial de la NBA usando el CDN y el nbaId
      logoUrl: `https://cdn.nba.com/logos/nba/${nbaId}/global/L/logo.svg`,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
