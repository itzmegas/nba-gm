import { serializeContractError } from "@/application/contracts/contractDiagnostics";
import {
  CONTRACT_SNAPSHOT_RESULT_STATUS,
  type ContractSnapshotFetcher,
  type GetFreshContractSnapshotDependencies,
  getFreshContractSnapshot,
  type SerializableRevalidationError,
} from "@/application/contracts/getFreshContractSnapshot";
import type {
  CachedContractSnapshot,
  ContractSnapshotCacheIdentity,
} from "@/domain/contracts/ContractSnapshotCache";

export const TEAM_CONTRACT_OUTCOME_STATUS = {
  FAILED: "failed",
  FETCHED: "fetched",
  FRESH: "fresh",
  STALE_FALLBACK: "stale-fallback",
} as const;

export interface ContractTeamSourceIdentity {
  nbaAbbreviation: string;
  sourceTeam: string;
}

export interface TeamContractOutcomeBase {
  nbaAbbreviation: string;
  sourceTeam: string;
  identity: ContractSnapshotCacheIdentity;
}

export interface SuccessfulTeamContractOutcome<TSnapshot> extends TeamContractOutcomeBase {
  status: typeof TEAM_CONTRACT_OUTCOME_STATUS.FRESH | typeof TEAM_CONTRACT_OUTCOME_STATUS.FETCHED;
  value: CachedContractSnapshot<TSnapshot>;
}

export interface StaleTeamContractOutcome<TSnapshot> extends TeamContractOutcomeBase {
  status: typeof TEAM_CONTRACT_OUTCOME_STATUS.STALE_FALLBACK;
  value: CachedContractSnapshot<TSnapshot>;
  error: SerializableRevalidationError;
}

export interface FailedTeamContractOutcome extends TeamContractOutcomeBase {
  status: typeof TEAM_CONTRACT_OUTCOME_STATUS.FAILED;
  error: SerializableRevalidationError;
}

export type TeamContractOutcome<TSnapshot> =
  | SuccessfulTeamContractOutcome<TSnapshot>
  | StaleTeamContractOutcome<TSnapshot>
  | FailedTeamContractOutcome;

export interface AllTeamContractProgress<TSnapshot> {
  completed: number;
  total: number;
  outcome: TeamContractOutcome<TSnapshot>;
}

export interface AllTeamContractBatchResult<TSnapshot> {
  complete: boolean;
  outcomes: readonly TeamContractOutcome<TSnapshot>[];
  canonicalSnapshots: readonly CachedContractSnapshot<TSnapshot>[] | null;
}

export interface GetAllTeamContractSnapshotsInput {
  teams: readonly ContractTeamSourceIdentity[];
  source: string;
  season: string;
  ttlMs: number;
  allowStaleOnFetchError: boolean;
  minimumFetchIntervalMs?: number;
  signal?: AbortSignal;
}

export interface GetAllTeamContractSnapshotsDependencies<TSnapshot>
  extends GetFreshContractSnapshotDependencies<TSnapshot> {
  nowMs?: () => number;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  onProgress?: (progress: AllTeamContractProgress<TSnapshot>) => void;
}

function abortError(): DOMException {
  return new DOMException("The contract snapshot batch was aborted", "AbortError");
}

async function defaultWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function getAllTeamContractSnapshots<TSnapshot>(
  dependencies: GetAllTeamContractSnapshotsDependencies<TSnapshot>,
  input: GetAllTeamContractSnapshotsInput
): Promise<AllTeamContractBatchResult<TSnapshot>> {
  const minimumFetchIntervalMs = input.minimumFetchIntervalMs ?? 3_000;
  if (!Number.isFinite(minimumFetchIntervalMs) || minimumFetchIntervalMs < 3_000) {
    throw new RangeError("minimumFetchIntervalMs must be at least 3000");
  }
  const nowMs = dependencies.nowMs ?? Date.now;
  const wait = dependencies.wait ?? defaultWait;
  let lastFetchStartedAt: number | null = null;
  const throttledFetcher: ContractSnapshotFetcher<TSnapshot> = {
    async fetch(identity, signal) {
      if (signal?.aborted) throw abortError();
      if (lastFetchStartedAt !== null) {
        const remaining = minimumFetchIntervalMs - (nowMs() - lastFetchStartedAt);
        if (remaining > 0) await wait(remaining, signal);
      }
      if (signal?.aborted) throw abortError();
      lastFetchStartedAt = nowMs();
      return dependencies.fetcher.fetch(identity, signal);
    },
  };
  const outcomes: TeamContractOutcome<TSnapshot>[] = [];

  for (const team of input.teams) {
    const identity = {
      source: input.source,
      team: team.sourceTeam,
      season: input.season,
    };
    let outcome: TeamContractOutcome<TSnapshot>;
    if (input.signal?.aborted) {
      outcome = {
        ...team,
        identity,
        status: TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
        error: serializeContractError(abortError()),
      };
    } else {
      try {
        const result = await getFreshContractSnapshot(
          { ...dependencies, fetcher: throttledFetcher },
          { ...input, identity }
        );
        if (result.status === CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK) {
          outcome = {
            ...team,
            identity,
            status: TEAM_CONTRACT_OUTCOME_STATUS.STALE_FALLBACK,
            value: result.value,
            error: result.revalidationError,
          };
        } else {
          outcome = {
            ...team,
            identity,
            status:
              result.status === CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE
                ? TEAM_CONTRACT_OUTCOME_STATUS.FRESH
                : TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
            value: result.value,
          };
        }
      } catch (error) {
        outcome = {
          ...team,
          identity,
          status: TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
          error: serializeContractError(error),
        };
      }
    }
    outcomes.push(outcome);
    dependencies.onProgress?.({ completed: outcomes.length, total: input.teams.length, outcome });
  }

  const complete = outcomes.every(({ status }) => status !== TEAM_CONTRACT_OUTCOME_STATUS.FAILED);
  return {
    complete,
    outcomes,
    canonicalSnapshots: complete
      ? outcomes.map((outcome) => {
          if (outcome.status === TEAM_CONTRACT_OUTCOME_STATUS.FAILED)
            throw new Error("Unreachable");
          return outcome.value;
        })
      : null,
  };
}
