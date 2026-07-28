"use client";

import { Calendar as CalendarIcon, Newspaper, Trophy } from "lucide-react";
import { use } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useNextGame, useStandings } from "@/application/hooks/simulation";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { AlertsWidget } from "@/components/dashboard/alerts-widget";
import { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GameDashboardPageProps {
  params: Promise<{ gameId: string }>;
}

export default function GameDashboardPage({ params }: GameDashboardPageProps) {
  const { gameId } = use(params);
  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const selectedTeamId = game?.selectedTeamId ?? "";
  const { data: teams, isLoading: isLoadingTeams } = useTeams();
  const { data: nextGame } = useNextGame(gameId, selectedTeamId, game?.simulationDate);
  const { data: standings } = useStandings(gameId);
  const team = teams?.find((candidate) => candidate.id === selectedTeamId);
  const opponentId = nextGame
    ? nextGame.homeTeamId === selectedTeamId
      ? nextGame.awayTeamId
      : nextGame.homeTeamId
    : undefined;
  const opponent = teams?.find((candidate) => candidate.id === opponentId);
  const visibleStandings = standings?.slice(0, 3) ?? [];

  if (isLoadingGame || isLoadingTeams || !game) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight">
          Hola, GM de los {team?.name || "Lakers"}
        </h1>
        <p className="text-muted-foreground text-lg">Este es el estado actual de tu franquicia.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CapSpaceWidget gameId={gameId} teamId={game.selectedTeamId} />
        </div>

        <div>
          <AlertsWidget gameId={gameId} teamId={game.selectedTeamId} seasonYear={game.seasonYear} />
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Próximo Partido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="flex items-center justify-center gap-6 w-full">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {team?.abbreviation ?? "—"}
                  </div>
                </div>
                <div className="text-sm font-bold text-muted-foreground">VS</div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {opponent?.abbreviation ?? "—"}
                  </div>
                </div>
              </div>
              <div>
                <p className="font-bold">{opponent?.name ?? "Sin próximo partido"}</p>
                <p className="text-sm text-muted-foreground">
                  {nextGame
                    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
                        new Date(`${nextGame.date}T12:00:00`)
                      )
                    : "Calendario pendiente"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Posiciones (Oeste)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-2">
              {visibleStandings.map((standing, index) => (
                <div
                  key={standing.teamId}
                  className={`flex justify-between items-center text-sm p-2 rounded-md ${standing.teamId === selectedTeamId ? "bg-primary/10 border border-primary/20" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold w-4">{index + 1}.</span>
                    <span>
                      {teams?.find((candidate) => candidate.id === standing.teamId)?.abbreviation ??
                        "—"}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {standing.wins}-{standing.losses}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-500" />
              Noticias de la Liga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Lesión importante</h4>
                <p className="text-xs text-muted-foreground">
                  Joel Embiid fuera por 4 semanas debido a un esguince.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">Rumor de traspaso</h4>
                <p className="text-xs text-muted-foreground">
                  Los Bulls buscan mover el contrato de Zach LaVine antes del deadline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
