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
  type GameContractAgreement,
  type GameContractSeason,
  type GamePlayerContractState,
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

export class SupabaseGameContractRepository implements GameContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByTeam(gameId: string, teamId: string): Promise<readonly GamePlayerContractState[]> {
    return this.get(gameId, { teamId });
  }

  async getAll(gameId: string): Promise<readonly GamePlayerContractState[]> {
    return this.get(gameId);
  }

  private async get(
    gameId: string,
    filter: { teamId?: string } = {}
  ): Promise<readonly GamePlayerContractState[]> {
    let identitiesQuery = this.client
      .from("game_contract_identities")
      .select(
        "player_id, resolution_status, contract_type, provenance_quality, source_method, estimated, cap_treatment, exclusion_evidence"
      )
      .eq("game_id", gameId);
    let agreementsQuery = this.client
      .from("game_contract_agreements")
      .select("*")
      .eq("game_id", gameId);
    if (filter.teamId) {
      identitiesQuery = identitiesQuery.eq("team_id", filter.teamId);
      agreementsQuery = agreementsQuery.eq("team_id", filter.teamId);
    }
    const [identitiesResult, agreementsResult] = await Promise.all([
      identitiesQuery,
      agreementsQuery,
    ]);
    if (identitiesResult.error) throw new Error(identitiesResult.error.message);
    if (agreementsResult.error) throw new Error(agreementsResult.error.message);
    const agreements = z.array(agreementRowSchema).parse(agreementsResult.data ?? []);
    const agreementIds = agreements.map(({ id }) => id);
    const seasonsResult =
      agreementIds.length === 0
        ? { data: [], error: null }
        : await this.client
            .from("game_contract_seasons")
            .select("*")
            .in("agreement_id", agreementIds);
    if (seasonsResult.error) throw new Error(seasonsResult.error.message);
    const seasons = z.array(seasonRowSchema).parse(seasonsResult.data ?? []);
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
