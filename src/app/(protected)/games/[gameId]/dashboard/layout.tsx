"use client";

import { use } from "react";
import { GameIdProvider } from "@/application/context/GameContext";
import { useGame } from "@/application/hooks/games/useGame";
import { DashboardHeader, DashboardSidebar } from "@/components/dashboard/layout-components";

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
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <DashboardSidebar gameId={gameId} selectedTeamId={game.selectedTeamId} />

        <div className="flex flex-col flex-1 overflow-hidden relative">
          <DashboardHeader selectedTeamId={game.selectedTeamId} />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </GameIdProvider>
  );
}
