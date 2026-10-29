"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { useSeasonStatistics } from "@/application/hooks/schedule/useSeasonStatistics";
import { useT } from "@/application/providers/I18nProvider";
import { playerStatisticsValues } from "@/application/statistics/playerStatisticsValues";
import { playerProfileHref } from "@/components/league/navigation";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableTableHeader } from "@/components/ui/sortable-table-header";
import type { Player } from "@/domain/entities/Player";
import {
  SEASON_STATISTICS_PHASE,
  type SeasonStatisticsPhase,
} from "@/domain/entities/PlayerSeasonStatistics";
import { formatSeasonLabel } from "@/domain/entities/Season";

const PHASE_LABELS = {
  regular_season: "regularSeason",
  play_in: "playIn",
  playoffs: "playoffs",
} as const;

const COLUMNS = [
  ["gamesPlayed", "GP"],
  ["minutes", "MIN"],
  ["points", "PTS"],
  ["offensiveRebounds", "ORB"],
  ["defensiveRebounds", "DRB"],
  ["rebounds", "REB"],
  ["assists", "AST"],
  ["steals", "STL"],
  ["blocks", "BLK"],
  ["turnovers", "TO"],
  ["personalFouls", "PF"],
  ["fieldGoalsMade", "FGM"],
  ["fieldGoalsAttempted", "FGA"],
  ["fieldGoalPercentage", "FG%"],
  ["threePointersMade", "3PM"],
  ["threePointersAttempted", "3PA"],
  ["threePointPercentage", "3P%"],
  ["freeThrowsMade", "FTM"],
  ["freeThrowsAttempted", "FTA"],
  ["freeThrowPercentage", "FT%"],
] as const;
type SortKey = (typeof COLUMNS)[number][0] | "playerName";

interface SeasonStatisticsProps {
  gameId: string;
  seasonYear: number;
  players?: Pick<Player, "id" | "fullName" | "headshotUrl">[];
  leagueTeamId?: string;
  leagueReturnQuery?: string;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string;
}

