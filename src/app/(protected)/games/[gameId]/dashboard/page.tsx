"use client";

import { use } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { AlertsWidget } from "@/components/dashboard/alerts-widget";
import { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import { NextGameWidget } from "@/components/dashboard/next-game-widget";
import { StandingsWidget } from "@/components/dashboard/standings-widget";
import { formatSeasonLabel } from "@/domain/entities/Season";

interface GameDashboardPageProps {
  params: Promise<{ gameId: string }>;
}

export default function GameDashboardPage({ params }: GameDashboardPageProps) {
  const { gameId } = use(params);
  const gameQuery = useGame(gameId);
  const teamsQuery = useTeams();
  const t = useT();
  const locale = useLocale();
  const game = gameQuery.data;
  const team = teamsQuery.data?.find((candidate) => candidate.id === game?.selectedTeamId);

  if (gameQuery.isError || teamsQuery.isError) {
    return (
      <p role="alert" className="py-12 text-center text-destructive">
        {t("dashboard", "unableToLoadGame")}
      </p>
    );
  }
  if (gameQuery.isPending || teamsQuery.isPending || !game) {
    return (
      <output className="block py-12 text-center text-muted-foreground">
        {t("dashboard", "loadingGame")}
      </output>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("dashboard", "dashboard")} · {t("dashboard", "season")}{" "}
            {formatSeasonLabel(game.seasonYear)}
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {team?.name ?? t("dashboard", "teamFallback")}
          </h1>
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-xs text-muted-foreground">{t("dashboard", "simulationDate")}</p>
          <p className="mt-1 font-semibold">
            {new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
              dateStyle: "long",
              timeZone: "UTC",
            }).format(game.simulationDate)}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <NextGameWidget game={game} />
        </div>
        <StandingsWidget gameId={gameId} teamId={game.selectedTeamId} />
        <div className="min-w-0 lg:col-span-2">
          <CapSpaceWidget gameId={gameId} teamId={game.selectedTeamId} />
        </div>
        <AlertsWidget gameId={gameId} teamId={game.selectedTeamId} seasonYear={game.seasonYear} />
      </div>
    </div>
  );
}
