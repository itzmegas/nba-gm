"use client";

import { type CSSProperties, use, useEffect } from "react";
import { body, display } from "@/app/ui-preview/fonts";
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

  useEffect(() => {
    const root = document.documentElement;
    const added = `${body.variable} ${display.variable}`
      .split(" ")
      .filter((name) => !root.classList.contains(name));
    root.classList.add(...added);
    return () => root.classList.remove(...added);
  }, []);

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
      <SidebarProvider
        className="game-shell-frame h-dvh min-h-0"
        style={{ "--sidebar-width": "216px", "--sidebar-width-icon": "56px" } as CSSProperties}
      >
        <a
          href="#game-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-foreground focus:p-3 focus:text-background"
        >
          {t("dashboard", "skipToContent")}
        </a>
        <DashboardSidebar
          gameId={gameId}
          selectedTeamId={game.selectedTeamId}
          simulationDate={game.simulationDate}
          seasonYear={game.seasonYear}
        />

        <SidebarInset className="game-shell-inset min-h-0 min-w-0">
          <DashboardHeader
            gameId={gameId}
            gameName={game.name}
            selectedTeamId={game.selectedTeamId}
            seasonYear={game.seasonYear}
            simulationDate={game.simulationDate}
          />

          <section
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll region must support keyboard scrolling.
            tabIndex={0}
            id="game-content"
            aria-label={t("dashboard", "dashboard")}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4 md:p-6 min-[1700px]:px-12 min-[1700px]:py-8"
          >
            <div className="mx-auto w-full min-w-0 max-w-[1840px] shrink-0">{children}</div>
          </section>
        </SidebarInset>
      </SidebarProvider>
    </GameIdProvider>
  );
}
