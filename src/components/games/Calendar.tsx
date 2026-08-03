import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTeams } from "@/application";
import { getMonthCells, getTeamGameSummary } from "@/application/hooks/schedule/calendar";
import { useSchedule } from "@/application/hooks/schedule/useSchedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SCHEDULED_GAME_STATUS } from "@/domain";
import { Card, CardContent } from "../ui/card";

interface CalendarProps {
  gameId: string;
  selectedTeamId: string;
  simulationDate: Date;
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function Calendar({ gameId, selectedTeamId, simulationDate }: CalendarProps) {
  const simulationDateIso = simulationDate.toISOString().slice(0, 10);
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: simulationDate.getUTCFullYear(),
    month: simulationDate.getUTCMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const schedule = useSchedule(gameId);
  const teams = useTeams();

  if (schedule.isLoading || teams.isLoading) {
    return (
      <output
        className="flex min-h-[50vh] items-center justify-center"
        aria-label="Cargando calendario"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </output>
    );
  }

  if (schedule.isError || teams.isError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-10 text-center text-destructive">
          No se pudo cargar el calendario. Intentá nuevamente.
        </CardContent>
      </Card>
    );
  }

  const cells = getMonthCells(visibleMonth.year, visibleMonth.month);
  const gamesByDate = Map.groupBy(schedule.data ?? [], (game) => game.date);
  const teamsById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1)));
  const hasGames = cells.some((date) => date && gamesByDate.has(date));
  const selectedDateGames = selectedDate ? (gamesByDate.get(selectedDate) ?? []) : [];
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "full",
        timeZone: "UTC",
      }).format(new Date(`${selectedDate}T00:00:00Z`))
    : "";

  const changeMonth = (offset: number) => {
    const next = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + offset, 1));
    setVisibleMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Mes anterior"
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft />
        </Button>
        <h2 className="text-center text-xl font-bold capitalize">{monthLabel}</h2>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Mes siguiente"
          onClick={() => changeMonth(1)}
        >
          <ChevronRight />
        </Button>
      </div>

      {!hasGames && (
        <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          No hay partidos programados en este mes.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-175 grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="border-b bg-muted/50 px-2 py-3 text-center text-xs font-bold uppercase text-muted-foreground"
            >
              {weekday}
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

            return (
              <div
                key={date ?? `empty-${index}`}
                className={`h-28 overflow-hidden border-r border-b p-2 nth-[7n]:border-r-0 ${
                  isCurrentDay
                    ? "bg-primary/10 ring-2 ring-inset ring-primary/60"
                    : isPastDay
                      ? "bg-muted/30"
                      : ""
                }`}
              >
                {date && (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <time
                        dateTime={date}
                        aria-current={isCurrentDay ? "date" : undefined}
                        className="text-xs font-bold text-muted-foreground"
                      >
                        {Number(date.slice(-2))}
                      </time>
                      {isCurrentDay && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                          Hoy
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {selectedTeamGame &&
                        (() => {
                          const scheduledGame = selectedTeamGame;
                          const away = teamsById.get(scheduledGame.awayTeamId);
                          const home = teamsById.get(scheduledGame.homeTeamId);
                          const completed =
                            scheduledGame.status === SCHEDULED_GAME_STATUS.COMPLETED;

                          return (
                            <button
                              type="button"
                              onClick={() => setSelectedDate(date)}
                              aria-label={`Ver todos los partidos del ${date}`}
                              title={`${away?.city ?? ""} ${away?.name ?? "Visitante"} @ ${home?.city ?? ""} ${home?.name ?? "Local"}`}
                              className={`w-full rounded-md border px-2 py-1 text-left text-xs ${
                                completed
                                  ? "border-emerald-500/30 bg-emerald-500/10"
                                  : "border-primary/20 bg-primary/5"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 font-semibold">
                                <span>
                                  {away?.abbreviation ?? "—"} @ {home?.abbreviation ?? "—"}
                                </span>
                                {completed && (
                                  <span>
                                    {scheduledGame.awayScore ?? "—"}-
                                    {scheduledGame.homeScore ?? "—"}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {completed ? "Final" : "Programado"}
                              </span>
                            </button>
                          );
                        })()}
                      {games.length > 0 && (remainingGameCount > 0 || !selectedTeamGame) && (
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          aria-label={`Ver ${games.length} partidos del ${date}`}
                          className="w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {selectedTeamGame
                            ? `+${remainingGameCount} partidos`
                            : `Ver ${games.length} partidos`}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="capitalize">Partidos del {selectedDateLabel}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
            {selectedDateGames.map((scheduledGame) => {
              const away = teamsById.get(scheduledGame.awayTeamId);
              const home = teamsById.get(scheduledGame.homeTeamId);
              const completed = scheduledGame.status === SCHEDULED_GAME_STATUS.COMPLETED;

              return (
                <div key={scheduledGame.id} className="rounded-lg border p-3 text-sm">
                  <div className="space-y-1 font-semibold">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="inline-block w-8">{away?.abbreviation ?? "—"}</span> ·{" "}
                        {away?.name ?? "Visitante"}
                      </span>
                      {completed && (
                        <span className="w-8 shrink-0 text-right tabular-nums">
                          {scheduledGame.awayScore ?? "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="inline-block w-8">{home?.abbreviation ?? "—"}</span> ·{" "}
                        {home?.name ?? "Local"}
                      </span>
                      {completed && (
                        <span className="w-8 shrink-0 text-right tabular-nums">
                          {scheduledGame.homeScore ?? "—"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs uppercase text-muted-foreground">
                    {completed ? "Final" : "Programado"}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
