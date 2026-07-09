"use client";

import { use } from "react";
import { GameIdProvider } from "@/application/context/GameContext";
import { useGame } from "@/application/hooks/games/useGame";
import { DashboardHeader, DashboardSidebar } from "@/components/dashboard/layout-components";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface GameDashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gameId: string }>;
}

export default function GameDashboardLayout({ children, params }: GameDashboardLayoutProps) {
  const { gameId } = use(params);
  const { data: game, isLoading } = useGame(gameId);

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <GameIdProvider gameId={gameId}>
      <SidebarProvider>
        <DashboardSidebar gameId={gameId} selectedTeamId={game.selectedTeamId} />

        <SidebarInset>
          <DashboardHeader
            gameId={gameId}
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
