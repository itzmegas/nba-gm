import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  CONTRACT_SNAPSHOT_RESULT_STATUS,
  type ContractSnapshotFetcher,
  ContractSnapshotSourceUnavailableError,
  ContractSnapshotUnavailableError,
  getFreshContractSnapshot,
} from "@/application/contracts/getFreshContractSnapshot";
import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
  StoreContractSnapshotInput,
} from "@/domain/contracts/ContractSnapshotCache";

interface TestSnapshot {
  value: string;
}

const identity = { source: "basketball-reference", team: "LAL", season: "2026-27" };
const now = new Date("2026-08-24T12:00:00.000Z");
const hash = "a".repeat(64);

function cached(revalidatedAt: string): CachedContractSnapshot<TestSnapshot> {
  return {
    versionId: "11111111-1111-4111-8111-111111111111",
    identity,
    snapshot: { value: "cached" },
    contentHash: hash,
    observedAt: "2026-08-24T10:00:00.000Z",
    storedAt: "2026-08-24T10:00:01.000Z",
    revalidatedAt,
  };
}

function dependencies(
  current: CachedContractSnapshot<TestSnapshot> | null,
  fetchError?: Error,
  storeError?: Error
) {
  const store = vi.fn(async (input: StoreContractSnapshotInput<TestSnapshot>) => {
    if (storeError) throw storeError;
    return {
      versionId: "11111111-1111-4111-8111-111111111111",
      identity: input.identity,
      snapshot: input.snapshot,
      contentHash: input.contentHash,
      observedAt: input.observedAt,
      storedAt: input.fetchedAt,
      revalidatedAt: input.fetchedAt,
    };
  });
  const cache: ContractSnapshotCache<TestSnapshot> = {
    getCurrent: vi.fn(async () => current),
    reserveRevalidation: vi.fn(async () => 1),
    store,
  };
  const fetch = vi.fn(async () => {
    if (fetchError) throw fetchError;
    return { snapshot: { value: "source" }, contentHash: hash, observedAt: now.toISOString() };
  });
  const fetcher: ContractSnapshotFetcher<TestSnapshot> = { fetch };
  return { cache, fetcher, now: () => now, fetch, store };
}

describe("getFreshContractSnapshot", () => {
  it("returns a fresh cache hit without fetching", async () => {
    const deps = dependencies(cached("2026-08-24T11:30:00.000Z"));
    const result = await getFreshContractSnapshot(deps, {
      identity,
      ttlMs: 3_600_000,
      allowStaleOnFetchError: false,
    });
    expect(result.status).toBe(CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE);
    if (result.status === CONTRACT_SNAPSHOT_RESULT_STATUS.FRESH_CACHE)
      expectTypeOf(result.revalidationError).toEqualTypeOf<undefined>();
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it("revalidates and stores one stale snapshot", async () => {
    const deps = dependencies(cached("2026-08-24T09:00:00.000Z"));
    const controller = new AbortController();
    const result = await getFreshContractSnapshot(deps, {
      identity,
      ttlMs: 3_600_000,
      allowStaleOnFetchError: false,
      signal: controller.signal,
    });
    expect(result.status).toBe(CONTRACT_SNAPSHOT_RESULT_STATUS.FETCHED);
    if (result.status === CONTRACT_SNAPSHOT_RESULT_STATUS.FETCHED)
      expectTypeOf(result.revalidationError).toEqualTypeOf<undefined>();
    expect(deps.fetch).toHaveBeenCalledOnce();
    expect(deps.fetch).toHaveBeenCalledWith(identity, controller.signal);
    expect(deps.store).toHaveBeenCalledOnce();
  });

  it("returns an explicit stale fallback when revalidation fails", async () => {
    const deps = dependencies(
      cached("2026-08-24T09:00:00.000Z"),
      new ContractSnapshotSourceUnavailableError("offline")
    );
    const result = await getFreshContractSnapshot(deps, {
      identity,
      ttlMs: 1,
      allowStaleOnFetchError: true,
    });
    expect(result.status).toBe(CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK);
    if (result.status !== CONTRACT_SNAPSHOT_RESULT_STATUS.STALE_FALLBACK)
      throw new Error("Expected stale fallback");
    expect(result.revalidationError).toEqual({
      name: "ContractSnapshotSourceUnavailableError",
      message: "offline",
    });
    expectTypeOf(result.revalidationError).toEqualTypeOf<{ name: string; message: string }>();
  });

  it("errors when fetching fails and no cache exists", async () => {
    const deps = dependencies(null, new ContractSnapshotSourceUnavailableError("offline"));
    await expect(
      getFreshContractSnapshot(deps, { identity, ttlMs: 1, allowStaleOnFetchError: true })
    ).rejects.toBeInstanceOf(ContractSnapshotUnavailableError);
  });

  it("propagates fetch integrity failures instead of returning stale fallback", async () => {
    const integrityError = new Error("malformed source payload");
    const deps = dependencies(cached("2026-08-24T09:00:00.000Z"), integrityError);
    await expect(
      getFreshContractSnapshot(deps, { identity, ttlMs: 1, allowStaleOnFetchError: true })
    ).rejects.toBe(integrityError);
  });

  it("propagates store failures instead of returning stale fallback", async () => {
    const deps = dependencies(
      cached("2026-08-24T09:00:00.000Z"),
      undefined,
      new Error("rpc denied")
    );
    await expect(
      getFreshContractSnapshot(deps, { identity, ttlMs: 1, allowStaleOnFetchError: true })
    ).rejects.toThrow("rpc denied");
  });

  it("records successful fetch completion time rather than the pre-fetch time", async () => {
    const completion = new Date("2026-08-24T12:00:01.000Z");
    const deps = dependencies(cached("2026-08-24T09:00:00.000Z"));
    deps.now = vi.fn().mockReturnValueOnce(now).mockReturnValueOnce(completion);
    await getFreshContractSnapshot(deps, {
      identity,
      ttlMs: 1,
      allowStaleOnFetchError: false,
    });
    expect(deps.store).toHaveBeenCalledWith(
      expect.objectContaining({ fetchedAt: completion.toISOString(), revalidationRevision: 1 })
    );
  });
});
