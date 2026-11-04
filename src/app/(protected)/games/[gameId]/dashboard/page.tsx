"use client";

import { use } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useGame } from "@/application/hooks/games/useGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { AlertsWidget } from "@/components/dashboard/alerts-widget";
import { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import { FranchiseOverview } from "@/components/dashboard/franchise-overview";
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
  const game = gameQuery.data;

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
    <div className={`${body.className} space-y-5 animate-in fade-in duration-500`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("dashboard", "myFranchise")} / {t("dashboard", "overview")}
          </p>
          <h1
            className={`${display.className} text-3xl font-semibold uppercase tracking-tight sm:text-4xl`}
          >
            {t("dashboard", "franchiseDashboard")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("dashboard", "dashboardDescription")}</p>
        </div>
        <div className="w-fit rounded-sm border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {formatSeasonLabel(game.seasonYear)} · {t("dashboard", "season")}
        </div>
      </div>
      <FranchiseOverview game={game} teams={teamsQuery.data ?? []} />
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <NextGameWidget game={game} />
        <CapSpaceWidget gameId={gameId} teamId={game.selectedTeamId} />
        <StandingsWidget gameId={gameId} teamId={game.selectedTeamId} />
        <AlertsWidget gameId={gameId} teamId={game.selectedTeamId} seasonYear={game.seasonYear} />
      </div>
    </div>
  );
}
