import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
  ContractSnapshotCacheIdentity,
} from "@/domain/contracts/ContractSnapshotCache";

export const CONTRACT_SNAPSHOT_RESULT_STATUS = {
  FRESH_CACHE: "fresh-cache",
  FETCHED: "fetched",
  STALE_FALLBACK: "stale-fallback",
} as const;

export interface ContractSnapshotFetchResult<TSnapshot> {
  snapshot: TSnapshot;
  contentHash: string;
  observedAt: string;
}

export interface ContractSnapshotFetcher<TSnapshot> {
  fetch(
    identity: ContractSnapshotCacheIdentity,
    signal?: AbortSignal
  ): Promise<ContractSnapshotFetchResult<TSnapshot>>;
}

export interface GetFreshContractSnapshotDependencies<TSnapshot> {
  cache: ContractSnapshotCache<TSnapshot>;
  fetcher: ContractSnapshotFetcher<TSnapshot>;
  now?: () => Date;
}

export interface GetFreshContractSnapshotInput {
  identity: ContractSnapshotCacheIdentity;
  ttlMs: number;
  allowStaleOnFetchError: boolean;
  signal?: AbortSignal;
}

export interface SerializableRevalidationError {
  name: string;
  message: string;
}

interface FreshCacheContractSnapshotResult<TSnapshot> {
  status: typeof CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE;
  value: CachedContractSnapshot<TSnapshot>;
  revalidationError?: never;
}

interface FetchedContractSnapshotResult<TSnapshot> {
  status: typeof CONTRACT_SNAPSHOT_RESULT_STATUS.FETCHED;
  value: CachedContractSnapshot<TSnapshot>;
  revalidationError?: never;
}

interface StaleFallbackContractSnapshotResult<TSnapshot> {
  status: typeof CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK;
  value: CachedContractSnapshot<TSnapshot>;
  revalidationError: SerializableRevalidationError;
}

interface ContractSnapshotResultByStatus<TSnapshot> {
  [CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE]: FreshCacheContractSnapshotResult<TSnapshot>;
  [CONTRACT_SNAPSHOT_RESULT_STATUS.FETCHED]: FetchedContractSnapshotResult<TSnapshot>;
  [CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK]: StaleFallbackContractSnapshotResult<TSnapshot>;
}

export type ContractSnapshotResult<TSnapshot> =
  ContractSnapshotResultByStatus<TSnapshot>[keyof ContractSnapshotResultByStatus<TSnapshot>];

export class ContractSnapshotUnavailableError extends Error {
  override readonly name = "ContractSnapshotUnavailableError";

  constructor(cause: unknown) {
    super("A contract snapshot could not be loaded from cache or source", { cause });
  }
}

export class ContractSnapshotSourceUnavailableError extends Error {
  override readonly name = "ContractSnapshotSourceUnavailableError";
}

function serializeRevalidationError(error: unknown): SerializableRevalidationError {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}

export async function getFreshContractSnapshot<TSnapshot>(
  dependencies: GetFreshContractSnapshotDependencies<TSnapshot>,
  input: GetFreshContractSnapshotInput
): Promise<ContractSnapshotResult<TSnapshot>> {
  if (!Number.isFinite(input.ttlMs) || input.ttlMs < 0)
    throw new RangeError("ttlMs must be non-negative");
  const now = dependencies.now?.() ?? new Date();
  const cached = await dependencies.cache.getCurrent(input.identity);
  if (cached && now.getTime() - new Date(cached.revalidatedAt).getTime() <= input.ttlMs) {
    return { status: CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE, value: cached };
  }

  const revalidationRevision = await dependencies.cache.reserveRevalidation(input.identity);
  let fetched: ContractSnapshotFetchResult<TSnapshot>;
  try {
    fetched = await dependencies.fetcher.fetch(input.identity, input.signal);
  } catch (error) {
    if (
      error instanceof ContractSnapshotSourceUnavailableError &&
      cached &&
      input.allowStaleOnFetchError
    ) {
      return {
        status: CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK,
        value: cached,
        revalidationError: serializeRevalidationError(error),
      };
    }
    if (error instanceof ContractSnapshotSourceUnavailableError)
      throw new ContractSnapshotUnavailableError(error);
    throw error;
  }

  const value = await dependencies.cache.store({
    identity: input.identity,
    snapshot: fetched.snapshot,
    contentHash: fetched.contentHash,
    observedAt: fetched.observedAt,
    fetchedAt: (dependencies.now?.() ?? new Date()).toISOString(),
    revalidationRevision,
  });
  return { status: CONTRACT_SNAPSHOT_RESULT_STATUS.FETCHED, value };
}
