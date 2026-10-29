"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { use } from "react";
import { display } from "@/app/ui-preview/fonts";
import {
  selectConferenceStandings,
  selectLeagueStandings,
} from "@/application/dashboard/selectConferenceStandings";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatSeasonLabel } from "@/domain/entities/Season";

const columns = ["rank", "team", "wins", "losses", "percentage", "behind"] as const;

export default function StandingsPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const t = useT();
  const locale = useLocale();
  const search = useSearchParams();
  const pathname = usePathname();
  const gameQuery = useGame(gameId);
  const teamsQuery = useTeams();
  const standingsQuery = useStandings(gameId);
  const teams = teamsQuery.data ?? [];
  const standings = standingsQuery.data ?? [];
  const game = gameQuery.data;
  const selected =
    teams.find((team) => team.id === search.get("teamId")) ??
    teams.find((team) => team.id === game?.selectedTeamId) ??
    teams[0];
  const conference =
    ["East", "West"].find((value) => value === search.get("stConference")) ?? "Both";
  const view =
    ["conference", "division", "overall"].find((value) => value === search.get("stView")) ??
    "conference";
  const sort = columns.find((value) => value === search.get("stSort")) ?? "rank";
  const descending = search.get("stDirection") === "desc";
  const visible = teams.filter(
    (team) => view === "overall" || conference === "Both" || team.conference === conference
  );
  const groupKey = (team: (typeof teams)[number]) =>
    view === "overall"
      ? t("standings", "overall")
      : ((view === "division" ? team.division : team.conference) ?? "—");
  const groups = [...new Set(visible.map(groupKey))];
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const records = new Map(standings.map((row) => [row.teamId, row]));
  const selectedRecord = selected && records.get(selected.id);
  const conferenceRows = selected ? selectConferenceStandings(standings, teams, selected.id) : [];
  const conferenceIndex = conferenceRows.findIndex((row) => row.teamId === selected?.id);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    window.history.replaceState(null, "", `${pathname}?${next}`);
  }
  function percentage(record: typeof selectedRecord) {
    return record && record.wins + record.losses > 0
      ? pct.format(record.wins / (record.wins + record.losses))
      : "—";
  }
  const failed = gameQuery.isError || teamsQuery.isError || standingsQuery.isError;
  if (failed)
    return (
      <div role="alert" className="space-y-3 py-8">
        <p>{t("dashboard", "standingsFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void gameQuery.refetch();
            void teamsQuery.refetch();
            void standingsQuery.refetch();
          }}
        >
          {t("league", "retry")}
        </Button>
      </div>
    );
  if (gameQuery.isLoading || teamsQuery.isLoading || standingsQuery.isPending)
    return <output className="block py-12">{t("common", "loading")}</output>;
  if (!game || !teams.length) return <p className="py-12">{t("league", "empty")}</p>;
  const profileQuery = new URLSearchParams(search.toString());
  profileQuery.set("standingsReturn", "1");
  return (
    <div className="min-w-0 space-y-5">
      <header>
        <h2 className={`${display.className} text-3xl font-semibold`}>
          {t("league", "standings")}
        </h2>
        <p className="text-sm text-muted-foreground">{formatSeasonLabel(game.seasonYear)}</p>
      </header>
      <div className="flex min-w-0 flex-wrap gap-4">
        <div className="space-y-2">
          <label htmlFor="st-conference">{t("league", "conference")}</label>
          <Select
            value={view === "overall" ? "Both" : conference}
            disabled={view === "overall"}
            onValueChange={(value) => update({ stConference: value })}
          >
            <SelectTrigger id="st-conference">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Both">{t("league", "allConferences")}</SelectItem>
              <SelectItem value="East">{t("games", "east")}</SelectItem>
              <SelectItem value="West">{t("games", "west")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="st-view">{t("standings", "view")}</label>
          <Select value={view} onValueChange={(value) => update({ stView: value })}>
            <SelectTrigger id="st-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["conference", "division", "overall"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "overall"
                    ? t("standings", "overall")
                    : t("league", value === "conference" ? "conference" : "division")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("dashboard", "standingsOrderHelp")} {t("standings", "missing")}
      </p>
      {!standings.length && <p>{t("dashboard", "standingsUnavailable")}</p>}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {groups.map((group) => {
            const groupTeams = visible.filter((team) => groupKey(team) === group);
            const ordered = selectLeagueStandings(standings, groupTeams);
            const ranks = new Map(ordered.map((row, index) => [row.teamId, index + 1]));
            const leader = ordered[0];
            const behind = (id: string) => {
              const record = records.get(id);
              return record && leader
                ? (leader.wins - record.wins + record.losses - leader.losses) / 2
                : undefined;
            };
            const rows = [...groupTeams].sort((a, b) => {
              if (sort === "team")
                return a.name.localeCompare(b.name, locale) * (descending ? -1 : 1);
              const ar = records.get(a.id);
              const br = records.get(b.id);
              if (!ar || !br)
                return (
                  Number(!ar) - Number(!br) || a.abbreviation.localeCompare(b.abbreviation, "en")
                );
              const value = (team: typeof a, record: typeof ar) =>
                sort === "rank"
                  ? (ranks.get(team.id) ?? 0)
                  : sort === "wins"
                    ? record.wins
                    : sort === "losses"
                      ? record.losses
                      : sort === "percentage"
                        ? record.wins / (record.wins + record.losses || 1)
                        : (behind(team.id) ?? 0);
              const difference = value(a, ar) - value(b, br);
              return (
                difference * (descending ? -1 : 1) ||
                (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)
              );
            });
            const title =
              group === "East" ? t("games", "east") : group === "West" ? t("games", "west") : group;
            return (
              <Card
                key={group}
                className="min-w-0 gap-3 overflow-hidden rounded-md py-4 shadow-none"
              >
                <h3 className={`${display.className} px-4 text-xl font-semibold`}>{title}</h3>
                <AppTable className="min-w-[520px]">
                  <caption className="sr-only">
                    {title} · {t("league", "standings")}
                  </caption>
                  <AppTableHeader>
                    <AppTableRow>
                      {columns.map((column, index) => (
                        <AppTableHead
                          key={column}
                          aria-sort={
                            sort === column ? (descending ? "descending" : "ascending") : "none"
                          }
                        >
                          <button
                            type="button"
                            className="rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
                            aria-label={
                              column === "team" ? t("league", "franchise") : t("standings", column)
                            }
                            onClick={() =>
                              update({
                                stSort: column,
                                stDirection:
                                  sort === column
                                    ? descending
                                      ? "asc"
                                      : "desc"
                                    : column === "wins" || column === "percentage"
                                      ? "desc"
                                      : "asc",
                              })
                            }
                          >
                            {["RK", t("league", "franchise"), "W", "L", "PCT", "GB"][index]}
                            {sort === column ? (descending ? " ↓" : " ↑") : ""}
                          </button>
                        </AppTableHead>
                      ))}
                    </AppTableRow>
                  </AppTableHeader>
                  <tbody>
                    {rows.map((team) => {
                      const record = records.get(team.id);
                      const gb = behind(team.id);
                      return (
                        <AppTableRow
                          key={team.id}
                          data-state={selected?.id === team.id ? "selected" : undefined}
                          className={
                            team.id === game.selectedTeamId ? "border-l-4 border-l-primary" : ""
                          }
                        >
                          <AppTableCell>{ranks.get(team.id) ?? "—"}</AppTableCell>
                          <AppTableCell>
                            <button
                              type="button"
                              aria-pressed={selected?.id === team.id}
                              className="text-left font-semibold focus-visible:outline-2 focus-visible:outline-primary"
                              onClick={() => update({ teamId: team.id })}
                            >
                              {team.name}
                            </button>
                            <div className="flex flex-wrap gap-1">
                              {team.id === game.selectedTeamId && (
                                <Badge variant="outline">{t("league", "yourTeam")}</Badge>
                              )}
                              {team.id === selected?.id && (
                                <Badge variant="secondary">{t("league", "selectedTeam")}</Badge>
                              )}
                            </div>
                          </AppTableCell>
                          <AppTableCell>{record?.wins ?? "—"}</AppTableCell>
                          <AppTableCell>{record?.losses ?? "—"}</AppTableCell>
                          <AppTableCell>{percentage(record)}</AppTableCell>
                          <AppTableCell>
                            {gb === undefined || gb === 0 ? "—" : number.format(gb)}
                          </AppTableCell>
                        </AppTableRow>
                      );
                    })}
                  </tbody>
                </AppTable>
              </Card>
            );
          })}
          {!groups.length && <p>{t("dashboard", "noMatchingTeams")}</p>}
        </div>
        {selected && (
          <Card className="min-w-0 rounded-md shadow-none">
            <CardContent className="space-y-5">
              <p className="text-xs text-muted-foreground">{t("standings", "inspector")}</p>
              {selected.logoUrl && (
                <Image
                  src={selected.logoUrl}
                  width={88}
                  height={88}
                  alt=""
                  className="size-20 object-contain"
                />
              )}
              <h3 className={`${display.className} break-words text-2xl font-semibold`}>
                {selected.name}
              </h3>
              <p className="text-sm">
                {selected.conference === "East"
                  ? t("games", "east")
                  : selected.conference === "West"
                    ? t("games", "west")
                    : "—"}{" "}
                / {selected.division && selected.division !== "Unknown" ? selected.division : "—"}
              </p>
              {!visible.some((team) => team.id === selected.id) && (
                <p className="text-sm text-muted-foreground">{t("standings", "outside")}</p>
              )}
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt>{t("dashboard", "record")}</dt>
                  <dd className="text-xl tabular-nums">
                    {selectedRecord ? `${selectedRecord.wins}–${selectedRecord.losses}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{t("standings", "conferenceRank")}</dt>
                  <dd className="text-xl tabular-nums">
                    {conferenceIndex < 0
                      ? "—"
                      : `${conferenceIndex + 1} / ${conferenceRows.length}`}
                  </dd>
                </div>
                <div>
                  <dt>{t("standings", "percentage")}</dt>
                  <dd className="text-xl tabular-nums">{percentage(selectedRecord)}</dd>
                </div>
              </dl>
              <Button asChild variant="outline">
                <Link href={franchiseHref(gameId, selected.id, profileQuery.toString())}>
                  {t("league", "viewFranchise")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
