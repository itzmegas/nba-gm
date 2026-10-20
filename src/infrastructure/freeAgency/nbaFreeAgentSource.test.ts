import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchNbaFreeAgentTracker,
  parseNbaFreeAgentTracker,
} from "@/infrastructure/freeAgency/nbaFreeAgentSource";

const player = {
  season: "2026",
  playerId: 1628988,
  playerFirstName: "Aaron",
  playerLastName: "Holiday",
  playerDisplayName: "Aaron Holiday",
  position: "G",
  exp: 9,
  type: "ufa",
  newTeamId: "0",
  isPlayerOption: false,
  isTeamOption: false,
  isEarlyTerminationOption: false,
  isTwoWayFreeAgent: false,
};
const html = (players: unknown[]) =>
  `<html><script type="application/json" id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { players } } })}</script></html>`;
const now = new Date("2026-10-16T12:00:00Z");

describe("NBA free-agent source", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extracts structured players and provenance without relying on rendered table rows", () => {
    const snapshot = parseNbaFreeAgentTracker(html([player]), now);
    expect(snapshot).toMatchObject({
      seasonYear: 2026,
      fetchedAt: now.toISOString(),
      players: [player],
    });
    expect(snapshot.sourceUrl).toBe("https://www.nba.com/players/free-agent-tracker/2026");
  });

  it.each([
    ["blocked page", "Access denied"],
    ["empty list", html([])],
    ["changed season", html([{ ...player, season: "2025" }])],
    ["duplicate identity", html([player, player])],
    ["missing service years", html([{ ...player, exp: null }])],
  ])("rejects %s rather than recording a successful empty import", (_name, document) => {
    expect(() => parseNbaFreeAgentTracker(document, now)).toThrow();
  });

  it("surfaces HTTP denial and never returns an empty fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 403 })));
    await expect(fetchNbaFreeAgentTracker()).rejects.toThrow("HTTP 403");
  });
});
