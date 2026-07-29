"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { use, useState } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { getMonthCells } from "@/application/hooks/schedule/calendar";
import { useSchedule } from "@/application/hooks/schedule/useSchedule";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SCHEDULED_GAME_STATUS } from "@/domain/entities/ScheduledGame";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface SchedulePageProps {
  params: Promise<{ gameId: string }>;
}

interface CalendarProps {
  gameId: string;
  simulationDate: Date;
}

function Calendar({ gameId, simulationDate }: CalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: simulationDate.getUTCFullYear(),
    month: simulationDate.getUTCMonth(),
  }));
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
        <div className="grid min-w-[700px] grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="border-b bg-muted/50 px-2 py-3 text-center text-xs font-bold uppercase text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
          {cells.map((date, index) => (
            <div
              key={date ?? `empty-${index}`}
              className="min-h-28 border-r border-b p-2 [&:nth-child(7n)]:border-r-0"
            >
              {date && (
                <>
                  <time dateTime={date} className="text-xs font-bold text-muted-foreground">
                    {Number(date.slice(-2))}
                  </time>
                  <div className="mt-1 space-y-1">
                    {(gamesByDate.get(date) ?? []).map((scheduledGame) => {
                      const away = teamsById.get(scheduledGame.awayTeamId);
                      const home = teamsById.get(scheduledGame.homeTeamId);
                      const completed = scheduledGame.status === SCHEDULED_GAME_STATUS.COMPLETED;

                      return (
                        <div
                          key={scheduledGame.id}
                          title={`${away?.city ?? ""} ${away?.name ?? "Visitante"} @ ${home?.city ?? ""} ${home?.name ?? "Local"}`}
                          className={`rounded-md border px-2 py-1 text-xs ${
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
                                {scheduledGame.awayScore ?? "—"}-{scheduledGame.homeScore ?? "—"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {completed ? "Final" : "Programado"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { gameId } = use(params);
  const game = useGame(gameId);

  if (game.isLoading) {
    return (
      <output
        className="flex min-h-[50vh] items-center justify-center"
        aria-label="Cargando partida"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </output>
    );
  }

  if (game.isError || !game.data) {
    return <p className="py-10 text-center text-destructive">No se pudo cargar la partida.</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
          <CalendarDays className="h-8 w-8 text-primary" />
          Calendario
        </h1>
        <p className="mt-1 text-muted-foreground">Partidos programados de la temporada.</p>
      </div>
      <Calendar
        key={`${game.data.simulationDate.getUTCFullYear()}-${game.data.simulationDate.getUTCMonth()}`}
        gameId={gameId}
        simulationDate={game.data.simulationDate}
      />
    </div>
  );
}
