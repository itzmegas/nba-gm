import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  getAllTeamContractSnapshots,
  TEAM_CONTRACT_OUTCOME_STATUS,
} from "@/application/contracts/getAllTeamContractSnapshots";
import {
  type ContractSnapshotFetcher,
  ContractSnapshotSourceUnavailableError,
} from "@/application/contracts/getFreshContractSnapshot";
import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
  ContractSnapshotCacheIdentity,
  StoreContractSnapshotInput,
} from "@/domain/contracts/ContractSnapshotCache";
import { CONTRACT_SOURCE } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";

interface TestSnapshot {
  team: string;
}

const season = "2026-27";
const hash = "a".repeat(64);
const nowIso = "2026-08-24T12:00:00.000Z";
const teams = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
  ({ nbaAbbreviation, basketballReferenceAbbreviation }) => ({
    nbaAbbreviation,
    sourceTeam: basketballReferenceAbbreviation,
  })
);

function cached(
  identity: ContractSnapshotCacheIdentity,
  revalidatedAt = nowIso
): CachedContractSnapshot<TestSnapshot> {
  return {
    versionId: "11111111-1111-4111-8111-111111111111",
    identity,
    snapshot: { team: identity.team },
    contentHash: hash,
    observedAt: nowIso,
    storedAt: nowIso,
    revalidatedAt,
  };
}

function harness(
  options: {
    current?: (
      identity: ContractSnapshotCacheIdentity
    ) => CachedContractSnapshot<TestSnapshot> | null;
    fetch?: (
      identity: ContractSnapshotCacheIdentity,
      signal?: AbortSignal
    ) => Promise<{ snapshot: TestSnapshot; contentHash: string; observedAt: string }>;
  } = {}
) {
  const store = vi.fn(async (input: StoreContractSnapshotInput<TestSnapshot>) =>
    cached(input.identity)
  );
  const cache: ContractSnapshotCache<TestSnapshot> = {
    getCurrent: vi.fn(async (identity) => options.current?.(identity) ?? null),
    reserveRevalidation: vi.fn(async () => 1),
    store,
  };
  const fetch = vi.fn(
    options.fetch ??
      (async (identity: ContractSnapshotCacheIdentity) => ({
        snapshot: { team: identity.team },
        contentHash: hash,
        observedAt: nowIso,
      }))
  );
  const fetcher: ContractSnapshotFetcher<TestSnapshot> = { fetch };
  return { cache, fetcher, fetch, store, now: () => new Date(nowIso) };
}

const input = {
  teams,
  source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
  season,
  ttlMs: 60_000,
  allowStaleOnFetchError: true,
};

