import { describe, expect, it } from "vitest";
import { getMonthCells, getTeamGameSummary } from "@/application/hooks/schedule/calendar";
import type { ScheduledGame } from "@/domain";

describe("getMonthCells", () => {
  it("builds complete weeks with the correct empty cells for a leap month", () => {
    const cells = getMonthCells(2024, 1);

    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe("2024-02-01");
    expect(cells[32]).toBe("2024-02-29");
    expect(cells.slice(33)).toEqual([null, null]);
  });
});

describe("getTeamGameSummary", () => {
  const games = [
    { id: "selected", homeTeamId: "team-a", awayTeamId: "team-b" },
    { id: "other", homeTeamId: "team-c", awayTeamId: "team-d" },
  ] as ScheduledGame[];

  it("extracts the selected team's game and counts the remaining games", () => {
    expect(getTeamGameSummary(games, "team-b")).toEqual({
      selectedTeamGame: games[0],
      remainingGameCount: 1,
    });
    expect(getTeamGameSummary(games, "team-x")).toEqual({
      selectedTeamGame: undefined,
      remainingGameCount: 2,
    });
  });
});
