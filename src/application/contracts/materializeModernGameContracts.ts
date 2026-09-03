import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  sanitizeContractDiagnosticValue,
  sanitizeSerializedContractError,
} from "@/application/contracts/contractDiagnostics";
import {
  getAllTeamContractSnapshots,
  TEAM_CONTRACT_OUTCOME_STATUS,
} from "@/application/contracts/getAllTeamContractSnapshots";
import { resolveContractFallback } from "@/domain/contracts/ContractFallback";
import type { ContractSnapshotCache } from "@/domain/contracts/ContractSnapshotCache";
import { basketballReferenceContractSnapshotFetcher } from "@/infrastructure/contracts/basketballReferenceContractSnapshotFetcher";
import type { BasketballReferenceContractSnapshot } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { CONTRACT_SOURCE } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";
import { CURATED_INACTIVE_CONTRACT_STATUSES } from "@/infrastructure/contracts/curatedContractStatusExceptions";
import {
  fetchNbaGLeagueTwoWayTracker,
  NBA_TEAM_NAME_BY_ABBREVIATION,
  type NbaGLeagueTwoWaySnapshot,
} from "@/infrastructure/contracts/nbaGLeagueTwoWaySource";
import {
  type ContractRosterPlayer,
  type CuratedIdentityException,
  reconcileContractPlayerIdentities,
} from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";

export const CONTRACT_MATERIALIZATION_TIMEOUT_MS = 120_000;

export const CONTRACT_MATERIALIZATION_FAILURE_KIND = {
  ACQUISITION: "acquisition",
  NON_DURABLE_SOURCE_VERSIONS: "non-durable-source-versions",
  FALLBACK_COVERAGE: "fallback-coverage",
} as const;

export type ContractMaterializationFailureKind =
  (typeof CONTRACT_MATERIALIZATION_FAILURE_KIND)[keyof typeof CONTRACT_MATERIALIZATION_FAILURE_KIND];

export interface SerializedContractMaterializationError {
  name: string;
  message: string;
}

export interface FailedContractTeamDiagnostic {
  nbaAbbreviation: string;
  sourceTeam: string;
  error: SerializedContractMaterializationError;
}

export interface NonDurableContractTeamDiagnostic {
  nbaAbbreviation: string;
  sourceTeam: string;
  versionId: null;
}

export const CONTRACT_FALLBACK_DIAGNOSTIC_KIND = {
  UNRESOLVED_IDENTITY: "unresolved-identity",
  BLOCKED_FALLBACK: "blocked-fallback",
} as const;

export type ContractFallbackDiagnosticKind =
  (typeof CONTRACT_FALLBACK_DIAGNOSTIC_KIND)[keyof typeof CONTRACT_FALLBACK_DIAGNOSTIC_KIND];

export interface ContractFallbackCoverageDiagnostic {
  kind: ContractFallbackDiagnosticKind;
  player: string;
  team: string;
  reason: string;
}

const MAX_FALLBACK_DIAGNOSTICS = 2;
const MAX_FALLBACK_DIAGNOSTIC_FIELD_LENGTH = 40;
const MAX_FALLBACK_SUMMARY_LENGTH = 480;

export class ContractFallbackCoverageError extends Error {
  override readonly name = "ContractFallbackCoverageError";
  readonly failureKind = CONTRACT_MATERIALIZATION_FAILURE_KIND.FALLBACK_COVERAGE;
  readonly diagnostics: readonly ContractFallbackCoverageDiagnostic[];
  readonly omittedCount: number;

  constructor(season: string, diagnostics: readonly ContractFallbackCoverageDiagnostic[]) {
    const safeDiagnostics = diagnostics.slice(0, MAX_FALLBACK_DIAGNOSTICS).map((diagnostic) => ({
      kind: diagnostic.kind,
      player: sanitizeContractDiagnosticValue(
        diagnostic.player,
        "unknown player",
        MAX_FALLBACK_DIAGNOSTIC_FIELD_LENGTH
      ),
      team: sanitizeContractDiagnosticValue(
        diagnostic.team,
        "unknown team",
        MAX_FALLBACK_DIAGNOSTIC_FIELD_LENGTH
      ),
      reason: sanitizeContractDiagnosticValue(
        diagnostic.reason,
        "unknown reason",
        MAX_FALLBACK_DIAGNOSTIC_FIELD_LENGTH
      ),
    }));
    const safeSeason = sanitizeContractDiagnosticValue(
      season,
      "unknown season",
      MAX_FALLBACK_DIAGNOSTIC_FIELD_LENGTH
    );
    const omittedCount = Math.max(0, diagnostics.length - safeDiagnostics.length);
    const details = safeDiagnostics.map(
      ({ kind, player, team, reason }) => `${kind} player=${player} team=${team} reason=${reason}`
    );
    const suffix = omittedCount > 0 ? `; additional diagnostics redacted=${omittedCount}` : "";
    let message = `Contract fallback coverage is insufficient for ${safeSeason}`;
    for (const detail of details) {
      const candidate = `${message}; ${detail}${suffix}`;
      if (candidate.length > MAX_FALLBACK_SUMMARY_LENGTH) break;
      message = `${message}; ${detail}`;
    }
    super(`${message}${suffix}`);
    this.diagnostics = safeDiagnostics;
    this.omittedCount = omittedCount;
  }
}

