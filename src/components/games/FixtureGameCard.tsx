"use client";

import Image from "next/image";
import { useT } from "@/application/providers/I18nProvider";
import { GameBoxScore, GameBoxScoreContent } from "@/components/games/GameBoxScore";
import { Badge } from "@/components/ui/badge";
import { SCHEDULED_GAME_STATUS, type ScheduledGame } from "@/domain/entities/ScheduledGame";
import type { Team } from "@/domain/entities/Team";

interface FixtureGameCardProps {
  gameId: string;
  fixture: ScheduledGame;
  home?: Team;
  away?: Team;
  ownGame?: boolean;
  expanded?: boolean;
}

export function FixtureGameCard({
  gameId,
  fixture,
  home,
  away,
  ownGame,
  expanded = false,
}: FixtureGameCardProps) {
  const t = useT();
  const completed = fixture.status === SCHEDULED_GAME_STATUS.COMPLETED;
  const homeLabel = home?.name ?? t("dashboard", "home");
  const awayLabel = away?.name ?? t("dashboard", "away");
  const Score = expanded ? GameBoxScoreContent : GameBoxScore;
  return (
    <article
      aria-label={`${awayLabel} @ ${homeLabel}`}
      className={`overflow-hidden rounded-xl border bg-card ${ownGame ? "border-primary/50" : "border-border/50"}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${ownGame ? "bg-primary/5" : "bg-muted/30"}`}
      >
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {t("dashboard", completed ? "final" : "scheduled")}
        </span>
        {ownGame && <Badge variant="outline">{t("dailyGames", "yourGame")}</Badge>}
      </div>
      <div data-slot="fixture-scoreboard" className="grid grid-cols-2 divide-x py-6 sm:py-8">
        {[
          { side: "away", team: away, label: awayLabel, score: fixture.awayScore },
          { side: "home", team: home, label: homeLabel, score: fixture.homeScore },
        ].map(({ side, team, label, score }) => (
          <div
            key={side}
            className="flex min-w-0 flex-col items-center gap-2 px-4 text-center sm:px-6"
          >
            {team?.logoUrl ? (
              <Image
                src={team.logoUrl}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 object-contain dark:drop-shadow-[0_0_1px_white]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center text-lg font-bold text-muted-foreground"
              >
                {team?.abbreviation ?? "—"}
              </span>
            )}
            <span className="text-sm font-semibold sm:text-base">
              {label}
              <span className="mt-1 block text-xs font-normal uppercase tracking-wider text-muted-foreground">
                {t("dashboard", side === "home" ? "home" : "away")}
              </span>
            </span>
            <span className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {completed ? (score ?? "—") : "—"}
            </span>
          </div>
        ))}
      </div>
      {completed && (
        <div className="border-t px-4 pb-4 sm:px-5">
          <Score
            key={fixture.id}
            gameId={gameId}
            fixtureId={fixture.id}
            homeLabel={homeLabel}
            awayLabel={awayLabel}
          />
        </div>
      )}
    </article>
  );
}
