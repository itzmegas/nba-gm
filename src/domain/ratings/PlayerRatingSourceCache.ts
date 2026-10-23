import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";

export interface SourcePlayerRating {
  slug: string;
  name: string;
  team: string;
  teamType: string;
  gameVersion: string;
  lastUpdated: string;
  overall: number;
  attributes: PlayerAttributes;
}

export interface ExcludedSourcePlayerRating {
  slug: string;
  name: string;
  invalidAttributes: readonly string[];
}

export interface PlayerRatingSourceSnapshot {
  source: string;
  sourceUrl: string;
  gameVersion: string;
  observedAt: string;
  contentHash: string;
  requestCount: number;
  players: readonly SourcePlayerRating[];
  excludedPlayers: readonly ExcludedSourcePlayerRating[];
}

export interface CachedPlayerRatings {
  versionId: string;
  revalidatedAt: string;
  snapshot: PlayerRatingSourceSnapshot;
}

export interface PlayerRatingCacheReservation {
  leaseId: string | null;
  current: CachedPlayerRatings | null;
  fresh: boolean;
  refreshInProgress: boolean;
}

export interface PlayerRatingSourceCache {
  acquire(): Promise<PlayerRatingCacheReservation>;
  publish(leaseId: string, snapshot: PlayerRatingSourceSnapshot): Promise<CachedPlayerRatings>;
  fail(leaseId: string): Promise<void>;
}
