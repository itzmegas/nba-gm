import { describe, expect, it } from "vitest";
import {
  getMonthCells,
  getSelectedTeamGameState,
  getTeamGameSummary,
  SELECTED_TEAM_GAME_STATE,
} from "@/application/hooks/schedule/calendar";
import { SCHEDULED_GAME_STATUS, type ScheduledGame } from "@/domain";

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

describe("getSelectedTeamGameState", () => {
  const completedGame = {
    homeTeamId: "home",
    awayTeamId: "away",
    status: SCHEDULED_GAME_STATUS.COMPLETED,
  } as ScheduledGame;

  it("reports a home win from the selected team's perspective", () => {
    expect(
      getSelectedTeamGameState({ ...completedGame, homeScore: 110, awayScore: 100 }, "home")
    ).toBe(SELECTED_TEAM_GAME_STATE.VICTORY);
  });

  it("reports an away win from the selected team's perspective", () => {
    expect(
      getSelectedTeamGameState({ ...completedGame, homeScore: 100, awayScore: 110 }, "away")
    ).toBe(SELECTED_TEAM_GAME_STATE.VICTORY);
  });

  it("reports a loss from the selected team's perspective", () => {
    expect(
      getSelectedTeamGameState({ ...completedGame, homeScore: 110, awayScore: 100 }, "away")
    ).toBe(SELECTED_TEAM_GAME_STATE.DEFEAT);
  });

  it("keeps completed games with a missing score neutral", () => {
    expect(getSelectedTeamGameState({ ...completedGame, homeScore: 110 }, "home")).toBe(
      SELECTED_TEAM_GAME_STATE.FINAL
    );
  });
});
