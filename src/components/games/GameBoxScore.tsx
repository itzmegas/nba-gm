"use client";

import { useState } from "react";
import { useBoxScore } from "@/application/hooks/schedule/useBoxScore";
import { useT } from "@/application/providers/I18nProvider";
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

function BoxScoreContent({ gameId, fixtureId, homeLabel, awayLabel }: GameBoxScoreProps) {
  const t = useT();
  const query = useBoxScore(gameId, fixtureId);
  if (query.isPending) return <output>{t("boxScore", "loading")}</output>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2 text-destructive">
        <p>{t("boxScore", "loadFailed")}</p>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          {t("boxScore", "retry")}
        </Button>
      </div>
    );
  if (!query.data) return <p className="text-muted-foreground">{t("boxScore", "unavailable")}</p>;
  const game = query.data;
  return (
    <div className="space-y-4">
      {game.overtimes > 0 && (
        <p>
          {t("boxScore", "overtimes")}: {game.overtimes}
        </p>
      )}
      {[BOX_SCORE_SIDE.AWAY, BOX_SCORE_SIDE.HOME].map((side) => (
        <div key={side} className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <caption className="p-3 text-left text-sm font-semibold text-foreground">
              {side === BOX_SCORE_SIDE.HOME ? homeLabel : awayLabel} ·{" "}
              {side === BOX_SCORE_SIDE.HOME ? game.homeScore : game.awayScore}
            </caption>
            <thead className="bg-muted/40">
              <tr>
                <th scope="col" className="p-2 text-left">
                  {t("boxScore", "player")}
                </th>
                {COLUMNS.map(([key, label]) => (
                  <th key={key} scope="col" className="p-2 text-right">
                    <abbr title={t("boxScore", key)} className="no-underline">
                      {label}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {game.players
                .filter((p) => p.side === side)
                .map((p) => (
                  <tr key={p.playerId} className="border-t">
                    <th scope="row" className="whitespace-nowrap p-2 text-left font-medium">
                      {p.playerName}
                    </th>
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
                      <td key={COLUMNS[index][0]} className="whitespace-nowrap p-2 text-right">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function GameBoxScore(props: GameBoxScoreProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-sm py-2 font-semibold focus-visible:outline-2 focus-visible:outline-ring">
        {t("boxScore", "title")}
      </summary>
      {open && <BoxScoreContent {...props} />}
    </details>
  );
}