describe("getAllTeamContractSnapshots", () => {
  it("reports all 30 teams in authoritative order with mapped cache identities", async () => {
    const dependencies = harness({
      current: (identity) => cached(identity),
    });
    const progress = vi.fn();
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, onProgress: progress },
      input
    );

    expect(result.complete).toBe(true);
    expect(result.outcomes).toHaveLength(30);
    expect(result.outcomes.map(({ nbaAbbreviation }) => nbaAbbreviation)).toEqual(
      teams.map(({ nbaAbbreviation }) => nbaAbbreviation)
    );
    expect(
      result.outcomes.find(({ nbaAbbreviation }) => nbaAbbreviation === "BKN")?.identity
    ).toEqual({
      source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
      team: "BRK",
      season,
    });
    expect(progress).toHaveBeenCalledTimes(30);
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: 30, total: 30 })
    );
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it("throttles only between actual sequential source fetches", async () => {
    let clock = 0;
    const dependencies = harness({
      current: (identity) => (identity.team === "BRK" ? cached(identity) : null),
    });
    const wait = vi.fn(async (milliseconds: number) => {
      clock += milliseconds;
    });
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, nowMs: () => clock, wait },
      { ...input, teams: teams.slice(0, 3) }
    );

    expect(result.outcomes.map(({ status }) => status)).toEqual([
      TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
      TEAM_CONTRACT_OUTCOME_STATUS.FRESH,
      TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
    ]);
    expect(dependencies.fetch).toHaveBeenCalledTimes(2);
    expect(dependencies.fetch.mock.calls.map(([identity]) => identity.team)).toEqual([
      "ATL",
      "BOS",
    ]);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(3_000, undefined);
  });

  it("reports stale fallback without losing batch completeness", async () => {
    const dependencies = harness({
      current: (identity) => cached(identity, "2026-08-24T10:00:00.000Z"),
      fetch: async () => {
        throw new ContractSnapshotSourceUnavailableError("offline");
      },
    });
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, now: () => new Date(nowIso), wait: async () => undefined },
      { ...input, teams: teams.slice(0, 1), ttlMs: 1 }
    );

    expect(result.complete).toBe(true);
    expect(result.canonicalSnapshots).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({
      status: TEAM_CONTRACT_OUTCOME_STATUS.STALE_FALLBACK,
      error: { message: "offline" },
    });
  });

  it("keeps successful cache writes but never labels a partial result canonical", async () => {
    const dependencies = harness({
      fetch: async (identity) => {
        if (identity.team === "BRK") throw new Error("fixture failure");
        return { snapshot: { team: identity.team }, contentHash: hash, observedAt: nowIso };
      },
    });
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, wait: async () => undefined },
      { ...input, teams: teams.slice(0, 3) }
    );

    expect(result.complete).toBe(false);
    expect(result.canonicalSnapshots).toBeNull();
    expect(result.outcomes.map(({ status }) => status)).toEqual([
      TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
      TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
      TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
    ]);
    expect(result.outcomes).toContainEqual(
      expect.objectContaining({
        nbaAbbreviation: "BKN",
        sourceTeam: "BRK",
        identity: {
          source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
          team: "BRK",
          season,
        },
        error: { name: "Error", message: "fixture failure" },
      })
    );
    expect(dependencies.store).toHaveBeenCalledTimes(2);
  });

  it("summarizes Zod cache failures without including issue messages or payload values", async () => {
    const parsed = z
      .object({
        version_id: z.uuid(),
        payload: z.object({ contract: z.string() }),
      })
      .safeParse({ version_id: "not-a-uuid", payload: "raw provider body" });
    if (parsed.success) throw new Error("Expected the diagnostic fixture to fail validation");

    const dependencies = harness({
      current: () => {
        throw parsed.error;
      },
    });
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, wait: async () => undefined },
      { ...input, teams: teams.slice(0, 1) }
    );
    const diagnostic = result.outcomes[0];

    expect(diagnostic).toMatchObject({
      status: TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
      error: {
        name: "ZodError",
        message: expect.stringContaining("path=version_id code=invalid_format"),
      },
    });
    if (diagnostic.status !== TEAM_CONTRACT_OUTCOME_STATUS.FAILED) {
      throw new Error("Expected a failed team outcome");
    }
    expect(diagnostic.error.message).toContain("path=payload code=invalid_type");
    expect(diagnostic.error.message).toContain("expected=object");
    expect(diagnostic.error.message).not.toContain("raw provider body");
    expect(diagnostic.error.message).not.toContain("expected the string");
    expect(diagnostic.error.message.length).toBeLessThanOrEqual(500);
  });

  it("stops source work after abort and reports every remaining team deterministically", async () => {
    const controller = new AbortController();
    const dependencies = harness({
      fetch: async (identity) => {
        controller.abort();
        return { snapshot: { team: identity.team }, contentHash: hash, observedAt: nowIso };
      },
    });
    const result = await getAllTeamContractSnapshots(
      { ...dependencies, wait: async () => undefined },
      { ...input, teams: teams.slice(0, 3), signal: controller.signal }
    );

    expect(dependencies.fetch).toHaveBeenCalledTimes(1);
    expect(result.complete).toBe(false);
    expect(result.outcomes.map(({ status }) => status)).toEqual([
      TEAM_CONTRACT_OUTCOME_STATUS.FETCHED,
      TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
      TEAM_CONTRACT_OUTCOME_STATUS.FAILED,
    ]);
    expect(result.outcomes[1]).toMatchObject({ error: { name: "AbortError" } });
  });

  it("rejects crawl delays below three seconds before touching cache or source", async () => {
    const dependencies = harness();
    await expect(
      getAllTeamContractSnapshots(dependencies, { ...input, minimumFetchIntervalMs: 2_999 })
    ).rejects.toThrow("at least 3000");
    expect(dependencies.cache.getCurrent).not.toHaveBeenCalled();
    expect(dependencies.fetch).not.toHaveBeenCalled();
  });

  it("has no legacy game or contract persistence dependency", () => {
    const dependencies = harness();
    expect(Object.keys(dependencies.cache).sort()).toEqual([
      "getCurrent",
      "reserveRevalidation",
      "store",
    ]);
  });
});
