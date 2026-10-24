"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useGame } from "@/application/hooks/games/useGame";
import { useSchedule } from "@/application/hooks/schedule/useSchedule";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { FixtureGameCard } from "@/components/games/FixtureGameCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DailyGames({ gameId, date }: { gameId: string; date: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const game = useGame(gameId);
  const schedule = useSchedule(gameId);
  const teams = useTeams();
  const basePath = `/games/${gameId}/dashboard/schedule`;
  if (game.isLoading || schedule.isLoading || teams.isLoading)
    return <output>{t("common", "loading")}</output>;
  if (game.isError || !game.data || schedule.isError || teams.isError)
    return (
      <div role="alert" className="space-y-3">
        <p>{t("dashboard", "unableToLoadGame")}</p>
        <Button onClick={() => Promise.all([game.refetch(), schedule.refetch(), teams.refetch()])}>
          {t("boxScore", "retry")}
        </Button>
      </div>
    );

  const dates = [...new Set((schedule.data ?? []).map((fixture) => fixture.date))].sort();
  const previous = dates.findLast((day) => day < date);
  const next = dates.find((day) => day > date);
  const teamsById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const selectedTeamId = game.data.selectedTeamId;
  const isOwnGame = (fixture: { homeTeamId: string; awayTeamId: string }) =>
    fixture.homeTeamId === selectedTeamId || fixture.awayTeamId === selectedTeamId;
  const fixtures = (schedule.data ?? [])
    .filter((fixture) => fixture.date === date)
    .sort((a, b) => Number(isOwnGame(b)) - Number(isOwnGame(a)));
  const label = new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  return (
    <section className="space-y-6" aria-labelledby="daily-games-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 id="daily-games-title" className="text-3xl font-black">
            {t("dailyGames", "title")}
          </h1>
          <p className="capitalize text-muted-foreground">
            <time dateTime={date}>{label}</time>
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={basePath}>{t("dailyGames", "backToCalendar")}</Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          disabled={!previous}
          aria-label={t("dailyGames", "previousDay")}
          onClick={() => previous && router.push(`${basePath}/day/${previous}`)}
        >
          <ChevronLeft />
        </Button>
        <label htmlFor="daily-games-date" className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("dailyGames", "date")}</span>
          <Input
            id="daily-games-date"
            type="date"
            value={date}
            min={dates[0]}
            max={dates.at(-1)}
            onChange={(event) => {
              const parsed = z.iso.date().safeParse(event.target.value);
              if (parsed.success && parsed.data !== date)
                router.push(`${basePath}/day/${parsed.data}`);
            }}
          />
        </label>
        <Button
          variant="outline"
          size="icon"
          disabled={!next}
          aria-label={t("dailyGames", "nextDay")}
          onClick={() => next && router.push(`${basePath}/day/${next}`)}
        >
          <ChevronRight />
        </Button>
      </div>
      {!fixtures.length ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          {t("dailyGames", "empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {fixtures.map((fixture) => (
            <FixtureGameCard
              key={fixture.id}
              gameId={gameId}
              fixture={fixture}
              home={teamsById.get(fixture.homeTeamId)}
              away={teamsById.get(fixture.awayTeamId)}
              ownGame={isOwnGame(fixture)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
