import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
  ContractSnapshotCacheIdentity,
  StoreContractSnapshotInput,
} from "@/domain/contracts/ContractSnapshotCache";

const cacheRowSchema = z.object({
  version_id: z.uuid(),
  source: z.string().min(1),
  team: z.string().min(1),
  season: z.string().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  // PostgREST serializes PostgreSQL TIMESTAMPTZ values with an explicit offset.
  observed_at: z.iso.datetime({ offset: true }),
  stored_at: z.iso.datetime({ offset: true }),
  revalidated_at: z.iso.datetime({ offset: true }),
  payload: z.unknown(),
});

export class ContractSnapshotCacheResponseError extends Error {
  override readonly name = "ContractSnapshotCacheResponseError";
}

export class SupabaseContractSnapshotCache<TSnapshot> implements ContractSnapshotCache<TSnapshot> {
  constructor(
    private readonly client: SupabaseClient,
    private readonly snapshotSchema: z.ZodType<TSnapshot>
  ) {}

  async getCurrent(
    identity: ContractSnapshotCacheIdentity
  ): Promise<CachedContractSnapshot<TSnapshot> | null> {
    const { data, error } = await this.client
      .from("current_contract_source_snapshots")
      .select(
        "source, team, season, version_id, revalidated_at, contract_source_snapshot_versions!inner(content_hash, observed_at, stored_at, payload)"
      )
      .eq("source", identity.source)
      .eq("team", identity.team)
      .eq("season", identity.season)
      .maybeSingle();
    if (error) throw new Error(`Failed to read contract snapshot cache: ${error.message}`);
    if (!data) return null;
    const version = Array.isArray(data.contract_source_snapshot_versions)
      ? data.contract_source_snapshot_versions[0]
      : data.contract_source_snapshot_versions;
    return this.parseRow({ ...data, ...version });
  }

  async store(
    input: StoreContractSnapshotInput<TSnapshot>
  ): Promise<CachedContractSnapshot<TSnapshot>> {
    const snapshot = this.snapshotSchema.parse(input.snapshot);
    const { data, error } = await this.client.rpc("store_contract_source_snapshot", {
      p_source: input.identity.source,
      p_team: input.identity.team,
      p_season: input.identity.season,
      p_source_url: this.sourceUrl(snapshot),
      p_observed_at: input.observedAt,
      p_fetched_at: input.fetchedAt,
      p_revalidation_revision: input.revalidationRevision,
      p_content_hash: input.contentHash,
      p_payload: snapshot,
    });
    if (error) throw new Error(`Failed to store contract snapshot cache: ${error.message}`);
    const row = parseRpcRow(data);
    return this.parseRow(row);
  }

  async reserveRevalidation(identity: ContractSnapshotCacheIdentity): Promise<number> {
    const { data, error } = await this.client.rpc("reserve_contract_snapshot_revalidation", {
      p_source: identity.source,
      p_team: identity.team,
      p_season: identity.season,
    });
    if (error)
      throw new Error(`Failed to reserve contract snapshot revalidation: ${error.message}`);
    return z.number().int().positive().safe().parse(data);
  }

  private sourceUrl(snapshot: TSnapshot): string {
    const result = z.object({ metadata: z.object({ sourceUrl: z.url() }) }).safeParse(snapshot);
    if (!result.success) throw new Error("Contract snapshot is missing a valid source URL");
    return result.data.metadata.sourceUrl;
  }

  private parseRow(value: unknown): CachedContractSnapshot<TSnapshot> {
    const row = cacheRowSchema.parse(value);
    return {
      versionId: row.version_id,
      identity: { source: row.source, team: row.team, season: row.season },
      snapshot: this.snapshotSchema.parse(row.payload),
      contentHash: row.content_hash,
      observedAt: row.observed_at,
      storedAt: row.stored_at,
      revalidatedAt: row.revalidated_at,
    };
  }
}

function parseRpcRow(data: unknown): unknown {
  if (data === null || data === undefined) {
    throw new ContractSnapshotCacheResponseError(
      "Contract snapshot cache RPC returned no rows; expected exactly one row"
    );
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new ContractSnapshotCacheResponseError(
        "Contract snapshot cache RPC returned an empty table result; expected exactly one row"
      );
    }
    if (data.length !== 1) {
      throw new ContractSnapshotCacheResponseError(
        `Contract snapshot cache RPC returned ${data.length} rows; expected exactly one row`
      );
    }
    return data[0];
  }
  if (typeof data !== "object") {
    throw new ContractSnapshotCacheResponseError(
      "Contract snapshot cache RPC returned a non-object result; expected one table row"
    );
  }
  return data;
}
