"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { display } from "@/app/ui-preview/fonts";
import { useGame } from "@/application/hooks/games/useGame";
import { useGamePlayers } from "@/application/hooks/players/useGamePlayers";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  directoryPlayerHref,
  parsePlayersFilters,
  playersHref,
} from "@/components/league/players-navigation";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import {
  formatRosterSalary,
  getRosterContractClassification,
} from "@/components/roster/roster-table";
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
import { POSITION } from "@/domain/entities/Player";
import { formatSeasonLabel } from "@/domain/entities/Season";

interface PlayersPageProps {
  params: Promise<{ gameId: string }>;
}

export default function PlayersPage({ params }: PlayersPageProps) {
  const { gameId } = use(params);
  const t = useT();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const filters = parsePlayersFilters(searchParams.toString());
  const gameQuery = useGame(gameId);
  const teamsQuery = useTeams();
  const playersQuery = useGamePlayers(gameId, gameQuery.data?.seasonYear);
  const teams = teamsQuery.data ?? [];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const teamId = teamById.has(filters.teamId) || filters.teamId === "free" ? filters.teamId : "all";
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const rows = (playersQuery.data ?? [])
    .filter(
      ({ player }) =>
        (teamId === "all" ||
          (teamId === "free" ? player.isActive && !player.teamId : player.teamId === teamId)) &&
        (filters.position === "all" || player.position === filters.position) &&
        (filters.status === "all" || player.isActive === (filters.status === "active")) &&
        player.fullName
          .toLocaleLowerCase(locale)
          .includes(filters.q.trim().toLocaleLowerCase(locale))
    )
    .sort((a, b) => {
      if (filters.sort === "overall") {
        const left = a.ratings?.overall;
        const right = b.ratings?.overall;
        const difference =
          left == null || right == null
            ? Number(left == null) - Number(right == null)
            : right - left;
        if (difference) return difference;
      }
      return collator.compare(a.player.fullName, b.player.fullName);
    });
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(filters.page, pages);
  const shown = rows.slice((page - 1) * 20, page * 20);
  const selected = rows.find(({ player }) => player.id === filters.selected) ?? shown[0];
  const context = new URLSearchParams({
    ...filters,
    teamId,
    page: String(page),
    selected: selected?.player.id ?? "",
  });

  function update(values: Record<string, string>) {
    const query = new URLSearchParams(context);
    query.set("page", "1");
    for (const [key, value] of Object.entries(values)) query.set(key, value);
    window.history.replaceState(null, "", playersHref(gameId, query.toString()));
  }

  function teamLabel(player: NonNullable<typeof selected>["player"]) {
    if (!player.isActive) return t("playersDirectory", "inactive");
    return player.teamId
      ? (teamById.get(player.teamId)?.name ?? t("profile", "unknown"))
      : t("playersDirectory", "free");
  }

  if (
    gameQuery.isError ||
    teamsQuery.isError ||
    playersQuery.isError ||
    (!gameQuery.isLoading && !gameQuery.data)
  )
    return (
      <div role="alert" className="space-y-3 py-8">
        <p>{t("playersDirectory", "error")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void gameQuery.refetch();
            void teamsQuery.refetch();
            void playersQuery.refetch();
          }}
        >
          {t("league", "retry")}
        </Button>
      </div>
    );
  if (gameQuery.isLoading || teamsQuery.isLoading || playersQuery.isLoading || !gameQuery.data)
    return <output className="block py-12 text-muted-foreground">{t("common", "loading")}</output>;

  const classification = selected ? getRosterContractClassification(selected, locale) : null;
  const game = gameQuery.data;
  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("league", "title")} / {t("league", "players")}
          </p>
          <h2 className={`${display.className} text-[34px] leading-none font-semibold uppercase`}>
            {t("playersDirectory", "title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("playersDirectory", "description")}</p>
        </div>
        <span className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted-foreground">
          {formatSeasonLabel(gameQuery.data.seasonYear)} · NBA
        </span>
      </header>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("playersDirectory", "coverage")}
      </p>
      <div className="grid min-w-0 items-start gap-[18px] xl:grid-cols-[minmax(0,72fr)_minmax(260px,28fr)]">
        <Card className="min-w-0 gap-0 overflow-hidden rounded-md py-0 shadow-none [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0">
          <h3 className={`${display.className} p-4 text-lg font-semibold`}>
            {t("playersDirectory", "database")}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.length} {t("playersDirectory", "results")}
            </span>
          </h3>
          <search
            aria-label={t("playersDirectory", "database")}
            className="grid gap-3 border-b border-border/60 px-4 pb-4 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <label htmlFor="players-search" className="text-xs text-muted-foreground">
                {t("playersDirectory", "search")}
              </label>
              <Input
                id="players-search"
                type="search"
                maxLength={120}
                value={filters.q}
                onChange={(event) => update({ q: event.target.value, selected: "" })}
              />
            </div>
            {[
              {
                key: "teamId",
                label: t("playersDirectory", "team"),
                value: teamId,
                options: [
                  ["all", t("playersDirectory", "allTeams")],
                  ["free", t("playersDirectory", "free")],
                  ...teams.map((team) => [team.id, team.name]),
                ],
              },
              {
                key: "position",
                label: t("playersDirectory", "position"),
                value: filters.position,
                options: [
                  ["all", t("playersDirectory", "all")],
                  ...Object.values(POSITION).map((value) => [value, value]),
                ],
              },
              {
                key: "status",
                label: t("playersDirectory", "status"),
                value: filters.status,
                options: [
                  ["all", t("playersDirectory", "all")],
                  ["active", t("playersDirectory", "active")],
                  ["inactive", t("playersDirectory", "inactive")],
                ],
              },
              {
                key: "sort",
                label: t("league", "sortBy"),
                value: filters.sort,
                options: [
                  ["name", t("playersDirectory", "name")],
                  ["overall", t("league", "directoryOverall")],
                ],
              },
            ].map((field) => (
              <div className="min-w-0 space-y-1" key={field.key}>
                <label htmlFor={`players-${field.key}`} className="text-xs text-muted-foreground">
                  {field.label}
                </label>
                <Select
                  value={field.value}
                  onValueChange={(value) => update({ [field.key]: value, selected: "" })}
                >
                  <SelectTrigger id={`players-${field.key}`} className="w-full min-w-0">
                    <SelectValue className="truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button
              variant="ghost"
              onClick={() => window.history.replaceState(null, "", playersHref(gameId))}
            >
              {t("league", "clear")}
            </Button>
          </search>
          <AppTable
            className="min-w-[650px] text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wide"
            aria-label={t("playersDirectory", "database")}
          >
            <AppTableHeader>
              <AppTableRow>
                {[
                  t("playersDirectory", "name"),
                  t("playersDirectory", "team"),
                  t("playersDirectory", "position"),
                  t("league", "directoryOverall"),
                  t("playersDirectory", "salary"),
                ].map((label) => (
                  <AppTableHead key={label}>{label}</AppTableHead>
                ))}
              </AppTableRow>
            </AppTableHeader>
            <tbody>
              {shown.map((row) => (
                <AppTableRow
                  key={row.player.id}
                  className={`cursor-pointer ${selected?.player.id === row.player.id ? "bg-primary/10" : ""}`}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("button")) return;
                    update({ selected: row.player.id, page: String(page) });
                  }}
                >
                  <AppTableCell>
                    <div className="flex items-center gap-2">
                      <PlayerHeadshot
                        src={row.player.headshotUrl}
                        alt=""
                        className="h-9 w-9 object-contain"
                      />
                      <div>
                        <button
                          type="button"
                          className="font-semibold text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          aria-pressed={selected?.player.id === row.player.id}
                          onClick={() => update({ selected: row.player.id, page: String(page) })}
                        >
                          {row.player.fullName}
                        </button>
                        {row.player.teamId === game.selectedTeamId && (
                          <span className="block text-xs text-primary">
                            {t("league", "yourTeam")}
                          </span>
                        )}
                      </div>
                    </div>
                  </AppTableCell>
                  <AppTableCell>{teamLabel(row.player)}</AppTableCell>
                  <AppTableCell>{row.player.position ?? "—"}</AppTableCell>
                  <AppTableCell className="font-mono">
                    {row.ratings?.overall ?? "—"}
                    {row.ratings?.estimated && (
                      <span className="block text-xs text-muted-foreground">
                        {t("playerAttributes", "estimated")}
                      </span>
                    )}
                  </AppTableCell>
                  <AppTableCell className="font-mono">
                    {formatRosterSalary(row.contract?.salaryY1, locale)}
                    {row.gameContract?.estimated && (
                      <span
                        className="block text-xs text-muted-foreground"
                        title={getRosterContractClassification(row, locale).title}
                      >
                        {getRosterContractClassification(row, locale).label}
                      </span>
                    )}
                  </AppTableCell>
                </AppTableRow>
              ))}
            </tbody>
          </AppTable>
          {!rows.length && (
            <output className="block p-8 text-center text-sm text-muted-foreground">
              {t("playersDirectory", "empty")}
            </output>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 p-4 text-xs text-muted-foreground">
            <output>
              {t("playersDirectory", "page")} {page} / {pages} · {rows.length}{" "}
              {t("playersDirectory", "results")}
            </output>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => update({ page: String(page - 1), selected: "" })}
              >
                {t("playersDirectory", "previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pages}
                onClick={() => update({ page: String(page + 1), selected: "" })}
              >
                {t("playersDirectory", "next")}
              </Button>
            </div>
          </div>
        </Card>
        {selected && (
          <aside
            aria-label={t("playersDirectory", "inspector")}
            className="min-w-0 overflow-hidden rounded-md border border-border bg-card xl:sticky xl:top-4"
          >
            <h3 className="border-b border-border/60 p-4 text-xs uppercase tracking-widest text-muted-foreground">
              {t("playersDirectory", "inspector")}
            </h3>
            <div className="bg-primary/10 px-8 pt-5">
              <PlayerHeadshot
                src={selected.player.headshotUrl}
                alt={selected.player.fullName}
                className="aspect-[1040/760] w-full object-contain object-bottom"
              />
            </div>
            <div className="space-y-4 p-4">
              <p className="text-xs text-primary">{teamLabel(selected.player)}</p>
              <h4 className={`${display.className} text-3xl font-semibold`}>
                {selected.player.fullName}
              </h4>
              <p className="text-sm text-muted-foreground">
                {selected.player.position ?? "—"} · {selected.player.height ?? "—"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">OVR {selected.ratings?.overall ?? "—"}</Badge>
                {selected.ratings?.estimated && (
                  <Badge variant="outline">{t("playerAttributes", "estimated")}</Badge>
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("playersDirectory", "salary")}</dt>
                  <dd>{formatRosterSalary(selected.contract?.salaryY1, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("profile", "contract")}</dt>
                  <dd title={classification?.title}>{classification?.label}</dd>
                </div>
              </dl>
              <Button asChild className="w-full">
                <Link href={directoryPlayerHref(gameId, selected.player.id, context.toString())}>
                  {t("playersDirectory", "profile")}
                </Link>
              </Button>
            </div>
          </aside>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("playersDirectory", "limits")}
      </p>
    </div>
  );
}
