"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { use } from "react";
import { display } from "@/app/ui-preview/fonts";
import { useGame } from "@/application/hooks/games/useGame";
import { useStandings } from "@/application/hooks/simulation/useStandings";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { franchiseHref } from "@/components/league/navigation";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSeasonLabel } from "@/domain/entities/Season";

interface TeamsPageProps {
  params: Promise<{ gameId: string }>;
}

export default function TeamsPage({ params }: TeamsPageProps) {
  const { gameId } = use(params);
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gameQuery = useGame(gameId);
  const teamsQuery = useTeams();
  const standingsQuery = useStandings(gameId);
  const game = gameQuery.data;
  const teams = teamsQuery.data ?? [];
  const requestedTeamId = searchParams.get("teamId");
  const selectedTeam = teams.find((team) => team.id === requestedTeamId);
  const query = searchParams.get("q") ?? "";
  const requestedConference = searchParams.get("conference");
  const conference =
    requestedConference === "East" || requestedConference === "West" ? requestedConference : "all";
  const divisions = [
    ...new Set(
      teams
        .filter((team) => conference === "all" || team.conference === conference)
        .map((team) => team.division)
        .filter((division): division is string => Boolean(division && division !== "Unknown"))
    ),
  ].sort();
  const requestedDivision = searchParams.get("division") ?? "all";
  const division = divisions.includes(requestedDivision) ? requestedDivision : "all";
  const sort = searchParams.get("sort") === "record" ? "record" : "name";
  const records = new Map(
    (standingsQuery.isError ? [] : (standingsQuery.data ?? [])).map((row) => [row.teamId, row])
  );
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const filteredTeams = teams
    .filter(
      (team) =>
        (conference === "all" || team.conference === conference) &&
        (division === "all" || team.division === division) &&
        [team.name, team.city, team.abbreviation].some((value) =>
          value.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))
        )
    )
    .sort((a, b) => {
      if (sort === "record") {
        const aRecord = records.get(a.id);
        const bRecord = records.get(b.id);
        if (!aRecord || !bRecord)
          return Number(!aRecord) - Number(!bRecord) || collator.compare(a.name, b.name);
        const difference =
          bRecord.wins / (bRecord.wins + bRecord.losses || 1) -
          aRecord.wins / (aRecord.wins + aRecord.losses || 1);
        if (difference || aRecord.wins !== bRecord.wins)
          return difference || bRecord.wins - aRecord.wins;
      }
      return collator.compare(a.name, b.name);
    });

  function queryHref(values: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `${pathname}?${next.toString()}`;
  }

  function updateFilters(values: Record<string, string>) {
    window.history.replaceState(null, "", queryHref(values));
  }

  if (gameQuery.isError || teamsQuery.isError || (!gameQuery.isLoading && !game)) {
    return (
      <div role="alert" className="space-y-3 py-8 text-sm">
        <p className="text-destructive">{t("league", "loadFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void gameQuery.refetch();
            void teamsQuery.refetch();
          }}
        >
          {t("league", "retry")}
        </Button>
      </div>
    );
  }
  if (gameQuery.isLoading || teamsQuery.isLoading || !game)
    return <output className="block py-12 text-muted-foreground">{t("common", "loading")}</output>;

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            {t("dashboard", "league")} / {t("league", "teams")}
          </p>
          <h2 className={`${display.className} text-[34px] leading-none font-semibold uppercase`}>
            {t("league", "teams")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">{t("league", "teamsDescription")}</p>
        </div>
        <span className="rounded-sm border border-border px-3 py-1.5 text-xs tracking-wide text-muted-foreground tabular-nums">
          {formatSeasonLabel(game.seasonYear)} · NBA
        </span>
      </header>
      <Card className="min-w-0 gap-0 overflow-hidden rounded-md border-border/60 py-0 shadow-none [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0">
        <search
          aria-label={t("league", "directory")}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-b border-border/60 p-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,auto)]"
        >
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="teams-conference" className="text-xs text-muted-foreground">
              {t("league", "conference")}
            </label>
            <Select
              value={conference}
              onValueChange={(value) =>
                updateFilters({ conference: value === "all" ? "" : value, division: "" })
              }
            >
              <SelectTrigger id="teams-conference" className="min-w-0 w-full rounded-sm">
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("league", "allConferences")}</SelectItem>
                <SelectItem value="East">{t("games", "east")}</SelectItem>
                <SelectItem value="West">{t("games", "west")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="teams-division" className="text-xs text-muted-foreground">
              {t("league", "division")}
            </label>
            <Select
              value={division}
              onValueChange={(value) => updateFilters({ division: value === "all" ? "" : value })}
            >
              <SelectTrigger id="teams-division" className="min-w-0 w-full rounded-sm">
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("league", "allDivisions")}</SelectItem>
                {divisions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="teams-search" className="text-xs text-muted-foreground">
              {t("dashboard", "searchTeam")}
            </label>
            <Input
              id="teams-search"
              type="search"
              value={query}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder={t("dashboard", "searchTeam")}
              className="min-w-0 rounded-sm"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="teams-sort" className="text-xs text-muted-foreground">
              {t("league", "sortBy")}
            </label>
            <Select value={sort} onValueChange={(value) => updateFilters({ sort: value })}>
              <SelectTrigger id="teams-sort" className="min-w-0 w-full rounded-sm">
                <SelectValue className="min-w-0 truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("league", "name")}</SelectItem>
                <SelectItem value="record">{t("league", "record")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-w-0 self-end whitespace-normal rounded-sm"
            onClick={() => updateFilters({ q: "", conference: "", division: "", sort: "" })}
          >
            {t("league", "clear")}
          </Button>
        </search>
        {standingsQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <p className="text-destructive">{t("dashboard", "standingsFailed")}</p>
            <Button variant="outline" size="sm" onClick={() => void standingsQuery.refetch()}>
              {t("league", "retry")}
            </Button>
          </div>
        ) : (
          !standingsQuery.isPending &&
          teams.some((team) => !records.has(team.id)) && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {t("league", "recordsUnavailable")}
            </p>
          )
        )}
        <AppTable className="min-w-[1000px] table-fixed">
          <caption className="sr-only">{t("league", "directory")}</caption>
          <AppTableHeader>
            <AppTableRow>
              <AppTableHead className="w-[25%]">{t("league", "franchise")}</AppTableHead>
              <AppTableHead className="w-[17%]">
                {t("league", "conference")} / {t("league", "division")}
              </AppTableHead>
              <AppTableHead className="w-[7%] text-right">{t("league", "winsLosses")}</AppTableHead>
              <AppTableHead className="w-[8%] text-right">
                {t("league", "directoryRank")}
              </AppTableHead>
              <AppTableHead className="w-[6%] text-right">
                {t("league", "directoryOverall")}
              </AppTableHead>
              <AppTableHead className="w-[10%] text-right">
                {t("league", "directoryPayroll")}
              </AppTableHead>
              <AppTableHead className="w-[13%]">{t("league", "directoryDirection")}</AppTableHead>
              <AppTableHead className="w-[14%] text-right">{t("league", "action")}</AppTableHead>
            </AppTableRow>
          </AppTableHeader>
          <tbody>
            {filteredTeams.map((team) => {
              const record = records.get(team.id);
              const selected = team.id === selectedTeam?.id;
              return (
                <AppTableRow
                  key={team.id}
                  data-state={selected ? "selected" : undefined}
                  className={
                    team.id === game.selectedTeamId
                      ? "bg-primary/10 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-primary"
                      : undefined
                  }
                >
                  <AppTableCell className="py-3">
                    <div className="flex items-center gap-3">
                      {team.logoUrl ? (
                        <Image
                          src={team.logoUrl}
                          alt=""
                          width={30}
                          height={30}
                          className="size-[30px] shrink-0 object-contain"
                        />
                      ) : (
                        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-semibold">
                          {team.abbreviation}
                        </span>
                      )}
                      <div className="space-y-1">
                        <Link
                          href={franchiseHref(gameId, team.id, searchParams.toString())}
                          className="font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {team.name}
                        </Link>
                        <div className="flex flex-wrap gap-1">
                          {team.id === game.selectedTeamId && (
                            <Badge variant="outline" className="rounded-sm">
                              {t("league", "yourTeam")}
                            </Badge>
                          )}
                          {selected && (
                            <Badge variant="secondary" className="rounded-sm">
                              {t("league", "selectedTeam")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </AppTableCell>
                  <AppTableCell>
                    <p>
                      {team.conference === "East"
                        ? t("games", "east")
                        : team.conference === "West"
                          ? t("games", "west")
                          : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {team.division && team.division !== "Unknown" ? team.division : "—"}
                    </p>
                  </AppTableCell>
                  <AppTableCell className="text-right tabular-nums">
                    {standingsQuery.isPending ? (
                      <span>{t("common", "loading")}</span>
                    ) : record ? (
                      `${record.wins}–${record.losses}`
                    ) : (
                      "—"
                    )}
                  </AppTableCell>
                  {["rank", "overall", "payroll", "direction"].map((metric) => (
                    <AppTableCell
                      key={metric}
                      className={
                        metric === "direction"
                          ? "text-muted-foreground"
                          : "text-right text-muted-foreground"
                      }
                    >
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">{t("league", "directoryUnavailable")}</span>
                    </AppTableCell>
                  ))}
                  <AppTableCell className="text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-auto max-w-full whitespace-normal rounded-sm text-right"
                    >
                      <Link
                        href={franchiseHref(gameId, team.id, searchParams.toString())}
                        aria-label={`${t("league", "viewFranchise")} · ${team.name}`}
                      >
                        {t("league", "viewFranchise")}
                      </Link>
                    </Button>
                  </AppTableCell>
                </AppTableRow>
              );
            })}
            {!filteredTeams.length && (
              <AppTableRow>
                <AppTableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {teams.length ? t("dashboard", "noMatchingTeams") : t("league", "empty")}
                </AppTableCell>
              </AppTableRow>
            )}
          </tbody>
        </AppTable>
        <p className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          {t("league", "directoryLimitations")}
        </p>
      </Card>
    </div>
  );
}
