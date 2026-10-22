import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNba2kRatings } from "@/infrastructure/ratings/nba2kRatingsSource";

const player = {
  slug: "test-player",
  name: "Test Player",
  team: "Test Team",
  teamType: "curr",
  gameVersion: "2K27",
  lastUpdated: "2026-10-17T07:28:39.718Z",
  overall: 80,
  attributes: {
    closeShot: 80,
    midRangeShot: 75,
    threePointShot: 70,
    freeThrow: 85,
    drawFoul: 60,
    ballHandle: 75,
    passAccuracy: 80,
    interiorDefense: 60,
    perimeterDefense: 70,
    steal: 65,
    block: 40,
    offensiveRebound: 35,
    defensiveRebound: 60,
    stamina: 90,
  },
};

function page(data: unknown[], total = data.length, nextCursor: string | null = null) {
  return Response.json({
    success: true,
    data,
    meta: { pagination: { count: data.length, total, hasMore: nextCursor !== null, nextCursor } },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchNba2kRatings", () => {
  it("downloads every page, keeps provenance and strips unneeded provider fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([{ ...player, badges: { total: 5 } }], 2, "1"))
      .mockResolvedValueOnce(page([{ ...player, slug: "second-player" }], 2));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNba2kRatings();

    expect(result.players).toHaveLength(2);
    expect(result.players[0]).toEqual(player);
    expect(result).toMatchObject({ source: "nba2kapi", gameVersion: "2K27", requestCount: 2 });
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=1");
    fetchMock.mockResolvedValueOnce(page([player, { ...player, slug: "second-player" }]));
    expect((await fetchNba2kRatings()).contentHash).toBe(result.contentHash);
  });

  it.each([
    { gameVersion: "2K26" },
    { teamType: "class" },
    { overall: 100 },
  ])("rejects incompatible editions and invalid identities: %j", async (invalid) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([{ ...player, ...invalid }])));
    await expect(fetchNba2kRatings()).rejects.toThrow("Invalid NBA 2K ratings response");
  });

  it.each([
    { attributes: { ...player.attributes, threePointShot: null } },
    { attributes: { ...player.attributes, ballHandle: 50.5 } },
    { attributes: { ...player.attributes, steal: -1 } },
    { attributes: {} },
  ])("reports invalid attributes without inventing replacements: %j", async (invalid) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([{ ...player, ...invalid }])));
    const result = await fetchNba2kRatings();
    expect(result.players).toEqual([]);
    expect(result.excludedPlayers).toEqual([
      { slug: player.slug, name: player.name, invalidAttributes: expect.any(Array) },
    ]);
    expect(result.excludedPlayers[0].invalidAttributes.length).toBeGreaterThan(0);
  });

  it("accepts an omitted cursor on the last page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: [player],
          meta: { pagination: { count: 1, total: 1, hasMore: false } },
        })
      )
    );
    expect((await fetchNba2kRatings()).players).toEqual([player]);
  });

  it("does not accept duplicate current-player identities", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page([player, player])));
    await expect(fetchNba2kRatings()).rejects.toThrow("Duplicate");
  });

  it.each([null, "0"])("rejects a missing or repeated next cursor: %j", async (nextCursor) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: [player],
          meta: { pagination: { count: 1, total: 2, hasMore: true, nextCursor } },
        })
      )
    );
    await expect(fetchNba2kRatings()).rejects.toThrow("pagination cursor");
  });

  it("rejects truncated and changing datasets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page([player], 2));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchNba2kRatings()).rejects.toThrow("Incomplete");
    fetchMock
      .mockResolvedValueOnce(page([player], 2, "1"))
      .mockResolvedValueOnce(page([{ ...player, slug: "second-player" }], 3));
    await expect(fetchNba2kRatings()).rejects.toThrow("pagination changed");
  });

  it("fails without retrying rate limits or reading the response body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("private upstream detail", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchNba2kRatings()).rejects.toThrow("HTTP 429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates cancellation", async () => {
    const signal = AbortSignal.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url, options: RequestInit) => {
        options.signal?.throwIfAborted();
      })
    );
    await expect(fetchNba2kRatings(signal)).rejects.toThrow();
  });
});
