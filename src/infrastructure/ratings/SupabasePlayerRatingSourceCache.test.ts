import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  NBA2K_BULK_RATINGS_URL,
  playerRatingSourceSnapshotSchema,
} from "@/infrastructure/ratings/nba2kRatingsSource";
import { SupabasePlayerRatingSourceCache } from "@/infrastructure/ratings/SupabasePlayerRatingSourceCache";

const player = {
  slug: "synthetic-player",
  name: "Synthetic Player",
  team: "Test Team",
  teamType: "curr",
  gameVersion: "2K27",
  lastUpdated: "2026-10-23T00:00:00Z",
  overall: 70,
  attributes: {
    closeShot: 70,
    midRangeShot: 70,
    threePointShot: 70,
    freeThrow: 70,
    drawFoul: 70,
    ballHandle: 70,
    passAccuracy: 70,
    interiorDefense: 70,
    perimeterDefense: 70,
    steal: 70,
    block: 70,
    offensiveRebound: 70,
    defensiveRebound: 70,
    stamina: 70,
  },
};
const snapshot = {
  source: "nba2kapi",
  sourceUrl: NBA2K_BULK_RATINGS_URL,
  gameVersion: "2K27",
  observedAt: "2026-10-23T00:00:00Z",
  contentHash: createHash("sha256")
    .update(JSON.stringify({ players: [player], excludedPlayers: [] }))
    .digest("hex"),
  requestCount: 1,
  players: [player],
  excludedPlayers: [],
};
const token = "00000000-0000-4000-8000-000000000001";
const cached = { version_id: token, revalidated_at: "2026-10-23T01:00:00+00:00", snapshot };
const reservation = { lease_id: null, current: cached, fresh: true, refresh_in_progress: false };

function setup(data: unknown = reservation, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { rpc, cache: new SupabasePlayerRatingSourceCache({ rpc } as unknown as SupabaseClient) };
}

describe("SupabasePlayerRatingSourceCache", () => {
  it("maps JSONB reservations and PostgreSQL timestamp offsets", async () => {
    const { rpc, cache } = setup();
    expect(await cache.acquire()).toEqual({
      leaseId: null,
      current: { versionId: token, revalidatedAt: cached.revalidated_at, snapshot },
      fresh: true,
      refreshInProgress: false,
    });
    expect(rpc).toHaveBeenCalledWith("acquire_player_rating_refresh", { p_game_version: "2K27" });
  });

  it("accepts an empty reservation while a first download is in progress", async () => {
    const { cache } = setup({
      lease_id: null,
      current: null,
      fresh: false,
      refresh_in_progress: true,
    });
    expect((await cache.acquire()).refreshInProgress).toBe(true);
  });

  it.each([
    null,
    [reservation],
    { ...reservation, lease_id: "invalid" },
    { ...reservation, current: null },
    { ...reservation, lease_id: token, refresh_in_progress: true },
    {
      ...reservation,
      current: { ...cached, snapshot: { ...snapshot, contentHash: "a".repeat(64) } },
    },
    { ...reservation, current: { ...cached, snapshot: { ...snapshot, gameVersion: "2K26" } } },
    { ...reservation, current: { ...cached, snapshot: { ...snapshot, players: [] } } },
  ])("rejects malformed or corrupt persisted cache data", async (data) => {
    await expect(setup(data).cache.acquire()).rejects.toThrow(
      "Invalid player rating cache response"
    );
  });

  it("validates publication and strips fields outside the source contract", async () => {
    const { rpc, cache } = setup(cached);
    const input = { ...snapshot, apiKey: "synthetic-secret" };
    await cache.publish(token, input);
    expect(rpc).toHaveBeenCalledWith("publish_player_rating_snapshot", {
      p_game_version: "2K27",
      p_lease_id: token,
      p_snapshot: snapshot,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("synthetic-secret");
  });

  it("rejects tampered publications before any DB write", async () => {
    const { rpc, cache } = setup(cached);
    await expect(
      cache.publish(token, { ...snapshot, contentHash: "b".repeat(64) })
    ).rejects.toThrow("Invalid player rating source snapshot");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty publication response", async () => {
    await expect(setup(null).cache.publish(token, snapshot)).rejects.toThrow(
      "Invalid player rating cache response"
    );
  });

  it("releases only the owned lease through the restricted RPC", async () => {
    const { rpc, cache } = setup(null);
    await cache.fail(token);
    expect(rpc).toHaveBeenCalledWith("fail_player_rating_refresh", {
      p_game_version: "2K27",
      p_lease_id: token,
    });
  });

  it("does not expose database error details", async () => {
    const { cache } = setup(null, { message: "private payload" });
    await expect(cache.acquire()).rejects.toThrow(/^Failed to acquire player rating cache$/);
    await expect(cache.publish(token, snapshot)).rejects.toThrow(
      /^Failed to publish player rating cache$/
    );
    await expect(cache.fail(token)).rejects.toThrow(/^Failed to release player rating refresh$/);
  });

  it("rejects public snapshots and overlapping source identities", () => {
    expect(
      playerRatingSourceSnapshotSchema.safeParse({
        ...snapshot,
        sourceUrl: "https://api.nba2kapi.com/api/public/players",
      }).success
    ).toBe(false);
    const overlapping = {
      ...snapshot,
      excludedPlayers: [{ slug: player.slug, name: player.name, invalidAttributes: ["stamina"] }],
    };
    overlapping.contentHash = createHash("sha256")
      .update(
        JSON.stringify({
          players: overlapping.players,
          excludedPlayers: overlapping.excludedPlayers,
        })
      )
      .digest("hex");
    const parsed = playerRatingSourceSnapshotSchema.safeParse(overlapping);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some(({ message }) => message === "Invalid snapshot identities")
      ).toBe(true);
    }
  });
});
