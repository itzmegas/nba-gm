"use client";

import { ArrowRight, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { display } from "@/app/ui-preview/fonts";
import { usePostseason } from "@/application/hooks/postseason/usePostseason";
import { useAdvanceRange, useNextGame } from "@/application/hooks/simulation";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GAME_STATUS, type Game } from "@/domain/entities/Game";
import { hasPostseasonChampion, POSTSEASON_PHASE } from "@/domain/entities/Postseason";

export function NextGameWidget({ game }: { game: Game }) {
  const t = useT();
  const locale = useLocale();
  const next = useNextGame(game.id, game.selectedTeamId, game.simulationDate);
  const { data: teams } = useTeams();
  const advance = useAdvanceRange();
  const postseason = usePostseason(game.id);
  const seasonComplete =
    !postseason.isPending &&
    !postseason.isError &&
    !!postseason.data &&
    hasPostseasonChampion(postseason.data);
  const active = useBatchSimulationStore((state) => state.isActive);
  const mode = useBatchSimulationStore((state) => state.mode);
  const fixture = next.data;
  const home = teams?.find((team) => team.id === fixture?.homeTeamId);
  const away = teams?.find((team) => team.id === fixture?.awayTeamId);
  const simulate = () => {
    if (
      !fixture ||
      active ||
      advance.isPending ||
      seasonComplete ||
      game.status !== GAME_STATUS.ACTIVE
    )
      return;
    const days = Math.round(
      (Date.parse(`${fixture.date}T00:00:00Z`) - game.simulationDate.getTime()) / 86_400_000
    );
    if (useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, days)) {
      advance.mutate({
        gameId: game.id,
        simulationDate: game.simulationDate,
        seasonYear: game.seasonYear,
        mode: BATCH_SIMULATION_MODE.NEXT_GAME,
        targetDate: fixture.date,
      });
    }
  };

  return (
    <Card className="min-w-0 gap-4 overflow-hidden rounded-md border-border/60 bg-card py-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
        <CardTitle className="text-base font-semibold">
          {t(
            "dashboard",
            !next.isPending && !next.isError && !fixture ? "nextChapter" : "nextGame"
          )}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="rounded-sm">
          <Link href={`/games/${game.id}/dashboard/schedule`}>
            {t("dashboard", "calendar")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {next.isPending ? (
          <output className="block py-12 text-center text-sm text-muted-foreground">
            {t("common", "loading")}
          </output>
        ) : next.isError ? (
          <p className="py-12 text-center text-sm text-destructive" role="alert">
            {t("dashboard", "unableToLoadGame")}
          </p>
        ) : !fixture ? (
          <div className="space-y-4 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("dashboard", "noNextGame")}
            </p>
            <h3
              className={`${display.className} max-w-xs text-4xl font-semibold uppercase leading-tight`}
            >
              {t("dashboard", "reviewYourFranchise")}
            </h3>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("dashboard", "noUpcomingFixtures")}
            </p>
            {!postseason.isPending &&
              !postseason.isError &&
              postseason.data &&
              postseason.data.phase !== POSTSEASON_PHASE.REGULAR_SEASON && (
                <Button asChild variant="outline" size="sm" className="rounded-sm">
                  <Link href={`/games/${game.id}/dashboard/postseason`}>
                    {t("postseason", "title")}
                    {hasPostseasonChampion(postseason.data) && ` · ${t("offseason", "title")}`}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
                {new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
                  dateStyle: "full",
                  timeZone: "UTC",
                }).format(new Date(`${fixture.date}T00:00:00Z`))}
              </span>
              <span>
                · {t("dashboard", fixture.homeTeamId === game.selectedTeamId ? "home" : "away")}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 sm:gap-6">
              {[away, home].map((team, index) => (
                <Fragment key={index === 0 ? "away" : "home"}>
                  {index === 1 && (
                    <span className="text-xs font-bold tracking-widest text-muted-foreground">
                      {t("dashboard", "versus")}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col items-center gap-3 text-center">
                    {team?.logoUrl ? (
                      <Image
                        src={team.logoUrl}
                        alt=""
                        width={112}
                        height={112}
                        className="size-16 object-contain sm:size-20"
                      />
                    ) : (
                      <span className="flex size-20 items-center justify-center text-3xl font-black sm:size-28">
                        {team?.abbreviation ?? "—"}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-bold sm:text-base">
                        {team?.name ?? t("dashboard", "teamFallback")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("dashboard", index === 0 ? "away" : "home")}
                      </p>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-5">
              <Button
                className="min-h-11 w-full rounded-sm sm:w-auto sm:min-w-64"
                onClick={simulate}
                disabled={
                  active ||
                  advance.isPending ||
                  seasonComplete ||
                  game.status !== GAME_STATUS.ACTIVE
                }
              >
                <Play className="size-4" />
                {active && mode === BATCH_SIMULATION_MODE.NEXT_GAME
                  ? t("dashboard", "simulatingToGame")
                  : t("dashboard", "simulateToGame")}
              </Button>
              <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
                {t("dashboard", "simulateToGameHelp")}
              </p>
            </div>
          </>
        )}
        {advance.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("dashboard", "unableToAdvance")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
