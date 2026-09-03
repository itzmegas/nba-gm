import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchNbaGLeagueTwoWayTracker,
  parseNbaGLeagueTwoWayTracker,
  resetNbaGLeagueTwoWayCacheForTests,
} from "@/infrastructure/contracts/nbaGLeagueTwoWaySource";

afterEach(() => {
  vi.unstubAllGlobals();
  resetNbaGLeagueTwoWayCacheForTests();
});

const html = (season = "2026-27") => `<p>Two-Way Players from the ${season} season.</p><table>
<tr><td>Arthur Kaluma</td><td>Los Angeles Lakers</td><td>South Bay Lakers</td></tr></table>`;

describe("NBA G League two-way tracker", () => {
  it("parses NBA team separately from affiliate and ignores blank slots", () => {
    const snapshot = parseNbaGLeagueTwoWayTracker(`
      <p>Two-Way Players from the 2026-27 season.</p><table>
      <tr><th>Player</th><th>NBA Team</th><th>Affiliate</th></tr>
      <tr><td>Arthur Kaluma</td><td>Los Angeles Lakers</td><td>Coachella Valley Lakers</td></tr>
      <tr><td>Chris Mañon&nbsp;</td><td>Los Angeles Lakers</td><td>Coachella Valley Lakers</td></tr>
      <tr><td>AK Okereke</td><td>Los Angeles Lakers</td><td>Coachella Valley Lakers</td></tr>
      <tr><td></td><td>Memphis Grizzlies</td><td>Memphis Hustle</td></tr></table>`);
    expect(snapshot.rows).toHaveLength(3);
    expect(snapshot.rows[1]).toEqual({
      playerName: "Chris Mañon",
      nbaTeamName: "Los Angeles Lakers",
      gLeagueAffiliateName: "Coachella Valley Lakers",
    });
  });

  it("rejects empty and malformed trackers", () => {
    expect(() =>
      parseNbaGLeagueTwoWayTracker("<p>Two-Way Players from the 2026-27 season.</p>")
    ).toThrow();
    expect(() => parseNbaGLeagueTwoWayTracker("<table></table>")).toThrow("season was not found");
  });

  it("serves fresh cache and refreshes an expired cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(html(), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchNbaGLeagueTwoWayTracker(undefined, 1_000, "2026-27");
    await fetchNbaGLeagueTwoWayTracker(undefined, 2_000, "2026-27");
    await fetchNbaGLeagueTwoWayTracker(undefined, 7 * 60 * 60 * 1000, "2026-27");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses bounded stale only when the source is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(html(), { status: 200 }))
      .mockResolvedValueOnce(new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const initial = await fetchNbaGLeagueTwoWayTracker(undefined, 1_000, "2026-27");
    expect(await fetchNbaGLeagueTwoWayTracker(undefined, 7 * 60 * 60 * 1000, "2026-27")).toEqual(
      initial
    );
  });

  it("does not stale-fallback for parse, season, HTTP 4xx, or abort failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(html(), { status: 200 }))
      .mockResolvedValueOnce(new Response("bad", { status: 200 }))
      .mockResolvedValueOnce(new Response(html("2025-26"), { status: 200 }))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchNbaGLeagueTwoWayTracker(undefined, 1_000, "2026-27");
    await expect(fetchNbaGLeagueTwoWayTracker(undefined, 7e7, "2026-27")).rejects.toThrow();
    await expect(fetchNbaGLeagueTwoWayTracker(undefined, 8e7, "2026-27")).rejects.toThrow("season");
    await expect(fetchNbaGLeagueTwoWayTracker(undefined, 9e7, "2026-27")).rejects.toThrow("403");
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchNbaGLeagueTwoWayTracker(controller.signal, 10e7, "2026-27")
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
