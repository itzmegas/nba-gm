import { describe, expect, it, vi } from "vitest";
import { materializeGamePlayerAttributes } from "@/application/ratings/materializeGamePlayerAttributes";
import type { PlayerRatingSourceCache } from "@/domain/ratings/PlayerRatingSourceCache";

const gameId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const playerId = "00000000-0000-4000-8000-000000000003";
const sourceVersionId = "00000000-0000-4000-8000-000000000004";
const attrs = {
  closeShot: 60,
  midRangeShot: 60,
  threePointShot: 60,
  freeThrow: 60,
  drawFoul: 60,
  ballHandle: 60,
  passAccuracy: 60,
  interiorDefense: 60,
  perimeterDefense: 60,
  steal: 60,
  block: 60,
  offensiveRebound: 60,
  defensiveRebound: 60,
  stamina: 60,
};
const snapshot = {
  source: "nba2kapi",
  sourceUrl: "https://api.nba2kapi.com/api/players/bulk?teamType=curr",
  gameVersion: "2K27",
  observedAt: "2026-10-23T00:00:00Z",
  contentHash: "a".repeat(64),
  requestCount: 1,
  players: [
    {
      slug: "test-player",
      name: "Test Player",
      team: "Boston Celtics",
      teamType: "curr",
      gameVersion: "2K27",
      lastUpdated: "2026-10-23T00:00:00Z",
      overall: 75,
      attributes: attrs,
      height: "6'4\"",
      positions: ["PG"],
    },
  ],
  excludedPlayers: [],
};

function setup() {
  const rpc = vi.fn().mockResolvedValue({
    data: { status: "materialized", playerCount: 1, sourceVersionId },
    error: null,
  });
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [
          {
            player_id: playerId,
            players: { full_name: "Test Player", espn_id: 123, height: "6' 4\"", position: "G" },
            teams: { abbreviation: "BOS" },
          },
        ],
        error: null,
      }),
    }),
    rpc,
  };
  const cache: PlayerRatingSourceCache = {
    acquire: vi.fn().mockResolvedValue({
      leaseId: null,
      current: { versionId: sourceVersionId, revalidatedAt: "2026-10-23T00:00:00Z", snapshot },
      fresh: true,
      refreshInProgress: false,
    }),
    publish: vi.fn(),
    fail: vi.fn(),
  };
  return { client, cache, rpc };
}

describe("materializeGamePlayerAttributes", () => {
  it("loads a paginated game roster, reuses shared source and calls one RPC", async () => {
    const { client, cache, rpc } = setup();
    const result = await materializeGamePlayerAttributes({
      gameId,
      ownerId,
      seasonYear: 2026,
      serviceClient: client as never,
      cache,
      fetchSnapshot: vi.fn(),
    });
    expect(result).toEqual({ status: "materialized", playerCount: 1, sourceVersionId });
    expect(cache.acquire).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "materialize_game_player_attributes",
      expect.objectContaining({
        p_game_id: gameId,
        p_owner_id: ownerId,
        p_season_year: 2026,
        p_source_version_id: sourceVersionId,
        p_rows: [
          expect.objectContaining({ playerId, origin: "nba2kapi", sourceSlug: "test-player" }),
        ],
      })
    );
  });

  it("does not call the provider per player", async () => {
    const { client, cache, rpc } = setup();
    const fetchSnapshot = vi.fn();
    await materializeGamePlayerAttributes({
      gameId,
      ownerId,
      seasonYear: 2026,
      serviceClient: client as never,
      cache,
      fetchSnapshot,
    });
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("redacts database errors and rejects malformed RPC results", async () => {
    const { client, cache } = setup();
    const rpc = vi.fn().mockResolvedValue({ data: { leaked: true }, error: null });
    (client as { rpc: typeof rpc }).rpc = rpc;
    await expect(
      materializeGamePlayerAttributes({
        gameId,
        ownerId,
        seasonYear: 2026,
        serviceClient: client as never,
        cache,
        fetchSnapshot: vi.fn(),
      })
    ).rejects.toThrow();
    const failing = setup();
    failing.rpc.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    await expect(
      materializeGamePlayerAttributes({
        gameId,
        ownerId,
        seasonYear: 2026,
        serviceClient: failing.client as never,
        cache: failing.cache,
        fetchSnapshot: vi.fn(),
      })
    ).rejects.toThrow(/^Failed to materialize game player attributes$/);
  });
});
