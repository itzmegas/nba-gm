"use client";

import { Calendar, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDeleteGame } from "@/application/hooks/games/useDeleteGame";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Game } from "@/domain/entities/Game";
import type { Team } from "@/domain/entities/Team";

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

interface GameListProps {
  games: Game[];
  teams: Team[];
}

export function GameList({ games, teams }: GameListProps) {
  const t = useT();
  const locale = useLocale();
  const deleteGameMutation = useDeleteGame();
  const teamById = new Map(teams.map((team) => [team.id, team]));

  return (
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
                  {t("games", "franchise")}:{" "}
                  <span className="font-medium text-foreground">
                    {team?.city} {team?.name}
                  </span>
                </p>
                <p>
                  {t("games", "season")}:{" "}
                  <span className="font-medium text-foreground">
                    {game.seasonYear}-{String(game.seasonYear + 1).slice(-2)}
                  </span>
                </p>
                <p>
                  {t("games", "status")}:{" "}
                  <span className="font-medium text-foreground capitalize">{game.status}</span>
                </p>
                <p className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t("games", "lastUpdated")}: {formatDate(game.updatedAt, locale)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/games/${game.id}/dashboard`} className="flex-1">
                  <Button className="w-full">{t("games", "load")}</Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`${t("games", "delete")} ${game.name}`}
                      disabled={deleteGameMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("games", "deleteGame")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("games", "deleteGameDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteGameMutation.isPending}>
                        {t("common", "cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={deleteGameMutation.isPending}
                        onClick={() => deleteGameMutation.mutate(game.id)}
                      >
                        {t("games", "delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
