export interface ContractSnapshotCacheIdentity {
  source: string;
  team: string;
  season: string;
}

export interface CachedContractSnapshot<TSnapshot> {
  /** Durable source version; null only for explicitly transient dry-run caches. */
  versionId: string | null;
  identity: ContractSnapshotCacheIdentity;
  snapshot: TSnapshot;
  contentHash: string;
  observedAt: string;
  storedAt: string;
  revalidatedAt: string;
}

export interface StoreContractSnapshotInput<TSnapshot> {
  identity: ContractSnapshotCacheIdentity;
  snapshot: TSnapshot;
  contentHash: string;
  observedAt: string;
  fetchedAt: string;
  revalidationRevision: number;
}

export interface ContractSnapshotCache<TSnapshot> {
  getCurrent(
    identity: ContractSnapshotCacheIdentity
  ): Promise<CachedContractSnapshot<TSnapshot> | null>;
  reserveRevalidation(identity: ContractSnapshotCacheIdentity): Promise<number>;
  store(input: StoreContractSnapshotInput<TSnapshot>): Promise<CachedContractSnapshot<TSnapshot>>;
}