export function SeasonStatistics({
  gameId,
  seasonYear,
  players,
  leagueTeamId,
  leagueReturnQuery,
  onSelectPlayer,
  selectedPlayerId,
}: SeasonStatisticsProps) {
  const t = useT();
  const [phase, setPhase] = useState<SeasonStatisticsPhase>(SEASON_STATISTICS_PHASE.REGULAR_SEASON);
  const query = useSeasonStatistics(gameId, seasonYear, phase);
  const [perGame, setPerGame] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [ascending, setAscending] = useState(false);
  const sort = (key: SortKey) => {
    setSortKey(key);
    setAscending(key === sortKey ? !ascending : key === "playerName");
  };
  const stats = new Map(query.data?.players.map((player) => [player.playerId, player]));
  const appearances = players
    ? players.map((player) => ({
        playerId: player.id,
        playerName: player.fullName,
        headshotUrl: player.headshotUrl,
        statistics: stats.get(player.id),
      }))
    : (query.data?.players ?? []).map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        headshotUrl: undefined,
        statistics: player,
      }));
  const rows = appearances
    .map((player) => ({
      ...player,
      values: player.statistics ? playerStatisticsValues(player.statistics, perGame) : null,
    }))
    .sort((a, b) => {
      const left = sortKey === "playerName" ? a.playerName : (a.values?.[sortKey] ?? null);
      const right = sortKey === "playerName" ? b.playerName : (b.values?.[sortKey] ?? null);
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const difference =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      return (ascending ? difference : -difference) || a.playerId.localeCompare(b.playerId);
    });
  return (
    <section className="space-y-3" aria-label={t("seasonStats", "title")}>
      <h2 className="text-xl font-bold">
        {t("seasonStats", "title")} · {formatSeasonLabel(seasonYear)}
      </h2>
      <Select
        value={phase}
        onValueChange={(value) => setPhase(z.enum(SEASON_STATISTICS_PHASE).parse(value))}
      >
        <SelectTrigger aria-label={t("seasonStats", "phase")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(SEASON_STATISTICS_PHASE).map((value) => (
            <SelectItem key={value} value={value}>
              {t("seasonStats", PHASE_LABELS[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p>{t("seasonStats", players ? "rosterSeason" : "leagueSeason")}</p>
      {query.isPending ? (
        <output>{t("common", "loading")}</output>
      ) : query.isError ? (
        <div role="alert">
          <p>{t("seasonStats", "loadFailed")}</p>
          <Button onClick={() => query.refetch()}>{t("boxScore", "retry")}</Button>
        </div>
      ) : (
        query.data && (
          <>
            <p>
              {t("seasonStats", "coverage")}: {query.data.coveredGames} /{" "}
              {query.data.completedGames}
            </p>
            {query.data.coveredGames < query.data.completedGames && (
              <p className="text-muted-foreground">{t("seasonStats", "incomplete")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("seasonStats", "participation")}</p>
            <div className="flex gap-2">
              <Button
                variant={perGame ? "outline" : "default"}
                aria-pressed={!perGame}
                onClick={() => setPerGame(false)}
              >
                {t("seasonStats", "totals")}
              </Button>
              <Button
                variant={perGame ? "default" : "outline"}
                aria-pressed={perGame}
                onClick={() => setPerGame(true)}
              >
                {t("seasonStats", "perGame")}
              </Button>
            </div>
            {!rows.length ? (
              <p>{t("seasonStats", "empty")}</p>
            ) : (
              <AppTable>
                <caption className="sr-only">
                  {t("seasonStats", "title")} · {t("seasonStats", PHASE_LABELS[phase])} ·{" "}
                  {t("seasonStats", perGame ? "perGame" : "totals")}
                </caption>
                <AppTableHeader>
                  <AppTableRow>
                    <SortableTableHeader
                      ascending={sortKey === "playerName" ? ascending : undefined}
                      className="[&>button]:justify-start"
                      onSort={() => sort("playerName")}
                    >
                      {t("boxScore", "player")}
                    </SortableTableHeader>
                    {COLUMNS.map(([key, label]) => (
                      <SortableTableHeader
                        key={key}
                        className="px-3 text-center whitespace-nowrap"
                        ascending={sortKey === key ? ascending : undefined}
                        onSort={() => sort(key)}
                      >
                        <abbr className="no-underline" title={t("seasonStats", key)}>
                          {label}
                        </abbr>
                      </SortableTableHeader>
                    ))}
                  </AppTableRow>
                </AppTableHeader>
                <tbody>
                  {rows.map((row) => (
                    <AppTableRow
                      key={row.playerId}
                      className={onSelectPlayer ? "cursor-pointer" : undefined}
                      data-state={selectedPlayerId === row.playerId ? "selected" : undefined}
                      onClick={(event) => {
                        if (event.target instanceof Element && event.target.closest("button, a"))
                          return;
                        onSelectPlayer?.(row.playerId);
                      }}
                    >
                      <AppTableHead scope="row" className="font-semibold text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted/50">
                            <PlayerHeadshot
                              src={row.headshotUrl}
                              alt=""
                              className="h-full w-full object-cover object-top"
                            />
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            {onSelectPlayer ? (
                              <button
                                type="button"
                                className="hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                                aria-pressed={selectedPlayerId === row.playerId}
                                onClick={() => onSelectPlayer(row.playerId)}
                              >
                                {row.playerName}
                              </button>
                            ) : players ? (
                              <Link
                                className="hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                                href={playerProfileHref(
                                  gameId,
                                  row.playerId,
                                  leagueTeamId,
                                  leagueReturnQuery
                                )}
                              >
                                {row.playerName}
                              </Link>
                            ) : (
                              row.playerName
                            )}
                            {!row.values && (
                              <span className="sr-only">
                                {" "}
                                · {t("seasonStats", "noAppearances")}
                              </span>
                            )}
                          </div>
                        </div>
                      </AppTableHead>
                      {COLUMNS.map(([key]) => (
                        <AppTableCell key={key} className="px-3 text-center font-mono tabular-nums">
                          {row.values?.[key] == null
                            ? "—"
                            : row.values[key].toFixed(
                                key === "gamesPlayed" ||
                                  (!perGame && key !== "minutes" && !key.endsWith("Percentage"))
                                  ? 0
                                  : 1
                              )}
                        </AppTableCell>
                      ))}
                    </AppTableRow>
                  ))}
                </tbody>
              </AppTable>
            )}
          </>
        )
      )}
    </section>
  );
}
