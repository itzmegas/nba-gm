"use client";

import { use } from "react";
import { GameIdProvider } from "@/application/context/GameContext";
import { useGame } from "@/application/hooks/games/useGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { DashboardHeader, DashboardSidebar } from "@/components/dashboard/layout-components";
import { TeamThemeApplier } from "@/components/theme/team-theme-applier";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface GameDashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gameId: string }>;
}

export default function GameDashboardLayout({ children, params }: GameDashboardLayoutProps) {
  const { gameId } = use(params);
  const { data: game, isLoading } = useGame(gameId);
  const { data: teams } = useTeams();
  const t = useT();

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <output
          aria-label={t("dashboard", "loadingGame")}
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
        />
      </div>
    );
  }

  const selectedTeam = teams?.find((team) => team.id === game.selectedTeamId);

  return (
    <GameIdProvider gameId={gameId}>
      <TeamThemeApplier teamAbbreviation={selectedTeam?.abbreviation} />
      <SidebarProvider>
        <DashboardSidebar
          gameId={gameId}
          selectedTeamId={game.selectedTeamId}
          simulationDate={game.simulationDate}
          seasonYear={game.seasonYear}
        />

        <SidebarInset>
          <DashboardHeader
            gameId={gameId}
            gameName={game.name}
            selectedTeamId={game.selectedTeamId}
            seasonYear={game.seasonYear}
          />

          <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </GameIdProvider>
  );
}
