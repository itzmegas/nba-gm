import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  CachedPlayerRatings,
  PlayerRatingCacheReservation,
  PlayerRatingSourceCache,
  PlayerRatingSourceSnapshot,
} from "@/domain/ratings/PlayerRatingSourceCache";
import { playerRatingSourceSnapshotSchema } from "@/infrastructure/ratings/nba2kRatingsSource";

const cachedSchema = z
  .object({
    version_id: z.uuid(),
    revalidated_at: z.iso.datetime({ offset: true }),
    snapshot: playerRatingSourceSnapshotSchema,
  })
  .transform(
    (row): CachedPlayerRatings => ({
      versionId: row.version_id,
      revalidatedAt: row.revalidated_at,
      snapshot: row.snapshot,
    })
  );

const reservationSchema = z
  .object({
    lease_id: z.uuid().nullable(),
    current: cachedSchema.nullable(),
    fresh: z.boolean(),
    refresh_in_progress: z.boolean(),
  })
  .refine((row) => !(row.fresh && !row.current) && !(row.lease_id && row.refresh_in_progress));

export class SupabasePlayerRatingSourceCache implements PlayerRatingSourceCache {
  constructor(private readonly client: SupabaseClient) {}

  async acquire(): Promise<PlayerRatingCacheReservation> {
    const { data, error } = await this.client.rpc("acquire_player_rating_refresh", {
      p_game_version: "2K27",
    });
    if (error) throw new Error("Failed to acquire player rating cache");
    const parsed = reservationSchema.safeParse(data);
    if (!parsed.success) throw new Error("Invalid player rating cache response");
    return {
      leaseId: parsed.data.lease_id,
      current: parsed.data.current,
      fresh: parsed.data.fresh,
      refreshInProgress: parsed.data.refresh_in_progress,
    };
  }

  async publish(
    leaseId: string,
    snapshot: PlayerRatingSourceSnapshot
  ): Promise<CachedPlayerRatings> {
    const token = z.uuid().parse(leaseId);
    const parsed = playerRatingSourceSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) throw new Error("Invalid player rating source snapshot");
    const { data, error } = await this.client.rpc("publish_player_rating_snapshot", {
      p_game_version: "2K27",
      p_lease_id: token,
      p_snapshot: parsed.data,
    });
    if (error) throw new Error("Failed to publish player rating cache");
    const cached = cachedSchema.safeParse(data);
    if (!cached.success || cached.data.snapshot.contentHash !== parsed.data.contentHash) {
      throw new Error("Invalid player rating cache response");
    }
    return cached.data;
  }

  async fail(leaseId: string): Promise<void> {
    const token = z.uuid().parse(leaseId);
    const { error } = await this.client.rpc("fail_player_rating_refresh", {
      p_game_version: "2K27",
      p_lease_id: token,
    });
    if (error) throw new Error("Failed to release player rating refresh");
  }
}
