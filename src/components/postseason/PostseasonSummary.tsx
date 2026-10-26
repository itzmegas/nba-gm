"use client";

import Image from "next/image";
import { useState } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  hasPostseasonChampion,
  isPlayoffsReady,
  isTeamEliminated,
  POSTSEASON_PHASE,
  type PostseasonState,
} from "@/domain/entities/Postseason";
import type { Team } from "@/domain/entities/Team";

interface PostseasonSummaryProps {
  state: PostseasonState;
  selectedTeamId: string;
  teams: Team[];
}

export function PostseasonSummary({ state, selectedTeamId, teams }: PostseasonSummaryProps) {
  const t = useT();
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const complete = hasPostseasonChampion(state);
  const eliminated = isTeamEliminated(state, selectedTeamId);
  const competing =
    !eliminated &&
    (state.phase === POSTSEASON_PHASE.PLAY_IN || state.phase === POSTSEASON_PHASE.PLAYOFFS);
  const name = (id: string) => teams.find((team) => team.id === id)?.name ?? id;
  const seed = state.playoffSeeds.find((seed) => seed.teamId === selectedTeamId);
  const qualification = state.qualification.find((seed) => seed.teamId === selectedTeamId);
  const series = competing
    ? state.series
        .filter(
          (series) =>
            !series.winnerTeamId &&
            (series.homeTeamId === selectedTeamId || series.awayTeamId === selectedTeamId)
        )
        .sort((a, b) => b.round - a.round)[0]
    : undefined;
  const nextGame = competing
    ? state.games
        .filter(
          (game) =>
            game.status === "scheduled" &&
            (game.homeTeamId === selectedTeamId || game.awayTeamId === selectedTeamId) &&
            (state.phase === POSTSEASON_PHASE.PLAY_IN
              ? game.stage !== null
              : !!series && game.seriesId === series.id)
        )
        .sort((a, b) => a.gameDate.localeCompare(b.gameDate))[0]
    : undefined;
  const champion = complete ? teams.find((team) => team.id === state.championTeamId) : undefined;
  const finals = complete
    ? state.series.find(
        (series) =>
          series.conference === "Finals" &&
          series.winnerTeamId === state.championTeamId &&
          state.runnerUpTeamId !== null &&
          ((series.homeTeamId === state.championTeamId &&
            series.awayTeamId === state.runnerUpTeamId) ||
            (series.awayTeamId === state.championTeamId &&
              series.homeTeamId === state.runnerUpTeamId))
      )
    : undefined;
  const championHome = finals?.homeTeamId === state.championTeamId;
  const selectedChampion = complete && state.championTeamId === selectedTeamId;
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3" aria-live="polite">
        <Badge variant="secondary">
          {t("postseason", isPlayoffsReady(state) ? "ready" : state.phase)}
        </Badge>
        <div className="grid items-start gap-4 md:grid-cols-3">
          {complete && state.championTeamId && (
            <div className="flex min-w-0 items-center gap-3 md:col-span-2">
              {champion?.logoUrl && failedLogo !== champion.logoUrl ? (
                <Image
                  src={champion.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 object-contain"
                  onError={() => setFailedLogo(champion.logoUrl ?? null)}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold"
                >
                  {champion?.abbreviation ?? "—"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("postseason", "champion")}</p>
                <h2 className="break-words text-xl font-bold">{name(state.championTeamId)}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("postseason", "Finals")}:{" "}
                  {finals ? (
                    <span className="font-semibold tabular-nums text-foreground">
                      {championHome ? finals.homeWins : finals.awayWins}–
                      {championHome ? finals.awayWins : finals.homeWins}
                    </span>
                  ) : (
                    t("postseason", "resultUnavailable")
                  )}{" "}
                  · {t("postseason", "runnerUp")}:{" "}
                  {state.runnerUpTeamId ? name(state.runnerUpTeamId) : t("postseason", "tbd")}
                </p>
              </div>
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{t("postseason", "yourTeam")}</p>
            <p className="break-words font-semibold">{name(selectedTeamId)}</p>
            {(eliminated || selectedChampion) && qualification && (
              <p className="text-xs text-muted-foreground">
                {t("postseason", "qualification")}: #{qualification.seed} ·{" "}
                {t("postseason", qualification.conference)}
              </p>
            )}
            <p className="text-sm">
              {selectedChampion
                ? t("postseason", "champion")
                : eliminated
                  ? t("postseason", complete ? "eliminatedShort" : "eliminated")
                  : seed
                    ? `${t("postseason", "playoffSeed")}: #${seed.seed}`
                    : qualification
                      ? `${t("postseason", "qualification")}: #${qualification.seed} · ${t("postseason", qualification.conference)}`
                      : t("postseason", "tbd")}
            </p>
          </div>
          {competing && (
            <>
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">{t("postseason", "currentSeries")}</p>
                {series ? (
                  <>
                    <p className="break-words font-semibold">
                      {name(
                        series.homeTeamId === selectedTeamId ? series.awayTeamId : series.homeTeamId
                      )}
                    </p>
                    <p className="text-sm tabular-nums">
                      {name(selectedTeamId)}{" "}
                      {series.homeTeamId === selectedTeamId ? series.homeWins : series.awayWins}–
                      {series.homeTeamId === selectedTeamId ? series.awayWins : series.homeWins}
                    </p>
                  </>
                ) : (
                  <p className="text-sm">{t("postseason", "noCurrentSeries")}</p>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">{t("postseason", "nextGame")}</p>
                {nextGame ? (
                  <>
                    <p className="break-words text-sm font-semibold">
                      {name(nextGame.awayTeamId)} @ {name(nextGame.homeTeamId)}
                    </p>
                    <p className="text-sm">
                      <time dateTime={nextGame.gameDate}>{nextGame.gameDate}</time>
                    </p>
                  </>
                ) : (
                  <p className="text-sm">{t("postseason", "noNextGame")}</p>
                )}
              </div>
            </>
          )}
        </div>
        {state.phase === POSTSEASON_PHASE.REGULAR_SEASON && (
          <p className="text-sm text-muted-foreground">{t("postseason", "regularDescription")}</p>
        )}
        {isPlayoffsReady(state) && (
          <p className="text-sm text-muted-foreground">{t("postseason", "readyDescription")}</p>
        )}
        {complete && (
          <p className="text-xs text-muted-foreground">{t("postseason", "noRollover")}</p>
        )}
      </CardContent>
    </Card>
  );
}
