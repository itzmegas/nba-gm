import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contract } from "@/domain/entities/Contract";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(gameId: string): Promise<Contract[]> {
    const modern = await this.getModernContracts(gameId);
    if (modern !== null) return modern;
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .order("start_year", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getById(gameId: string, id: string): Promise<Contract | null> {
    const modern = await this.getModernContracts(gameId);
    if (modern !== null) return modern.find((contract) => contract.id === id) ?? null;
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
    const modern = await this.getModernContracts(gameId);
    if (modern !== null) return modern.find((contract) => contract.playerId === playerId) ?? null;
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
    const game = await this.getGameContext(gameId);
    if (game.seasonEraId === "modern") {
      const seasonal = await new SupabaseGameContractRepository(this.client).getByTeam(
        gameId,
        teamId
      );
      if (seasonal.length > 0) return this.projectSeasonal(gameId, game.seasonYear, seasonal);
    }
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
    const game = await this.getGameContext(gameId);
    const modern = await this.getModernContracts(gameId, game);
    if (modern !== null) return modern.filter(({ endYear }) => endYear >= game.seasonYear);
    const seasonYear = game.seasonYear;
    const { data, error } = await this.client
      .from("contracts")
      .select("*")
      .eq("game_id", gameId)
      .gte("end_year", seasonYear)
      .order("end_year", { ascending: true });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getExpiringContracts(gameId: string, seasonYear: number): Promise<Contract[]> {
    const modern = await this.getModernContracts(gameId);
    if (modern !== null) return modern.filter(({ endYear }) => endYear === seasonYear);
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

  private async getModernContracts(
    gameId: string,
    context?: { seasonYear: number; seasonEraId: string }
  ): Promise<Contract[] | null> {
    const game = context ?? (await this.getGameContext(gameId));
    if (game.seasonEraId !== "modern") return null;
    const states = await new SupabaseGameContractRepository(this.client).getAll(gameId);
    if (states.length === 0) return null; // Explicit fallback for unmigrated modern saves.
    return this.projectSeasonal(gameId, game.seasonYear, states);
  }

  private projectSeasonal(
    gameId: string,
    seasonYear: number,
    states: Awaited<ReturnType<SupabaseGameContractRepository["getAll"]>>
  ): Contract[] {
    return states.flatMap(({ agreement }) => {
      if (!agreement || agreement.seasons.length === 0) return [];
      const current = agreement.seasons.find(({ startYear }) => startYear === seasonYear);
      if (!current || current.salaryAmount === null) return [];
      const years = agreement.seasons.map(({ startYear }) => startYear);
      return [
        {
          id: agreement.id,
          gameId,
          playerId: agreement.playerId,
          teamId: agreement.teamId,
          startYear: Math.min(...years),
          endYear: Math.max(...years),
          salaryY1: current.salaryAmount,
          isPlayerOption: current.optionKind === "player",
          isTeamOption: current.optionKind === "team",
          isGuaranteed:
            current.guaranteeKind === "unknown" ? null : current.guaranteeKind === "guaranteed",
          compatibilityProjection: "observed-season-coverage" as const,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ];
    });
  }

  private async getGameContext(
    gameId: string
  ): Promise<{ seasonYear: number; seasonEraId: string }> {
    const { data, error } = await this.client
      .from("games")
      .select("season_year, season_era_id")
      .eq("id", gameId)
      .single();

    if (error) throw new Error(error.message);

    const row = data as Record<string, unknown>;
    return { seasonYear: row.season_year as number, seasonEraId: row.season_era_id as string };
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
