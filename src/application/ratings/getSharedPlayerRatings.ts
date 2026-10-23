import type {
  CachedPlayerRatings,
  PlayerRatingSourceCache,
  PlayerRatingSourceSnapshot,
} from "@/domain/ratings/PlayerRatingSourceCache";

export const PLAYER_RATING_CACHE_STATUS = {
  FRESH: "fresh-cache",
  FETCHED: "fetched",
  STALE: "stale-cache",
} as const;

export interface SharedPlayerRatingsResult {
  status: (typeof PLAYER_RATING_CACHE_STATUS)[keyof typeof PLAYER_RATING_CACHE_STATUS];
  value: CachedPlayerRatings;
}

export interface SharedPlayerRatingsDependencies {
  cache: PlayerRatingSourceCache;
  fetchSnapshot: (signal?: AbortSignal) => Promise<PlayerRatingSourceSnapshot>;
  wait?: (signal?: AbortSignal) => Promise<void>;
}

async function waitForOwner(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, 250);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

export async function getSharedPlayerRatings(
  dependencies: SharedPlayerRatingsDependencies,
  signal?: AbortSignal
): Promise<SharedPlayerRatingsResult> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    signal?.throwIfAborted();
    const reservation = await dependencies.cache.acquire();
    if (signal?.aborted) {
      if (reservation.leaseId) await dependencies.cache.fail(reservation.leaseId);
      signal.throwIfAborted();
    }
    if (reservation.leaseId) {
      let snapshot: PlayerRatingSourceSnapshot;
      try {
        snapshot = await dependencies.fetchSnapshot(signal);
        signal?.throwIfAborted();
      } catch {
        await dependencies.cache.fail(reservation.leaseId);
        signal?.throwIfAborted();
        if (!reservation.current) throw new Error("Player ratings source and cache unavailable");
        return { status: PLAYER_RATING_CACHE_STATUS.STALE, value: reservation.current };
      }
      return {
        status: PLAYER_RATING_CACHE_STATUS.FETCHED,
        value: await dependencies.cache.publish(reservation.leaseId, snapshot),
      };
    }
    if (reservation.current) {
      return {
        status: reservation.fresh
          ? PLAYER_RATING_CACHE_STATUS.FRESH
          : PLAYER_RATING_CACHE_STATUS.STALE,
        value: reservation.current,
      };
    }
    if (!reservation.refreshInProgress) {
      throw new Error("Player ratings source and cache unavailable");
    }
    await (dependencies.wait ?? waitForOwner)(signal);
  }
  throw new Error("Player ratings cache initialization timed out");
}