function sanitizeSerializedError(
  error: SerializedContractMaterializationError
): SerializedContractMaterializationError {
  return sanitizeSerializedContractError(error);
}

export class ContractSnapshotAcquisitionError extends Error {
  override readonly name = "ContractSnapshotAcquisitionError";
  readonly failureKind = CONTRACT_MATERIALIZATION_FAILURE_KIND.ACQUISITION;
  readonly failedTeams: readonly FailedContractTeamDiagnostic[];

  constructor(failedTeams: readonly FailedContractTeamDiagnostic[]) {
    const diagnostics = failedTeams.map((team) => ({
      ...team,
      error: sanitizeSerializedError(team.error),
    }));
    super(
      `Complete 30-team contract snapshot acquisition failed: ${JSON.stringify({ failedTeams: diagnostics })}`
    );
    this.failedTeams = diagnostics;
  }
}

export class ContractSnapshotDurabilityError extends Error {
  override readonly name = "ContractSnapshotDurabilityError";
  readonly failureKind = CONTRACT_MATERIALIZATION_FAILURE_KIND.NON_DURABLE_SOURCE_VERSIONS;
  readonly nonDurableTeams: readonly NonDurableContractTeamDiagnostic[];

  constructor(nonDurableTeams: readonly NonDurableContractTeamDiagnostic[]) {
    super(
      `Contract snapshot acquisition succeeded, but durable source versions are missing: ${JSON.stringify({ nonDurableTeams })}`
    );
    this.nonDurableTeams = nonDurableTeams;
  }
}

export class ContractMaterializationTimeoutError extends Error {
  override readonly name = "ContractMaterializationTimeoutError";
}

export interface MaterializeModernGameContractsInput {
  gameId: string;
  userId: string;
  seasonYear: number;
  cache: ContractSnapshotCache<BasketballReferenceContractSnapshot>;
  serviceClient: SupabaseClient;
  curatedIdentityExceptions?: readonly CuratedIdentityException[];
  allowUnmatchedRosterExperienceFallback?: boolean;
  ttlMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchTwoWayTracker?: (signal?: AbortSignal) => Promise<NbaGLeagueTwoWaySnapshot>;
}

