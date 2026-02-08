import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contract } from "@/domain/entities/Contract";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .order("start_year", { ascending: true });

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
      .gte("end_year", currentYear)
      .order("end_year", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getExpiringContracts(seasonYear: number): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("end_year", seasonYear);

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async create(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract> {
    const row = this.mapToRow(contract);
    const { data, error } = await this.client.from("contracts").insert(row).select().single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  async update(id: string, contract: Partial<Contract>): Promise<Contract> {
    const row = this.mapToRow(contract);
    const { data, error } = await this.client
      .from("contracts")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("contracts").delete().eq("id", id);

    if (error) throw new Error(error.message);
  }

  private mapToEntity(row: any): Contract {
    return {
      id: row.id,
      playerId: row.player_id,
      teamId: row.team_id,
      startYear: row.start_year,
      endYear: row.end_year,
      salaryY1: row.salary_y1,
      salaryY2: row.salary_y2,
      salaryY3: row.salary_y3,
      salaryY4: row.salary_y4,
      salaryY5: row.salary_y5,
      isPlayerOption: row.is_player_option,
      isTeamOption: row.is_team_option,
      isGuaranteed: row.is_guaranteed,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapToRow(entity: Partial<Contract>): any {
    const row: any = {};
    if (entity.playerId) row.player_id = entity.playerId;
    if (entity.teamId) row.team_id = entity.teamId;
    if (entity.startYear) row.start_year = entity.startYear;
    if (entity.endYear) row.end_year = entity.endYear;
    if (entity.salaryY1) row.salary_y1 = entity.salaryY1;
    if (entity.salaryY2) row.salary_y2 = entity.salaryY2;
    if (entity.salaryY3) row.salary_y3 = entity.salaryY3;
    if (entity.salaryY4) row.salary_y4 = entity.salaryY4;
    if (entity.salaryY5) row.salary_y5 = entity.salaryY5;
    if (entity.isPlayerOption !== undefined) row.is_player_option = entity.isPlayerOption;
    if (entity.isTeamOption !== undefined) row.is_team_option = entity.isTeamOption;
    if (entity.isGuaranteed !== undefined) row.is_guaranteed = entity.isGuaranteed;
    return row;
  }
}
