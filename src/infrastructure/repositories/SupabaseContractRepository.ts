import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Contract } from "@/domain/entities/Contract";
import type { ContractRepository } from "@/domain/repositories/ContractRepository";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";

const uuidSchema = z.uuid();
const seasonYearSchema = z.number().int();

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(gameId: string): Promise<Contract[]> {
    uuidSchema.parse(gameId);
    const modern = await this.getEffectiveModernContracts(gameId);
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
    uuidSchema.parse(gameId);
    uuidSchema.parse(id);
    const modern = await this.getEffectiveModernContracts(gameId);
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
    uuidSchema.parse(gameId);
    uuidSchema.parse(playerId);
    const modern = await this.getEffectiveModernContracts(gameId);
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
    uuidSchema.parse(gameId);
    uuidSchema.parse(teamId);
    const game = await this.getGameContext(gameId);
    const modern = await this.getEffectiveModernContracts(gameId, game);
    if (modern !== null) return modern.filter(({ teamId: owner }) => owner === teamId);
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
    uuidSchema.parse(gameId);
    const game = await this.getGameContext(gameId);
    const modern = await this.getEffectiveModernContracts(gameId, game);
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
    uuidSchema.parse(gameId);
    seasonYearSchema.parse(seasonYear);
    const modern = await this.getEffectiveModernContracts(gameId);
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

  private async getEffectiveModernContracts(
    gameId: string,
    context?: { seasonYear: number; seasonEraId: string }
  ): Promise<Contract[] | null> {
    const game = context ?? (await this.getGameContext(gameId));
    if (game.seasonEraId !== "modern") return null;
    const effective = await new SupabaseGameContractRepository(this.client).getEffectiveAll(gameId);
    const activeContracts = effective.flatMap(({ playerId, teamId, canonical, simulated }) => {
      if (simulated && teamId) {
        const contract: Contract = {
          id: simulated.id,
          gameId,
          playerId,
          teamId,
          startYear: simulated.startYear,
          endYear: simulated.endYear,
          salaryY1: simulated.annualSalary,
          salaryY2:
            simulated.endYear - simulated.startYear >= 1 ? simulated.annualSalary : undefined,
          salaryY3:
            simulated.endYear - simulated.startYear >= 2 ? simulated.annualSalary : undefined,
          salaryY4:
            simulated.endYear - simulated.startYear >= 3 ? simulated.annualSalary : undefined,
          salaryY5:
            simulated.endYear - simulated.startYear >= 4 ? simulated.annualSalary : undefined,
          isPlayerOption: simulated.isPlayerOption,
          isTeamOption: simulated.isTeamOption,
          isGuaranteed: simulated.isGuaranteed,
          origin: simulated.origin,
          createdAt: new Date(simulated.createdAt),
          updatedAt: new Date(simulated.createdAt),
        };
        return [contract];
      }
      const agreement = canonical?.agreement;
      if (!agreement || !teamId) return [];
      const current = agreement.seasons.find(({ startYear }) => startYear === game.seasonYear);
      if (!current || current.salaryAmount === null) return [];
      // Empty source columns describe the table's horizon, not the player's contract term.
      const years = agreement.seasons
        .filter(
          ({ salaryAmount, optionKind }) =>
            salaryAmount !== null || optionKind === "player" || optionKind === "team"
        )
        .map(({ startYear }) => startYear);
      return [
        {
          id: agreement.id,
          gameId,
          playerId,
          teamId,
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
    const missingCanonicalPlayers = new Set(
      effective
        .filter(({ canonical, simulated, teamId }) => !canonical && !simulated && teamId)
        .map(({ playerId }) => playerId)
    );
    if (effective.length === 0) {
      const hasCanonicalMaterialization = await this.hasCanonicalMaterialization(gameId);
      if (hasCanonicalMaterialization) return [];
      const { data, error } = await this.client.from("contracts").select("*").eq("game_id", gameId);
      if (error) throw new Error(error.message);
      return data.map(this.mapToEntity);
    }
    if (missingCanonicalPlayers.size === 0) return activeContracts;

    // Only players without canonical identity coverage may use pre-modern legacy contracts.
    const { data, error } = await this.client.from("contracts").select("*").eq("game_id", gameId);
    if (error) throw new Error(error.message);
    const ownerByPlayer = new Map(effective.map(({ playerId, teamId }) => [playerId, teamId]));
    const legacyFallbacks = data.flatMap((row) => {
      const teamId = ownerByPlayer.get(row.player_id);
      if (!missingCanonicalPlayers.has(row.player_id) || !teamId) return [];
      return [{ ...this.mapToEntity(row), teamId }];
    });
    return [...activeContracts, ...legacyFallbacks];
  }

  private async hasCanonicalMaterialization(gameId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("game_contract_materializations")
      .select("game_id")
      .eq("game_id", gameId);
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
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
