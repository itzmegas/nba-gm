"use client";

import { CalendarDays } from "lucide-react";
import { use } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { Calendar } from "@/components/games/Calendar";

interface SchedulePageProps {
  params: Promise<{ gameId: string }>;
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
        selectedTeamId={game.data.selectedTeamId}
        simulationDate={game.data.simulationDate}
      />
    </div>
  );
}
