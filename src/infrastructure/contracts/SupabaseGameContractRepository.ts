import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CONTRACT_CAP_TREATMENT,
  CONTRACT_PROVENANCE_QUALITY,
  CONTRACT_SOURCE_METHOD,
  CONTRACT_TYPE,
} from "@/domain/contracts/ContractClassification";
import {
  CONTRACT_OPTION_KIND,
  CONTRACT_SEASON_GUARANTEE_KIND,
} from "@/domain/contracts/ContractSnapshot";
import {
  CONTRACT_IDENTITY_RESOLUTION_STATUS,
  type EffectiveGameContractState,
  type GameContractAgreement,
  type GameContractSeason,
  type GamePlayerContractState,
  type SimulatedGameContract,
} from "@/domain/contracts/GameContract";
import type { GameContractRepository } from "@/domain/contracts/GameContractRepository";

const identityRowSchema = z.object({
  player_id: z.uuid(),
  resolution_status: z.enum(CONTRACT_IDENTITY_RESOLUTION_STATUS),
  contract_type: z.enum(CONTRACT_TYPE).nullable(),
  provenance_quality: z.enum(CONTRACT_PROVENANCE_QUALITY).nullable(),
  source_method: z.enum(CONTRACT_SOURCE_METHOD).nullable(),
  estimated: z.boolean(),
  cap_treatment: z.enum(CONTRACT_CAP_TREATMENT),
  exclusion_evidence: z.record(z.string(), z.unknown()).nullable(),
});
const agreementRowSchema = z.object({
  id: z.uuid(),
  game_id: z.uuid(),
  player_id: z.uuid(),
  team_id: z.uuid(),
  start_season_label: z.string().nullable(),
  end_season_label: z.string().nullable(),
  remaining_guaranteed_amount: z.number().int().nonnegative().nullable(),
  contract_type: z.enum(CONTRACT_TYPE),
  provenance_quality: z.enum(CONTRACT_PROVENANCE_QUALITY),
  source_method: z.enum(CONTRACT_SOURCE_METHOD),
  estimated: z.boolean(),
  cap_treatment: z.enum(CONTRACT_CAP_TREATMENT),
});
const seasonRowSchema = z.object({
  agreement_id: z.uuid(),
  season_label: z.string(),
  start_year: z.number().int(),
  end_year: z.number().int(),
  salary_amount: z.number().int().nonnegative().nullable(),
  option_kind: z.enum(CONTRACT_OPTION_KIND),
  guarantee_kind: z.enum(CONTRACT_SEASON_GUARANTEE_KIND),
});
const gameIdSchema = z.uuid();
const teamIdSchema = z.uuid();
const rosterOwnerRowSchema = z.object({ player_id: z.uuid(), team_id: z.uuid().nullable() });
const runtimeContractRowSchema = z
  .object({
    id: z.uuid(),
    game_id: z.uuid(),
    player_id: z.uuid(),
    origin_kind: z.literal("simulated-agreement"),
    start_year: z.number().int(),
    end_year: z.number().int(),
    annual_salary: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    is_player_option: z.boolean(),
    is_team_option: z.boolean(),
    is_guaranteed: z.boolean().nullable(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .superRefine((contract, context) => {
    if (contract.end_year < contract.start_year || contract.end_year > contract.start_year + 4) {
      context.addIssue({
        code: "custom",
        message: "Runtime contract term must be one to five years",
      });
    }
    if (contract.is_player_option && contract.is_team_option) {
      context.addIssue({ code: "custom", message: "A runtime contract cannot have both options" });
    }
  });

const CONTRACT_SEASONS_PAGE_SIZE = 500;

export class SupabaseGameContractRepository implements GameContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByTeam(gameId: string, teamId: string): Promise<readonly GamePlayerContractState[]> {
    gameIdSchema.parse(gameId);
    teamIdSchema.parse(teamId);
    const [canonical, owners] = await Promise.all([this.get(gameId), this.getRosterOwners(gameId)]);
    const currentTeamByPlayer = new Map(
      owners.map(({ playerId, teamId: currentTeamId }) => [playerId, currentTeamId])
    );
    return canonical.filter((state) => currentTeamByPlayer.get(state.playerId) === teamId);
  }

  async getAll(gameId: string): Promise<readonly GamePlayerContractState[]> {
    gameIdSchema.parse(gameId);
    return this.get(gameId);
  }

  async getEffectiveAll(gameId: string): Promise<readonly EffectiveGameContractState[]> {
    gameIdSchema.parse(gameId);
    const [canonical, owners, runtimeContracts] = await Promise.all([
      this.get(gameId),
      this.getRosterOwners(gameId),
      this.getRuntimeContracts(gameId),
    ]);
    const canonicalByPlayer = new Map(canonical.map((state) => [state.playerId, state]));
    const ownerByPlayer = new Map(owners.map((owner) => [owner.playerId, owner.teamId]));
    const runtimeByPlayer = new Map(
      runtimeContracts.map((contract) => [contract.playerId, contract])
    );
    const players = new Set([
      ...canonicalByPlayer.keys(),
      ...ownerByPlayer.keys(),
      ...runtimeByPlayer.keys(),
    ]);
    return [...players].map((playerId) => {
      const simulated = runtimeByPlayer.get(playerId) ?? null;
      return {
        playerId,
        teamId: ownerByPlayer.get(playerId) ?? null,
        canonical: simulated ? null : (canonicalByPlayer.get(playerId) ?? null),
        simulated,
      };
    });
  }

  private async getRosterOwners(
    gameId: string
  ): Promise<Array<{ playerId: string; teamId: string | null }>> {
    const { data, error } = await this.client
      .from("game_player_states")
      .select("player_id, team_id")
      .eq("game_id", gameId);
    if (error) throw new Error(error.message);
    return z
      .array(rosterOwnerRowSchema)
      .parse(data ?? [])
      .map(({ player_id, team_id }) => ({
        playerId: player_id,
        teamId: team_id,
      }));
  }

  private async getRuntimeContracts(gameId: string): Promise<SimulatedGameContract[]> {
    const { data, error } = await this.client
      .from("game_runtime_contracts")
      .select(
        "id, game_id, player_id, origin_kind, start_year, end_year, annual_salary, is_player_option, is_team_option, is_guaranteed, created_at"
      )
      .eq("game_id", gameId);
    if (error) throw new Error(error.message);
    const rows = z.array(runtimeContractRowSchema).parse(data ?? []);
    const seenPlayers = new Set<string>();
    for (const row of rows) {
      if (row.game_id !== gameId)
        throw new Error("Runtime contract query returned a different game");
      if (seenPlayers.has(row.player_id)) throw new Error("Duplicate runtime contracts for player");
      seenPlayers.add(row.player_id);
    }
    return rows.map((row) => ({
      id: row.id,
      gameId: row.game_id,
      playerId: row.player_id,
      origin: row.origin_kind,
      startYear: row.start_year,
      endYear: row.end_year,
      annualSalary: row.annual_salary,
      isPlayerOption: row.is_player_option,
      isTeamOption: row.is_team_option,
      isGuaranteed: row.is_guaranteed,
      createdAt: row.created_at,
    }));
  }

  private async get(gameId: string): Promise<readonly GamePlayerContractState[]> {
    const identitiesQuery = this.client
      .from("game_contract_identities")
      .select(
        "player_id, resolution_status, contract_type, provenance_quality, source_method, estimated, cap_treatment, exclusion_evidence"
      )
      .eq("game_id", gameId);
    const agreementsQuery = this.client
      .from("game_contract_agreements")
      .select("*")
      .eq("game_id", gameId);
    const [identitiesResult, agreementsResult] = await Promise.all([
      identitiesQuery,
      agreementsQuery,
    ]);
    if (identitiesResult.error) throw new Error(identitiesResult.error.message);
    if (agreementsResult.error) throw new Error(agreementsResult.error.message);
    const agreements = z.array(agreementRowSchema).parse(agreementsResult.data ?? []);
    const seasons: z.infer<typeof seasonRowSchema>[] = [];
    // A league's multi-year agreements exceed PostgREST's single-response row limit.
    if (agreements.length > 0) {
      for (let from = 0; ; from += CONTRACT_SEASONS_PAGE_SIZE) {
        const { data, error } = await this.client
          .from("game_contract_seasons")
          .select("*")
          .eq("game_id", gameId)
          .order("id", { ascending: true })
          .range(from, from + CONTRACT_SEASONS_PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        const page = z.array(seasonRowSchema).parse(data ?? []);
        seasons.push(...page);
        if (page.length < CONTRACT_SEASONS_PAGE_SIZE) break;
      }
    }
    const seasonsByAgreement = new Map<string, GameContractSeason[]>();
    for (const row of seasons) {
      const values = seasonsByAgreement.get(row.agreement_id) ?? [];
      values.push({
        seasonLabel: row.season_label,
        startYear: row.start_year,
        endYear: row.end_year,
        salaryAmount: row.salary_amount,
        optionKind: row.option_kind,
        guaranteeKind: row.guarantee_kind,
      });
      seasonsByAgreement.set(row.agreement_id, values);
    }
    const agreementByPlayer = new Map<string, GameContractAgreement>(
      agreements.map((row) => [
        row.player_id,
        {
          id: row.id,
          gameId: row.game_id,
          playerId: row.player_id,
          teamId: row.team_id,
          startSeasonLabel: row.start_season_label,
          endSeasonLabel: row.end_season_label,
          remainingGuaranteedAmount: row.remaining_guaranteed_amount,
          contractType: row.contract_type,
          provenanceQuality: row.provenance_quality,
          sourceMethod: row.source_method,
          estimated: row.estimated,
          capTreatment: row.cap_treatment,
          seasons: (seasonsByAgreement.get(row.id) ?? []).sort((a, b) => a.startYear - b.startYear),
        },
      ])
    );
    return z
      .array(identityRowSchema)
      .parse(identitiesResult.data ?? [])
      .map((row) => ({
        playerId: row.player_id,
        resolutionStatus: row.resolution_status,
        contractType: row.contract_type,
        provenanceQuality: row.provenance_quality,
        sourceMethod: row.source_method,
        estimated: row.estimated,
        capTreatment: row.cap_treatment,
        exclusionEvidence: row.exclusion_evidence,
        agreement: agreementByPlayer.get(row.player_id) ?? null,
      }));
  }
}
