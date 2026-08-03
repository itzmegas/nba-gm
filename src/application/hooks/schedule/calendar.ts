import type { ScheduledGame } from "@/domain";

export const SELECTED_TEAM_GAME_STATE = {
  SCHEDULED: "scheduled",
  VICTORY: "victory",
  DEFEAT: "defeat",
  FINAL: "final",
} as const;

export type SelectedTeamGameState =
  (typeof SELECTED_TEAM_GAME_STATE)[keyof typeof SELECTED_TEAM_GAME_STATE];

export function getMonthCells(year: number, month: number): Array<string | null> {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return null;

    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

export function getTeamGameSummary(games: ScheduledGame[], selectedTeamId: string) {
  const selectedTeamGame = games.find(
    (game) => game.homeTeamId === selectedTeamId || game.awayTeamId === selectedTeamId
  );

  return {
    selectedTeamGame,
    remainingGameCount: games.length - (selectedTeamGame ? 1 : 0),
  };
}

export function getSelectedTeamGameState(
  game: ScheduledGame,
  selectedTeamId: string
): SelectedTeamGameState {
  if (game.status !== "completed") return SELECTED_TEAM_GAME_STATE.SCHEDULED;
  if (
    game.homeScore === undefined ||
    game.awayScore === undefined ||
    game.homeScore === game.awayScore
  )
    return SELECTED_TEAM_GAME_STATE.FINAL;

  const selectedTeamWon =
    game.homeTeamId === selectedTeamId
      ? game.homeScore > game.awayScore
      : game.awayTeamId === selectedTeamId && game.awayScore > game.homeScore;

  return selectedTeamWon ? SELECTED_TEAM_GAME_STATE.VICTORY : SELECTED_TEAM_GAME_STATE.DEFEAT;
}