export async function materializeModernGameContracts(
  input: MaterializeModernGameContractsInput
): Promise<void> {
  const timeoutMs = input.timeoutMs ?? CONTRACT_MATERIALIZATION_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 90_000) {
    throw new RangeError("Contract materialization timeout must be at least 90000ms");
  }
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (input.signal?.aborted) abortFromCaller();
  let rejectTimeout: ((error: ContractMaterializationTimeoutError) => void) | undefined;
  const timeoutFailure = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const timer = setTimeout(() => {
    const error = new ContractMaterializationTimeoutError(
      `Contract materialization exceeded ${timeoutMs}ms`
    );
    controller.abort(error);
    rejectTimeout?.(error);
  }, timeoutMs);
  const season = `${input.seasonYear}-${String(input.seasonYear + 1).slice(-2)}`;
  try {
    const batch = await Promise.race([
      getAllTeamContractSnapshots(
        { cache: input.cache, fetcher: basketballReferenceContractSnapshotFetcher },
        {
          teams: NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
            ({ nbaAbbreviation, basketballReferenceAbbreviation }) => ({
              nbaAbbreviation,
              sourceTeam: basketballReferenceAbbreviation,
            })
          ),
          source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
          season,
          ttlMs: input.ttlMs ?? 24 * 60 * 60 * 1000,
          allowStaleOnFetchError: true,
          signal: controller.signal,
        }
      ),
      timeoutFailure,
    ]);
    if (!batch.complete || !batch.canonicalSnapshots) {
      const failedTeams = batch.outcomes.flatMap((outcome) =>
        outcome.status === TEAM_CONTRACT_OUTCOME_STATUS.FAILED
          ? [
              {
                nbaAbbreviation: outcome.nbaAbbreviation,
                sourceTeam: outcome.sourceTeam,
                error: outcome.error,
              },
            ]
          : []
      );
      throw new ContractSnapshotAcquisitionError(failedTeams);
    }
    const nonDurableTeams = batch.canonicalSnapshots.flatMap((snapshot) =>
      snapshot.versionId === null
        ? [
            {
              nbaAbbreviation:
                NBA_TO_BASKETBALL_REFERENCE_TEAMS.find(
                  ({ basketballReferenceAbbreviation }) =>
                    basketballReferenceAbbreviation === snapshot.identity.team
                )?.nbaAbbreviation ?? "unknown",
              sourceTeam: snapshot.identity.team,
              versionId: null,
            },
          ]
        : []
    );
    if (nonDurableTeams.length > 0) {
      throw new ContractSnapshotDurabilityError(nonDurableTeams);
    }
    const versionIds = batch.canonicalSnapshots.map(({ versionId }) => versionId);
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      throw reason instanceof Error
        ? reason
        : new DOMException("Contract materialization aborted", "AbortError");
    }
    const rosterResult = await input.serviceClient
      .from("game_player_states")
      .select(
        "player_id, players!inner(espn_id, full_name, years_of_experience), teams!inner(abbreviation)"
      )
      .eq("game_id", input.gameId);
    if (rosterResult.error)
      throw new Error(`Failed to load contract identity roster: ${rosterResult.error.message}`);
    const sourceTeamByNbaTeam = new Map(
      NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
        ({ nbaAbbreviation, basketballReferenceAbbreviation }) => [
          nbaAbbreviation,
          basketballReferenceAbbreviation,
        ]
      )
    );
    const rosterRows = z
      .array(
        z.object({
          player_id: z.uuid(),
          players: z.object({
            espn_id: z.number().int().positive(),
            full_name: z.string().min(1),
            years_of_experience: z.number().int().nonnegative().max(99).nullable(),
          }),
          teams: z.object({ abbreviation: z.string().min(2) }),
        })
      )
      .parse(rosterResult.data ?? []);
    const rosterPlayers: ContractRosterPlayer[] = rosterRows.map((row) => ({
      playerId: row.player_id,
      providerId: String(row.players.espn_id),
      fullName: row.players.full_name,
      nbaTeam: row.teams.abbreviation,
      sourceTeam: sourceTeamByNbaTeam.get(row.teams.abbreviation) ?? "",
      yearsOfExperience: row.players.years_of_experience,
    }));
    const reconciliation = reconcileContractPlayerIdentities(
      batch.canonicalSnapshots.map(({ snapshot }) => snapshot),
      rosterPlayers,
      input.curatedIdentityExceptions
    );
    const twoWaySnapshot = input.fetchTwoWayTracker
      ? await input.fetchTwoWayTracker(controller.signal)
      : await fetchNbaGLeagueTwoWayTracker(controller.signal, Date.now(), season);
    if (twoWaySnapshot.season !== season) {
      throw new Error(
        `Official two-way tracker season ${twoWaySnapshot.season} does not match ${season}`
      );
    }
    const normalize = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
    const sourceContractBySlug = new Map(
      batch.canonicalSnapshots.flatMap(({ snapshot }) =>
        snapshot.contracts.map((contract) => [contract.playerSlug, contract] as const)
      )
    );
    const validatedByPlayer = new Map(
      reconciliation.validated.map((record) => [record.targetPlayerId, record])
    );
    const classifications = rosterPlayers.map((player) => {
      const match = validatedByPlayer.get(player.playerId);
      const sourceContract = match ? sourceContractBySlug.get(match.sourcePlayerId) : undefined;
      const currentStandardSalary =
        sourceContract?.salaries.find(({ season: salarySeason }) => salarySeason === season)
          ?.amount ?? null;
      const isOfficialTwoWay = twoWaySnapshot.rows.some(
        (row) =>
          normalize(row.playerName) === normalize(player.fullName) &&
          row.nbaTeamName === NBA_TEAM_NAME_BY_ABBREVIATION[player.nbaTeam]
      );
      const inactive = CURATED_INACTIVE_CONTRACT_STATUSES.find(
        (status) =>
          status.espnPlayerId === player.providerId &&
          status.nbaTeam === player.nbaTeam &&
          status.effectiveSeason === season
      );
      return {
        targetPlayerId: player.playerId,
        sourcePlayerId: match?.sourcePlayerId ?? null,
        resolution: resolveContractFallback({
          season,
          currentStandardSalary,
          isOfficialTwoWay,
          isActiveStandardRoster: inactive === undefined,
          isMatchedSourcePlayer: sourceContract !== undefined,
          allowUnmatchedRosterExperienceFallback:
            input.allowUnmatchedRosterExperienceFallback === true,
          yearsOfService: player.yearsOfExperience ?? null,
          inactiveEvidence: inactive
            ? {
                sourceUrl: inactive.sourceUrl,
                observedDate: inactive.observedDate,
                evidence: inactive.evidence,
              }
            : null,
        }),
      };
    });
    const blocked = classifications.filter(({ resolution }) => resolution.status === "blocked");
    if (blocked.length > 0) {
      const rosterPlayerById = new Map(
        rosterPlayers.map((player) => [player.playerId, player] as const)
      );
      throw new ContractFallbackCoverageError(season, [
        ...blocked.map(({ targetPlayerId, resolution }) => {
          const player = rosterPlayerById.get(targetPlayerId);
          return {
            kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
            player: player?.fullName ?? "unknown player",
            team: player?.nbaTeam ?? "unknown team",
            reason: resolution.reason ?? "unknown fallback block reason",
          };
        }),
      ]);
    }
    const { error } = await input.serviceClient.rpc("materialize_game_contract_snapshots", {
      p_game_id: input.gameId,
      p_user_id: input.userId,
      p_source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
      p_season: season,
      p_version_ids: versionIds as string[],
      p_identity_crosswalk: reconciliation.validated,
      p_contract_classifications: classifications,
    });
    if (error) throw new Error(`Contract materialization failed: ${error.message}`);
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}
