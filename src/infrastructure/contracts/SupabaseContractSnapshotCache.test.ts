import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SupabaseContractSnapshotCache } from "@/infrastructure/contracts/SupabaseContractSnapshotCache";

const snapshotSchema = z.object({
  metadata: z.object({ sourceUrl: z.url() }),
  contracts: z.array(z.unknown()),
});
const identity = { source: "basketball-reference", team: "LAL", season: "2026-27" };
const snapshot = { metadata: { sourceUrl: "https://example.com/contracts" }, contracts: [] };
const rpcRow = {
  version_id: "11111111-1111-4111-8111-111111111111",
  ...identity,
  content_hash: "a".repeat(64),
  observed_at: "2026-08-24T12:00:00+00:00",
  stored_at: "2026-08-24T12:00:01+00:00",
  revalidated_at: "2026-08-24T12:00:01+00:00",
  payload: snapshot,
};

const storeInput = {
  identity,
  snapshot,
  contentHash: "a".repeat(64),
  observedAt: "2026-08-24T12:00:00.000Z",
  fetchedAt: "2026-08-24T12:00:01.000Z",
  revalidationRevision: 1,
};

function mockReadClient(payload: unknown) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: payload, error: null }),
  };
  return { from: () => chain };
}

describe("SupabaseContractSnapshotCache", () => {
  it("rejects malformed persisted payloads at the database boundary", async () => {
    const client = mockReadClient({
      version_id: "11111111-1111-4111-8111-111111111111",
      source: "basketball-reference",
      team: "LAL",
      season: "2026-27",
      revalidated_at: "2026-08-24T12:00:00.000Z",
      contract_source_snapshot_versions: {
        content_hash: "a".repeat(64),
        observed_at: "2026-08-24T12:00:00.000Z",
        stored_at: "2026-08-24T12:00:00.000Z",
        payload: { malformed: true },
      },
    });
    const cache = new SupabaseContractSnapshotCache(client as never, snapshotSchema);
    await expect(
      cache.getCurrent({ source: "basketball-reference", team: "LAL", season: "2026-27" })
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it("parses a PostgREST array table-return response with timestamptz offsets", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 7, error: null })
      .mockResolvedValueOnce({ data: [rpcRow], error: null });
    const cache = new SupabaseContractSnapshotCache({ rpc } as never, snapshotSchema);
    await expect(cache.reserveRevalidation(identity)).resolves.toBe(7);
    await expect(cache.store({ ...storeInput, revalidationRevision: 7 })).resolves.toMatchObject({
      identity,
      snapshot,
      observedAt: rpcRow.observed_at,
      storedAt: rpcRow.stored_at,
      revalidatedAt: rpcRow.revalidated_at,
    });
    expect(rpc).toHaveBeenLastCalledWith(
      "store_contract_source_snapshot",
      expect.objectContaining({ p_revalidation_revision: 7 })
    );
  });

  it("propagates RPC authorization and malformed response failures", async () => {
    const denied = new SupabaseContractSnapshotCache(
      {
        rpc: vi.fn(async () => ({ data: null, error: { message: "permission denied" } })),
      } as never,
      snapshotSchema
    );
    await expect(denied.reserveRevalidation(identity)).rejects.toThrow("permission denied");

    const malformed = new SupabaseContractSnapshotCache(
      { rpc: vi.fn(async () => ({ data: { malformed: true }, error: null })) } as never,
      snapshotSchema
    );
    await expect(malformed.store(storeInput)).rejects.toBeInstanceOf(z.ZodError);
  });

  it.each([
    null,
    [],
  ])("rejects an empty RPC table result (%s) with an actionable error", async (data) => {
    const cache = new SupabaseContractSnapshotCache(
      { rpc: vi.fn(async () => ({ data, error: null })) } as never,
      snapshotSchema
    );

    await expect(cache.store(storeInput)).rejects.toMatchObject({
      name: "ContractSnapshotCacheResponseError",
    });
    await expect(cache.store(storeInput)).rejects.toThrow("expected exactly one row");
  });
});
