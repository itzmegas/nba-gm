"use client";

import { use } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useT } from "@/application/providers/I18nProvider";
import { Calendar } from "@/components/games/Calendar";

interface SchedulePageProps {
  params: Promise<{ gameId: string }>;
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { gameId } = use(params);
  const game = useGame(gameId);
  const t = useT();

  if (game.isLoading) {
    return (
      <output
        className="flex min-h-[50vh] items-center justify-center"
        aria-label={t("dashboard", "loadingGame")}
      >
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </output>
    );
  }

  if (game.isError || !game.data) {
    return (
      <p className="py-10 text-center text-destructive">{t("dashboard", "unableToLoadGame")}</p>
    );
  }

  return (
    <section
      data-slot="schedule-screen"
      aria-labelledby="calendar-title"
      className="animate-in fade-in duration-500"
    >
      <h1 id="calendar-title" className="sr-only">
        {t("dashboard", "calendar")}
      </h1>
      <Calendar
        key={`${game.data.simulationDate.getUTCFullYear()}-${game.data.simulationDate.getUTCMonth()}`}
        gameId={gameId}
        selectedTeamId={game.data.selectedTeamId}
        simulationDate={game.data.simulationDate}
      />
    </section>
  );
}
