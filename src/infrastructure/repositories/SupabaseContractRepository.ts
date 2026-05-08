import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contract } from "@/domain/entities/Contract";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(gameId: string): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .order("start_year", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getById(gameId: string, id: string): Promise<Contract | null> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .eq("id", id)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByPlayerId(gameId: string, playerId: string): Promise<Contract | null> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByTeamId(gameId: string, teamId: string): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .eq("team_id", teamId)
      .order("salary_y1", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getActiveContracts(gameId: string): Promise<Contract[]> {
    const currentYear = new Date().getFullYear();
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .gte("end_year", currentYear)
      .order("end_year", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getExpiringContracts(gameId: string, seasonYear: number): Promise<Contract[]> {
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
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

  async update(gameId: string, id: string, contract: Partial<Contract>): Promise<Contract> {
    const row = this.mapToRow(contract);
    const { data, error } = await this.client
      .from("contracts")
      .update(row)
      .eq("game_id", gameId)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  async delete(gameId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("contracts")
      .delete()
      .eq("game_id", gameId)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  private mapToEntity(row: Record<string, unknown>): Contract {
    return {
      id: row.id as string,
      gameId: row.game_id as string,
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

  private mapToRow(entity: Partial<Contract>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (entity.gameId !== undefined) row.game_id = entity.gameId;
    if (entity.playerId !== undefined) row.player_id = entity.playerId;
    if (entity.teamId !== undefined) row.team_id = entity.teamId;
    if (entity.startYear !== undefined) row.start_year = entity.startYear;
    if (entity.endYear !== undefined) row.end_year = entity.endYear;
    if (entity.salaryY1 !== undefined) row.salary_y1 = entity.salaryY1;
    if (entity.salaryY2 !== undefined) row.salary_y2 = entity.salaryY2;
    if (entity.salaryY3 !== undefined) row.salary_y3 = entity.salaryY3;
    if (entity.salaryY4 !== undefined) row.salary_y4 = entity.salaryY4;
    if (entity.salaryY5 !== undefined) row.salary_y5 = entity.salaryY5;
    if (entity.isPlayerOption !== undefined) row.is_player_option = entity.isPlayerOption;
    if (entity.isTeamOption !== undefined) row.is_team_option = entity.isTeamOption;
    if (entity.isGuaranteed !== undefined) row.is_guaranteed = entity.isGuaranteed;
    return row;
  }
}
