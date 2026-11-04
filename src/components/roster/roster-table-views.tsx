"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { SeasonStatistics } from "@/components/games/SeasonStatistics";
import {
  ROSTER_TABLE_VIEW,
  RosterTable,
  type RosterTableView,
  shouldRenderRosterPlayer,
} from "@/components/roster/roster-table";
import { Button } from "@/components/ui/button";

export function RosterTableViews({
  initialView = ROSTER_TABLE_VIEW.RATINGS,
  children,
  ...props
}: ComponentProps<typeof RosterTable> & { initialView?: RosterTableView; children?: ReactNode }) {
  const t = useT();
  const [statistics, setStatistics] = useState(false);
  const [view, setView] = useState<RosterTableView>(initialView);
  const [visited, setVisited] = useState<RosterTableView[]>([initialView]);
  function showView(next: RosterTableView) {
    setView(next);
    setStatistics(false);
    if (!visited.includes(next)) setVisited([...visited, next]);
  }
  return (
    <div className="space-y-3">
      <fieldset
        aria-label={t("seasonStats", "rosterView")}
        className="mx-5 flex w-fit max-w-[calc(100%-2.5rem)] flex-wrap gap-1 rounded-sm border border-border bg-muted/30 p-1"
      >
        <Button
          size="sm"
          variant={!statistics && view === ROSTER_TABLE_VIEW.OVERVIEW ? "secondary" : "ghost"}
          aria-pressed={!statistics && view === ROSTER_TABLE_VIEW.OVERVIEW}
          onClick={() => showView(ROSTER_TABLE_VIEW.OVERVIEW)}
        >
          {t("rosterUI", "overview")}
        </Button>
        <Button
          size="sm"
          variant={!statistics && view === ROSTER_TABLE_VIEW.RATINGS ? "secondary" : "ghost"}
          aria-pressed={!statistics && view === ROSTER_TABLE_VIEW.RATINGS}
          onClick={() => showView(ROSTER_TABLE_VIEW.RATINGS)}
        >
          {t("seasonStats", "attributesView")}
        </Button>
        <Button
          size="sm"
          variant={statistics ? "secondary" : "ghost"}
          aria-pressed={statistics}
          onClick={() => setStatistics(true)}
        >
          {t("seasonStats", "statisticsView")}
        </Button>
        <Button
          size="sm"
          variant={!statistics && view === ROSTER_TABLE_VIEW.CONTRACTS ? "secondary" : "ghost"}
          aria-pressed={!statistics && view === ROSTER_TABLE_VIEW.CONTRACTS}
          onClick={() => showView(ROSTER_TABLE_VIEW.CONTRACTS)}
        >
          {t("rosterUI", "contracts")}
        </Button>
      </fieldset>
      {children}
      {visited.map((tableView) => (
        <div key={tableView} hidden={statistics || view !== tableView}>
          <RosterTable {...props} view={tableView} />
        </div>
      ))}
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
