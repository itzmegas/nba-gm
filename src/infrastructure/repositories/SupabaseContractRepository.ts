import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contract } from "@/domain/entities/Contract";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getById(id: string): Promise<Contract | null> {
    const { data, error } = await this.client.from("contracts").select("*").eq("id", id).single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByPlayerId(playerId: string): Promise<Contract | null> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("player_id", playerId)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByTeamId(teamId: string): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("team_id", teamId)
      .order("salary_y1", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getActiveContracts(): Promise<Contract[]> {
    const currentYear = new Date().getFullYear();

    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .lte("start_year", currentYear)
      .gte("end_year", currentYear)
      .order("salary_y1", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getExpiringContracts(seasonYear: number): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("end_year", seasonYear)
      .order("salary_y1", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  private mapToEntity(row: Record<string, unknown>): Contract {
    return {
      id: row.id as string,
      playerId: row.player_id as string,
      teamId: row.team_id as string,
      startYear: row.start_year as number,
      endYear: row.end_year as number,
      salaryY1: row.salary_y1 as number,
      salaryY2: row.salary_y2 as number | undefined,
      salaryY3: row.salary_y3 as number | undefined,
      salaryY4: row.salary_y4 as number | undefined,
      salaryY5: row.salary_y5 as number | undefined,
      isPlayerOption: row.is_player_option as boolean,
      isTeamOption: row.is_team_option as boolean,
      isGuaranteed: row.is_guaranteed as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
