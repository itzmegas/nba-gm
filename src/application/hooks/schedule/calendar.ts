import type { ScheduledGame } from "@/domain";

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
