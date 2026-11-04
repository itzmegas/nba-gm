import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { display } from "@/app/ui-preview/fonts";
import { useTeams } from "@/application";
import {
  getMonthCells,
  getSelectedTeamGameState,
  getTeamGameSummary,
  SELECTED_TEAM_GAME_STATE,
} from "@/application/hooks/schedule/calendar";
import { useSchedule } from "@/application/hooks/schedule/useSchedule";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { FixtureGameCard } from "@/components/games/FixtureGameCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SCHEDULED_GAME_STATUS } from "@/domain";
import { TEAM_COLORS } from "@/domain/constants/team-colors";

interface CalendarProps {
  gameId: string;
  selectedTeamId: string;
  simulationDate: Date;
}

const WEEKDAY_KEYS = [
  "weekdaySun",
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
] as const;

export function Calendar({ gameId, selectedTeamId, simulationDate }: CalendarProps) {
  const t = useT();
  const locale = useLocale();
  const simulationDateIso = simulationDate.toISOString().slice(0, 10);
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: simulationDate.getUTCFullYear(),
    month: simulationDate.getUTCMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [inspectedDate, setInspectedDate] = useState(simulationDateIso);
  const schedule = useSchedule(gameId);
  const teams = useTeams();

  if (schedule.isLoading || teams.isLoading) {
    return (
      <output
        className="flex min-h-[50vh] items-center justify-center"
        aria-label={t("dashboard", "calendar")}
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </output>
    );
  }

  if (schedule.isError || teams.isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-10 text-center text-destructive">
          {t("dashboard", "unableToLoadGame")}
        </CardContent>
      </Card>
    );
  }

  const cells = getMonthCells(visibleMonth.year, visibleMonth.month);
  const gamesByDate = Map.groupBy(schedule.data ?? [], (game) => game.date);
  const teamsById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const monthLabel = new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1)));
  const hasGames = cells.some((date) => date && gamesByDate.has(date));
  const monthGames = cells.flatMap((date) => (date ? (gamesByDate.get(date) ?? []) : []));
  const inspectedGames = gamesByDate.get(inspectedDate) ?? [];
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  const nextGame = (schedule.data ?? [])
    .filter(
      (game) =>
        game.date >= simulationDateIso &&
        game.status !== SCHEDULED_GAME_STATUS.COMPLETED &&
        (game.homeTeamId === selectedTeamId || game.awayTeamId === selectedTeamId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const selectedDateGame = selectedDate
    ? getTeamGameSummary(gamesByDate.get(selectedDate) ?? [], selectedTeamId).selectedTeamGame
    : undefined;
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${selectedDate}T00:00:00Z`))
    : "";

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + offset, 1));
    setVisibleMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setInspectedDate(next.toISOString().slice(0, 10));
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className={`${display.className} text-3xl font-semibold capitalize`}>
              {monthLabel}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthGames.length} {t("dashboard", "gamesCount")} ·{" "}
              {teamsById.get(selectedTeamId)?.name ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setVisibleMonth({
                  year: simulationDate.getUTCFullYear(),
                  month: simulationDate.getUTCMonth(),
                });
                setInspectedDate(simulationDateIso);
              }}
            >
              {t("dashboard", "today")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("dashboard", "previousMonth")}
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("dashboard", "nextMonth")}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        {!hasGames && (
          <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
            {t("dashboard", "noGamesThisMonth")}
          </p>
        )}

        <div className="overflow-x-auto border-y">
          <div className="grid min-w-175 grid-cols-7">
            {WEEKDAY_KEYS.map((weekdayKey) => (
              <div
                key={weekdayKey}
                className="border-b bg-muted/50 px-2 py-3 text-center text-xs font-bold uppercase text-muted-foreground"
              >
                {t("dashboard", weekdayKey)}
              </div>
            ))}
            {cells.map((date, index) => {
              const games = date ? (gamesByDate.get(date) ?? []) : [];
              const isCurrentDay = date === simulationDateIso;
              const isPastDay = date !== null && date < simulationDateIso;
              const { selectedTeamGame, remainingGameCount } = getTeamGameSummary(
                games,
                selectedTeamId
              );
              const selectedTeamIsHome = selectedTeamGame?.homeTeamId === selectedTeamId;
              const opponent = selectedTeamGame
                ? teamsById.get(
                    selectedTeamIsHome ? selectedTeamGame.awayTeamId : selectedTeamGame.homeTeamId
                  )
                : undefined;
              const opponentColor = TEAM_COLORS[opponent?.abbreviation ?? ""]?.primary;

              return (
                <div
                  key={date ?? `empty-${index}`}
                  data-calendar-date={date ?? undefined}
                  style={
                    selectedTeamGame
                      ? ({
                          "--opponent-color": opponentColor ?? "var(--muted-foreground)",
                        } as CSSProperties)
                      : undefined
                  }
                  className={`min-h-40 min-w-0 border-r border-b p-3 nth-[7n]:border-r-0 ${
                    selectedTeamGame
                      ? "bg-[color-mix(in_srgb,var(--opponent-color)_10%,var(--card))]"
                      : isPastDay
                        ? "bg-muted/30"
                        : ""
                  } ${isCurrentDay ? "ring-2 ring-inset ring-primary" : ""} ${date === inspectedDate ? "outline -outline-offset-1 outline-primary/60" : ""}`}
                >
                  {date && (
                    <>
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          aria-label={`${t("dashboard", "selectDate")} ${date}`}
                          aria-pressed={date === inspectedDate}
                          onClick={() => setInspectedDate(date)}
                          className="rounded-sm p-1 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <time
                            dateTime={date}
                            aria-current={isCurrentDay ? "date" : undefined}
                            className="text-xs font-bold text-muted-foreground"
                          >
                            {Number(date.slice(-2))}
                          </time>
                        </button>
                        {isCurrentDay && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                            {t("dashboard", "today")}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        {selectedTeamGame &&
                          (() => {
                            const scheduledGame = selectedTeamGame;
                            const away = teamsById.get(scheduledGame.awayTeamId);
                            const home = teamsById.get(scheduledGame.homeTeamId);
                            const completed =
                              scheduledGame.status === SCHEDULED_GAME_STATUS.COMPLETED;
                            const location = selectedTeamIsHome
                              ? t("dashboard", "home")
                              : t("dashboard", "away");
                            const state = getSelectedTeamGameState(scheduledGame, selectedTeamId);
                            const stateLabel = {
                              [SELECTED_TEAM_GAME_STATE.SCHEDULED]: t("dashboard", "scheduled"),
                              [SELECTED_TEAM_GAME_STATE.VICTORY]: t("dashboard", "victory"),
                              [SELECTED_TEAM_GAME_STATE.DEFEAT]: t("dashboard", "defeat"),
                              [SELECTED_TEAM_GAME_STATE.FINAL]: t("dashboard", "final"),
                            }[state];

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectedDate(date);
                                  setSelectedDate(date);
                                }}
                                aria-label={`${t("dailyGames", "gameDetails")} ${date} · ${location} · ${opponent?.name ?? "—"} · ${stateLabel}${completed ? ` · ${scheduledGame.awayScore ?? "—"}-${scheduledGame.homeScore ?? "—"}` : ""}`}
                                title={`${away?.name ?? t("dashboard", "away")} @ ${home?.name ?? t("dashboard", "home")}`}
                                className="flex min-h-24 w-full flex-col items-center gap-1 rounded-sm py-1 text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {opponent?.logoUrl ? (
                                  <Image
                                    src={opponent.logoUrl}
                                    alt=""
                                    width={64}
                                    height={64}
                                    className="size-16 shrink-0 object-contain dark:drop-shadow-[0_0_1px_white]"
                                  />
                                ) : (
                                  <span
                                    aria-hidden="true"
                                    className="flex size-16 items-center justify-center text-lg font-bold"
                                  >
                                    {opponent?.abbreviation ?? "—"}
                                  </span>
                                )}
                                <span className="block w-full truncate text-center text-sm font-semibold">
                                  {location} · {opponent?.abbreviation ?? "—"}
                                </span>
                                <span className="flex w-full flex-wrap items-center justify-center gap-x-3 text-xs">
                                  <span
                                    className={
                                      state === SELECTED_TEAM_GAME_STATE.VICTORY
                                        ? "font-semibold text-emerald-800 dark:text-emerald-300"
                                        : state === SELECTED_TEAM_GAME_STATE.DEFEAT
                                          ? "font-semibold text-red-800 dark:text-red-300"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {stateLabel}
                                  </span>
                                  {completed && (
                                    <span className="shrink-0 font-bold tabular-nums">
                                      {scheduledGame.awayScore ?? "—"}-
                                      {scheduledGame.homeScore ?? "—"}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })()}
                        {games.length > 0 && (remainingGameCount > 0 || !selectedTeamGame) && (
                          <Link
                            href={`/games/${gameId}/dashboard/schedule/day/${date}`}
                            aria-label={`${t("dashboard", "viewGames")} ${games.length} ${t("dashboard", "gamesCount")} ${date}`}
                            className="block w-full rounded-sm py-1 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {selectedTeamGame
                              ? `+${remainingGameCount} ${t("dashboard", "gamesCount")}`
                              : `${t("dashboard", "viewGames")} ${games.length} ${t("dashboard", "gamesCount")}`}
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 px-5 py-3 text-xs text-muted-foreground">
          <span>{t("dailyGames", "yourGame")}</span>
          <span>{t("dashboard", "scheduled")}</span>
          <span>{t("dashboard", "final")}</span>
        </div>
      </div>

      <aside
        aria-label={t("dashboard", "timeline")}
        className="divide-y rounded-xl border border-primary/25 bg-primary/5"
      >
        <h2 className="px-5 py-4 text-sm font-semibold">{t("dashboard", "timeline")}</h2>
        <div className="space-y-2 p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("dashboard", "simulationDate")}
          </p>
          <p className={`${display.className} text-2xl capitalize`}>
            {formatDate(simulationDateIso)}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("dashboard", "nextGame")}
          </h3>
          {nextGame ? (
            <>
              <p className="text-sm capitalize">{formatDate(nextGame.date)}</p>
              <p className="text-sm font-semibold">
                {teamsById.get(nextGame.awayTeamId)?.name ?? "—"} @{" "}
                {teamsById.get(nextGame.homeTeamId)?.name ?? "—"}
              </p>
              <Link
                className="text-sm text-primary underline underline-offset-4"
                href={`/games/${gameId}/dashboard/schedule/day/${nextGame.date}`}
              >
                {t("dashboard", "viewGames")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("dashboard", "noUpcomingGame")}</p>
          )}
        </div>
        <div className="space-y-3 p-5" aria-live="polite" aria-atomic="true">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("dashboard", "selectedDay")}
          </h3>
          <p className={`${display.className} text-2xl capitalize`}>{formatDate(inspectedDate)}</p>
          {inspectedGames.length ? (
            <>
              <ul className="divide-y">
                {inspectedGames.map((game) => (
                  <li key={game.id} className="space-y-1 py-3 text-sm">
                    <p className="font-medium">
                      {teamsById.get(game.awayTeamId)?.abbreviation ?? "—"} @{" "}
                      {teamsById.get(game.homeTeamId)?.abbreviation ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {game.status === SCHEDULED_GAME_STATUS.COMPLETED
                        ? `${t("dashboard", "final")} · ${game.awayScore ?? "—"}-${game.homeScore ?? "—"}`
                        : t("dashboard", "scheduled")}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                className="text-sm text-primary underline underline-offset-4"
                href={`/games/${gameId}/dashboard/schedule/day/${inspectedDate}`}
              >
                {t("dashboard", "viewGames")}
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("dashboard", "noGamesOnDate")}</p>
          )}
        </div>
      </aside>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-5xl"
        >
          <DialogHeader>
            <DialogTitle className="capitalize">
              {t("dailyGames", "gameDetails")} · {selectedDateLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {selectedDateGame && (
              <FixtureGameCard
                gameId={gameId}
                fixture={selectedDateGame}
                home={teamsById.get(selectedDateGame.homeTeamId)}
                away={teamsById.get(selectedDateGame.awayTeamId)}
                ownGame
                expanded
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
