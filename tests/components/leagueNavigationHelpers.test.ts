import { describe, expect, it } from "vitest";
import { franchiseHref, playerProfileHref, teamsHref } from "@/components/league/navigation";

describe("league navigation helpers", () => {
  const query =
    "teamId=old&teamId=other&q=LA+%26+Boston&tag=a&tag=b&franchiseTab=roster&returnTo=https%3A%2F%2Fevil.example%2F";

  it("moves identity into escaped path segments and preserves every other query value", () => {
    const href = franchiseHref("game/?#", "team/?#", query);
    const target = new URL(href, "http://localhost");
    expect(target.pathname).toBe("/games/game%2F%3F%23/dashboard/league/teams/team%2F%3F%23");
    const expected = new URLSearchParams(query);
    expected.delete("teamId");
    expect([...target.searchParams]).toEqual([...expected]);
    expect(target.origin).toBe("http://localhost");
    expect(franchiseHref("game", "team")).toBe("/games/game/dashboard/league/teams/team");
  });

  it("returns to the directory removing only the local tab and replacing selection", () => {
    const target = new URL(teamsHref("game/?#", "team &?", query), "http://localhost");
    expect(target.pathname).toBe("/games/game%2F%3F%23/dashboard/league/teams");
    const expected = new URLSearchParams(query);
    expected.delete("franchiseTab");
    expected.set("teamId", "team &?");
    expect([...target.searchParams]).toEqual([...expected]);
    expect(target.searchParams.getAll("teamId")).toEqual(["team &?"]);
  });

  it("keeps existing player routes without league context and encodes nested return queries", () => {
    expect(playerProfileHref("game", "player")).toBe("/games/game/dashboard/player/player");
    expect(playerProfileHref("game", "player", "team")).toBe(
      "/games/game/dashboard/player/player?leagueTeamId=team"
    );
    expect(playerProfileHref("game", "player", undefined, query)).toBe(
      "/games/game/dashboard/player/player"
    );
    const target = new URL(
      playerProfileHref("game/?#", "player/?#", "team &?", query),
      "http://localhost"
    );
    expect(target.pathname).toBe("/games/game%2F%3F%23/dashboard/player/player%2F%3F%23");
    expect([...target.searchParams]).toEqual([
      ["leagueTeamId", "team &?"],
      ["leagueReturnQuery", query],
    ]);
  });
});
