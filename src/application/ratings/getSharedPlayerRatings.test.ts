import { afterEach, describe, expect, it, vi } from "vitest";
import { getSharedPlayerRatings } from "@/application/ratings/getSharedPlayerRatings";
import type {
  CachedPlayerRatings,
  PlayerRatingCacheReservation,
} from "@/domain/ratings/PlayerRatingSourceCache";

const current: CachedPlayerRatings = {
  versionId: "00000000-0000-4000-8000-000000000001",
  revalidatedAt: "2026-10-23T00:00:00Z",
  snapshot: {
    source: "nba2kapi",
    sourceUrl: "https://api.nba2kapi.com/api/players/bulk?teamType=curr",
    gameVersion: "2K27",
    observedAt: "2026-10-23T00:00:00Z",
    contentHash: "a".repeat(64),
    requestCount: 1,
    players: [],
    excludedPlayers: [],
  },
};

afterEach(() => vi.useRealTimers());

function setup(overrides: Partial<PlayerRatingCacheReservation> = {}) {
  const reservation: PlayerRatingCacheReservation = {
    leaseId: null,
    current,
    fresh: true,
    refreshInProgress: false,
    ...overrides,
  };
  return {
    cache: {
      acquire: vi.fn().mockResolvedValue(reservation),
      publish: vi.fn().mockResolvedValue(current),
      fail: vi.fn().mockResolvedValue(undefined),
    },
    fetchSnapshot: vi.fn().mockResolvedValue(current.snapshot),
    wait: vi.fn().mockResolvedValue(undefined),
  };
}

describe("getSharedPlayerRatings", () => {
  it("serves many consumers from a fresh cache without provider requests", async () => {
    const deps = setup();
    const results = await Promise.all(
      Array.from({ length: 50 }, () => getSharedPlayerRatings(deps))
    );
    expect(results.every((result) => result.status === "fresh-cache")).toBe(true);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
    expect(deps.cache.publish).not.toHaveBeenCalled();
  });

  it("fetches and publishes only when granted a refresh lease", async () => {
    const deps = setup({ leaseId: "lease", current: null, fresh: false });
    expect(await getSharedPlayerRatings(deps)).toEqual({ status: "fetched", value: current });
    expect(deps.fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.cache.publish).toHaveBeenCalledWith("lease", current.snapshot);
  });

  it("serves the last valid version while another instance refreshes", async () => {
    const deps = setup({ fresh: false, refreshInProgress: true });
    expect(await getSharedPlayerRatings(deps)).toEqual({ status: "stale-cache", value: current });
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("retains stale data and enters cooldown after a source failure", async () => {
    const deps = setup({ leaseId: "lease", fresh: false });
    deps.fetchSnapshot.mockRejectedValue(new Error("private source error"));
    expect(await getSharedPlayerRatings(deps)).toEqual({ status: "stale-cache", value: current });
    expect(deps.cache.fail).toHaveBeenCalledWith("lease");
    expect(deps.cache.publish).not.toHaveBeenCalled();
  });

  it("never fabricates external data when the initial download fails", async () => {
    const deps = setup({ leaseId: "lease", current: null, fresh: false });
    deps.fetchSnapshot.mockRejectedValue(new Error("private source error"));
    await expect(getSharedPlayerRatings(deps)).rejects.toThrow("source and cache unavailable");
    expect(deps.cache.fail).toHaveBeenCalledWith("lease");
  });

  it("waits for a cold-cache owner instead of starting another download", async () => {
    const deps = setup({ current: null, fresh: false, refreshInProgress: true });
    deps.cache.acquire
      .mockResolvedValueOnce({
        leaseId: null,
        current: null,
        fresh: false,
        refreshInProgress: true,
      })
      .mockResolvedValue({ leaseId: null, current, fresh: true, refreshInProgress: false });
    expect((await getSharedPlayerRatings(deps)).value).toBe(current);
    expect(deps.wait).toHaveBeenCalledTimes(1);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("bounds the wait for an unavailable initial cache", async () => {
    const deps = setup({ current: null, fresh: false, refreshInProgress: true });
    await expect(getSharedPlayerRatings(deps)).rejects.toThrow("timed out");
    expect(deps.cache.acquire).toHaveBeenCalledTimes(100);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("fails fast when a cold source is in cooldown", async () => {
    const deps = setup({ current: null, fresh: false });
    await expect(getSharedPlayerRatings(deps)).rejects.toThrow("source and cache unavailable");
    expect(deps.wait).not.toHaveBeenCalled();
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("does not hide persistence errors behind a stale fallback", async () => {
    const deps = setup({ leaseId: "lease", fresh: false });
    deps.cache.publish.mockRejectedValue(new Error("Database unavailable"));
    await expect(getSharedPlayerRatings(deps)).rejects.toThrow("Database unavailable");
    expect(deps.cache.fail).not.toHaveBeenCalled();
  });

  it("honors cancellation before acquisition", async () => {
    const deps = setup();
    await expect(getSharedPlayerRatings(deps, AbortSignal.abort())).rejects.toThrow();
    expect(deps.cache.acquire).not.toHaveBeenCalled();
  });

  it("releases the refresh lease on cancellation without serving stale data", async () => {
    const deps = setup({ leaseId: "lease", fresh: false });
    const controller = new AbortController();
    deps.fetchSnapshot.mockImplementation(async () => {
      controller.abort();
      controller.signal.throwIfAborted();
    });
    await expect(getSharedPlayerRatings(deps, controller.signal)).rejects.toThrow();
    expect(deps.cache.fail).toHaveBeenCalledWith("lease");
    expect(deps.cache.publish).not.toHaveBeenCalled();
  });

  it("releases a lease acquired just as the caller cancels", async () => {
    const deps = setup();
    const controller = new AbortController();
    deps.cache.acquire.mockImplementationOnce(async () => {
      controller.abort();
      return { leaseId: "lease", current, fresh: false, refreshInProgress: false };
    });
    await expect(getSharedPlayerRatings(deps, controller.signal)).rejects.toThrow();
    expect(deps.cache.fail).toHaveBeenCalledWith("lease");
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });

  it("cancels the real wait for a cold-cache owner", async () => {
    vi.useFakeTimers();
    const deps = setup({ current: null, fresh: false, refreshInProgress: true });
    const controller = new AbortController();
    const pending = getSharedPlayerRatings(
      { cache: deps.cache, fetchSnapshot: deps.fetchSnapshot },
      controller.signal
    );
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rejected;
    expect(deps.cache.acquire).toHaveBeenCalledTimes(1);
    expect(deps.fetchSnapshot).not.toHaveBeenCalled();
  });
});
