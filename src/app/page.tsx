"use client";

import { Calendar, FolderOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDeleteGame } from "@/application/hooks/games/useDeleteGame";
import { useGames } from "@/application/hooks/games/useGames";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function GameMenuPage() {
  const { data: games, isLoading, error } = useGames();
  const { data: teams } = useTeams();
  const deleteGameMutation = useDeleteGame();

  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg w-full border-destructive/40 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error al cargar partidas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive/90">
            {error.message || "No se pudieron cargar tus partidas."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tighter text-primary">
              THE ASSOCIATION
            </span>
            <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground hidden sm:inline-block">
              GAME MENU
            </span>
          </div>

          <Link href="/games/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Game
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Tus simulaciones</h1>
          <p className="text-muted-foreground">Cargá una partida o iniciá una nueva franquicia.</p>
        </div>

        {!games || games.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-16 flex flex-col items-center text-center gap-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground/60" />
              <div className="space-y-1">
                <p className="font-semibold">No tenés partidas guardadas</p>
                <p className="text-sm text-muted-foreground">
                  Creá una nueva partida para empezar tu carrera como GM.
                </p>
              </div>
              <Link href="/games/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear primera partida
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => {
              const team = teamById.get(game.selectedTeamId);

              return (
                <Card key={game.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-bold">{game.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        Franquicia:{" "}
                        <span className="font-medium text-foreground">
                          {team?.city} {team?.name}
                        </span>
                      </p>
                      <p>
                        Temporada:{" "}
                        <span className="font-medium text-foreground">
                          {game.seasonYear}-{String(game.seasonYear + 1).slice(-2)}
                        </span>
                      </p>
                      <p>
                        Estado:{" "}
                        <span className="font-medium text-foreground capitalize">
                          {game.status}
                        </span>
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Última actualización: {formatDate(game.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/games/${game.id}/dashboard`} className="flex-1">
                        <Button className="w-full">Load</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteGameMutation.mutate(game.id)}
                        disabled={deleteGameMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
