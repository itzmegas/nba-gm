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
      className={`space-y-4 rounded-lg border bg-card p-4 ${ownGame ? "border-primary/50" : "border-border/50"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {t("dashboard", completed ? "final" : "scheduled")}
        </span>
        {ownGame && <Badge variant="outline">{t("dailyGames", "yourGame")}</Badge>}
      </div>
      <div className="space-y-3">
        {[
          { side: "away", team: away, label: awayLabel, score: fixture.awayScore },
          { side: "home", team: home, label: homeLabel, score: fixture.homeScore },
        ].map(({ side, team, label, score }) => (
          <div key={side} className="flex items-center gap-3">
            {team?.logoUrl ? (
              <Image
                src={team.logoUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 object-contain"
              />
            ) : (
              <span aria-hidden="true" className="w-10 text-xs font-bold">
                {team?.abbreviation ?? "—"}
              </span>
            )}
            <span className="min-w-0 flex-1 font-semibold">
              {label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("dashboard", side === "home" ? "home" : "away")}
              </span>
            </span>
            <span className="text-2xl font-black tabular-nums">
              {completed ? (score ?? "—") : "—"}
            </span>
          </div>
        ))}
      </div>
      {completed && (
        <Score
          key={fixture.id}
          gameId={gameId}
          fixtureId={fixture.id}
          homeLabel={homeLabel}
          awayLabel={awayLabel}
        />
      )}
    </article>
  );
}
