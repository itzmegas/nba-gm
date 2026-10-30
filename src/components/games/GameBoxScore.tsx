"use client";

import { useState } from "react";
import { useBoxScore } from "@/application/hooks/schedule/useBoxScore";
import { useT } from "@/application/providers/I18nProvider";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Button } from "@/components/ui/button";
import { BOX_SCORE_SIDE } from "@/domain/entities/GameBoxScore";

interface GameBoxScoreProps {
  gameId: string;
  fixtureId: string;
  homeLabel: string;
  awayLabel: string;
}

const COLUMNS = [
  ["minutes", "MIN"],
  ["fieldGoals", "FG"],
  ["threePointers", "3P"],
  ["freeThrows", "FT"],
  ["offensiveRebounds", "ORB"],
  ["defensiveRebounds", "DRB"],
  ["rebounds", "REB"],
  ["assists", "AST"],
  ["steals", "STL"],
  ["blocks", "BLK"],
  ["turnovers", "TO"],
  ["personalFouls", "PF"],
  ["points", "PTS"],
] as const;

export function GameBoxScoreContent({
  gameId,
  fixtureId,
  homeLabel,
  awayLabel,
}: GameBoxScoreProps) {
  const t = useT();
  const query = useBoxScore(gameId, fixtureId);
  if (query.isPending)
    return (
      <output className="block py-6 text-sm text-muted-foreground">
        {t("boxScore", "loading")}
      </output>
    );
  if (query.isError)
    return (
      <div role="alert" className="space-y-2 text-destructive">
        <p>{t("boxScore", "loadFailed")}</p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          {t("boxScore", "retry")}
        </Button>
      </div>
    );
  if (!query.data)
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">
        {t("boxScore", "unavailable")}
      </p>
    );
  const game = query.data;
  return (
    <div className="min-w-0 space-y-5 py-4">
      {game.overtimes > 0 && (
        <p>
          {t("boxScore", "overtimes")}: {game.overtimes}
        </p>
      )}
      {[BOX_SCORE_SIDE.AWAY, BOX_SCORE_SIDE.HOME].map((side) => (
        <AppTable key={side}>
          <caption className="border-b bg-muted/30 px-4 py-3 text-left text-sm font-semibold text-foreground">
            {side === BOX_SCORE_SIDE.HOME ? homeLabel : awayLabel} ·{" "}
            {side === BOX_SCORE_SIDE.HOME ? game.homeScore : game.awayScore}
          </caption>
          <AppTableHeader>
            <AppTableRow>
              <AppTableHead className="sticky left-0 z-10 bg-card">
                {t("boxScore", "player")}
              </AppTableHead>
              {COLUMNS.map(([key, label]) => (
                <AppTableHead key={key} className="px-3 text-right">
                  <abbr title={t("boxScore", key)} className="no-underline">
                    {label}
                  </abbr>
                </AppTableHead>
              ))}
            </AppTableRow>
          </AppTableHeader>
          <tbody>
            {game.players
              .filter((p) => p.side === side)
              .map((p) => (
                <AppTableRow key={p.playerId}>
                  <AppTableHead
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-card font-semibold text-foreground"
                  >
                    {p.playerName}
                  </AppTableHead>
                  {[
                    p.seconds === 0
                      ? t("boxScore", "didNotPlay")
                      : `${Math.floor(p.seconds / 60)}:${String(p.seconds % 60).padStart(2, "0")}`,
                    `${p.fieldGoalsMade}-${p.fieldGoalsAttempted}`,
                    `${p.threePointersMade}-${p.threePointersAttempted}`,
                    `${p.freeThrowsMade}-${p.freeThrowsAttempted}`,
                    p.offensiveRebounds,
                    p.defensiveRebounds,
                    p.offensiveRebounds + p.defensiveRebounds,
                    p.assists,
                    p.steals,
                    p.blocks,
                    p.turnovers,
                    p.personalFouls,
                    p.points,
                  ].map((value, index) => (
                    <AppTableCell
                      key={COLUMNS[index][0]}
                      className={`whitespace-nowrap px-3 text-right font-mono tabular-nums ${index === COLUMNS.length - 1 ? "bg-primary/5 font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {value}
                    </AppTableCell>
                  ))}
                </AppTableRow>
              ))}
          </tbody>
        </AppTable>
      ))}
    </div>
  );
}

export function GameBoxScore(props: GameBoxScoreProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-sm py-3 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring">
        {t("boxScore", "title")}
      </summary>
      {open && <GameBoxScoreContent {...props} />}
    </details>
  );
}
