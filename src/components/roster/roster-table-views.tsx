"use client";

import { type ComponentProps, useState } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { SeasonStatistics } from "@/components/games/SeasonStatistics";
import { RosterTable, shouldRenderRosterPlayer } from "@/components/roster/roster-table";
import { Button } from "@/components/ui/button";

export function RosterTableViews(props: ComponentProps<typeof RosterTable>) {
  const t = useT();
  const [statistics, setStatistics] = useState(false);
  return (
    <div className="space-y-3">
      <fieldset aria-label={t("seasonStats", "rosterView")} className="flex flex-wrap gap-2 px-4">
        <Button
          variant={statistics ? "outline" : "default"}
          aria-pressed={!statistics}
          onClick={() => setStatistics(false)}
        >
          {t("seasonStats", "attributesView")}
        </Button>
        <Button
          variant={statistics ? "default" : "outline"}
          aria-pressed={statistics}
          onClick={() => setStatistics(true)}
        >
          {t("seasonStats", "statisticsView")}
        </Button>
      </fieldset>
      <div hidden={statistics}>
        <RosterTable {...props} />
      </div>
      {statistics && (
        <SeasonStatistics
          gameId={props.gameId}
          seasonYear={props.seasonYear}
          players={props.players.filter(shouldRenderRosterPlayer).map(({ player }) => player)}
          leagueTeamId={props.leagueTeamId}
          leagueReturnQuery={props.leagueReturnQuery}
          onSelectPlayer={props.onSelectPlayer}
          selectedPlayerId={props.selectedPlayerId}
        />
      )}
    </div>
  );
}
