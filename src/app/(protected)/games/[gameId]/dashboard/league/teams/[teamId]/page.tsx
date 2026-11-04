"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { type ReactNode, use, useState } from "react";
import { display } from "@/app/ui-preview/fonts";
import { useGame } from "@/application/hooks/games/useGame";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useStandings } from "@/application/hooks/simulation/useStandings";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import { franchiseHref, playerProfileHref, teamsHref } from "@/components/league/navigation";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { RosterTableViews } from "@/components/roster/roster-table-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPlayerAge } from "@/domain/entities/Player";
import { formatSeasonLabel } from "@/domain/entities/Season";

const sections = ["overview", "roster", "finances", "frontOffice"] as const;

interface FranchisePanelProps {
  title: string;
  note?: string;
  children: ReactNode;
}

function FranchisePanel({ title, note, children }: FranchisePanelProps) {
  return (
    <Card className="min-w-0 gap-3 overflow-hidden rounded-md border-border/60 bg-card py-0 shadow-none">
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-2 px-[18px] pt-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </CardHeader>
      <CardContent className="space-y-4 px-[18px] pb-[18px] text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

interface FranchisePageProps {
  params: Promise<{ gameId: string; teamId: string }>;
}

export default function FranchisePage({ params }: FranchisePageProps) {
  const { gameId, teamId } = use(params);
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gameQuery = useGame(gameId);
  const teamsQuery = useTeams();
  const standingsQuery = useStandings(gameId);
  const game = gameQuery.data;
  const team = teamsQuery.data?.find((team) => team.id === teamId);
  const rosterQuery = useRoster(gameId, game && team ? team.id : null, game?.seasonYear);
  const [playerSearch, setPlayerSearch] = useState("");
  const tab =
    sections.find((section) => section === searchParams.get("franchiseTab")) ?? "overview";
  const returnQuery = searchParams.toString();
  const roster = !rosterQuery.isError && !rosterQuery.isLoading ? rosterQuery.data : undefined;
  const record =
    !standingsQuery.isError && !standingsQuery.isPending
      ? standingsQuery.data?.find((standing) => standing.teamId === teamId)
      : undefined;
  const ages = game && roster?.map(({ player }) => getPlayerAge(player, game.simulationDate));
  const averageAge =
    ages?.length && ages.every((age) => age !== undefined)
      ? ages.reduce((total, age) => total + age, 0) / ages.length
      : null;
  const overall =
    roster?.length && roster.every(({ ratings }) => ratings?.overall != null)
      ? roster.reduce((total, { ratings }) => total + (ratings?.overall ?? 0), 0) / roster.length
      : null;
  const estimated = roster?.some(({ ratings }) => ratings?.estimated);
  const cornerstone = roster
    ?.filter(({ ratings }) => ratings?.overall != null)
    .toSorted((a, b) => (b.ratings?.overall ?? 0) - (a.ratings?.overall ?? 0))[0];
  const filteredPlayers =
    roster?.filter(({ player }) =>
      player.fullName
        .toLocaleLowerCase(locale)
        .includes(playerSearch.trim().toLocaleLowerCase(locale))
    ) ?? [];
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const rosterParams = new URLSearchParams(returnQuery);
  rosterParams.set("franchiseTab", "roster");

  function changeTab(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("franchiseTab", value);
    window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
  }

  const backLink = (
    <Button asChild variant="outline" className="rounded-sm">
      <Link href={teamsHref(gameId, teamId, returnQuery)}>
        {searchParams.get("standingsReturn") === "1"
          ? t("standings", "back")
          : t("franchise", "backToTeams")}
      </Link>
    </Button>
  );
  if (gameQuery.isError || teamsQuery.isError)
    return (
      <div role="alert" className="space-y-3 py-8">
        <p className="text-destructive">{t("franchise", "loadFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void gameQuery.refetch();
            void teamsQuery.refetch();
          }}
        >
          {t("league", "retry")}
        </Button>
        {backLink}
      </div>
    );
  if (gameQuery.isLoading || teamsQuery.isLoading)
    return <output className="block py-12 text-muted-foreground">{t("common", "loading")}</output>;
  if (!game || !team)
    return (
      <div className="space-y-3 py-8">
        <p>{t("franchise", "notFound")}</p>
        {backLink}
      </div>
    );

  const rosterStatus = rosterQuery.isLoading ? (
    <output className="block py-8 text-muted-foreground">{t("common", "loading")}</output>
  ) : rosterQuery.isError ? (
    <div role="alert" className="space-y-3 py-8">
      <p className="text-destructive">{t("dashboard", "rosterLoadFailed")}</p>
      <Button variant="outline" onClick={() => void rosterQuery.refetch()}>
        {t("league", "retry")}
      </Button>
    </div>
  ) : !roster?.length ? (
    <p className="py-8 text-muted-foreground">{t("dashboard", "noPlayersRoster")}</p>
  ) : null;

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t("league", "title")} / {t("league", "teams")} / {team.abbreviation}
          </p>
          <h2
            className={`${display.className} break-words text-[32px] leading-none font-semibold uppercase tracking-wide sm:text-[38px]`}
          >
            {team.name}
          </h2>
          <p className="text-sm text-muted-foreground">{t("franchise", "description")}</p>
        </div>
        {backLink}
      </header>
      <section
        aria-label={t("franchise", "scouting")}
        className="flex min-w-0 flex-wrap items-center gap-4 rounded-md border border-primary/25 bg-primary/10 p-[18px] xl:gap-6 xl:px-6 xl:py-[22px]"
      >
        {team.logoUrl ? (
          <Image
            src={team.logoUrl}
            alt=""
            width={90}
            height={90}
            className="size-[65px] shrink-0 object-contain sm:size-[74px] xl:size-[90px]"
          />
        ) : (
          <span className={`${display.className} text-3xl font-semibold`}>{team.abbreviation}</span>
        )}
        <div className="min-w-0 flex-[1_1_180px] space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {team.conference === "East"
              ? t("games", "east")
              : team.conference === "West"
                ? t("games", "west")
                : "—"}{" "}
            / {team.division && team.division !== "Unknown" ? team.division : "—"}
          </p>
          <h3 className={`${display.className} text-[30px] leading-tight font-semibold`}>
            {game.selectedTeamId === team.id
              ? t("franchise", "managedIdentity")
              : t("franchise", "scouting")}
          </h3>
          <span className="inline-block rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
            {t("franchise", "directionUnavailable")}
          </span>
          <p className="text-xs text-muted-foreground">{t("league", "readOnly")}</p>
        </div>
        <div className="space-y-1 border-l border-primary/25 pl-4 xl:pl-6">
          <p className={`${display.className} text-[35px] leading-tight font-medium tabular-nums`}>
            {standingsQuery.isPending
              ? t("common", "loading")
              : record
                ? `${record.wins}–${record.losses}`
                : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSeasonLabel(game.seasonYear)} · {t("franchise", "record")}
          </p>
        </div>
        <div className="space-y-1 border-l border-primary/25 pl-4 xl:pl-6">
          <p className={`${display.className} text-[35px] leading-tight font-medium tabular-nums`}>
            {overall == null ? "—" : number.format(overall)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("franchise", "overall")}
            {overall != null && estimated ? " *" : ""}
          </p>
          {overall != null && estimated && (
            <p className="text-xs text-muted-foreground">{t("playerAttributes", "estimated")}</p>
          )}
        </div>
      </section>
      {standingsQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-destructive">{t("dashboard", "standingsFailed")}</p>
          <Button variant="outline" onClick={() => void standingsQuery.refetch()}>
            {t("league", "retry")}
          </Button>
        </div>
      )}
      <Tabs.Root value={tab} onValueChange={changeTab} className="min-w-0 space-y-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <Tabs.List
            aria-label={t("franchise", "navigation")}
            className="flex max-w-full flex-wrap gap-1 rounded-sm border border-border bg-muted/30 p-1"
          >
            {sections.map((section) => (
              <Tabs.Trigger
                key={section}
                value={section}
                className="rounded-sm px-3 py-2 text-sm text-muted-foreground outline-none data-[state=active]:bg-primary/15 data-[state=active]:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
              >
                {section === "overview"
                  ? t("league", "overview")
                  : section === "frontOffice"
                    ? t("franchise", "frontOffice")
                    : t("dashboard", section)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Button asChild variant="ghost" size="sm" className="rounded-sm">
            <Link href={franchiseHref(gameId, team.id, rosterParams.toString())}>
              {t("franchise", "viewRoster")} →
            </Link>
          </Button>
        </div>
        <Tabs.Content
          value="overview"
          className="min-w-0 space-y-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rosterStatus}
          <div className="grid min-w-0 items-start gap-[18px] min-[1100px]:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <FranchisePanel
                title={t("franchise", "snapshot")}
                note={formatSeasonLabel(game.seasonYear)}
              >
                <dl className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("franchise", "record")}</dt>
                    <dd className={`${display.className} mt-1 text-3xl tabular-nums`}>
                      {record ? `${record.wins}–${record.losses}` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("franchise", "rosterSize")}
                    </dt>
                    <dd className={`${display.className} text-3xl tabular-nums`}>
                      {roster?.length ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("franchise", "averageAge")}
                    </dt>
                    <dd className={`${display.className} text-3xl tabular-nums`}>
                      {averageAge == null ? "—" : number.format(averageAge)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("franchise", "overall")}</dt>
                    <dd className={`${display.className} text-3xl tabular-nums`}>
                      {overall == null ? "—" : number.format(overall)}
                    </dd>
                    {overall != null && estimated && (
                      <Badge variant="outline">{t("playerAttributes", "estimated")}</Badge>
                    )}
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">{t("franchise", "averagesHelp")}</p>
              </FranchisePanel>
              <FranchisePanel
                title={t("franchise", "teamScouting")}
                note={t("franchise", "unavailable")}
              >
                <div className="grid gap-x-[18px] gap-y-3 sm:grid-cols-2">
                  {(
                    ["offense", "defense", "shooting", "playmaking", "interior", "depth"] as const
                  ).map((area) => (
                    <div
                      key={area}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border/60 pt-3"
                    >
                      <span className="font-medium">{t("franchise", area)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("franchise", "unavailable")}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground">{t("franchise", "scoutingUnavailable")}</p>
              </FranchisePanel>
            </div>
            <div className="min-w-0 space-y-4">
              <FranchisePanel title={t("franchise", "cornerstone")}>
                {cornerstone ? (
                  <>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-[18px] sm:grid-cols-[145px_minmax(0,1fr)]">
                      <div className="aspect-[1.1] overflow-hidden rounded-sm bg-primary/10">
                        <PlayerHeadshot
                          src={cornerstone.player.headshotUrl}
                          alt=""
                          className="size-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Link
                          className={`${display.className} block break-words text-[29px] leading-tight font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary`}
                          href={playerProfileHref(
                            gameId,
                            cornerstone.player.id,
                            team.id,
                            returnQuery
                          )}
                        >
                          {cornerstone.player.fullName}
                        </Link>
                        <p className="text-muted-foreground">
                          {cornerstone.player.position ?? "—"} · {t("playerAttributes", "overall")}:{" "}
                          {cornerstone.ratings?.overall}
                        </p>
                        {cornerstone.ratings?.estimated && (
                          <Badge variant="outline">{t("playerAttributes", "estimated")}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
                      {t("franchise", "cornerstoneHelp")}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {rosterQuery.isLoading
                      ? t("common", "loading")
                      : t("franchise", "ratingsUnavailable")}
                  </p>
                )}
              </FranchisePanel>
              <FranchisePanel
                title={t("franchise", "outlook")}
                note={t("franchise", "unavailable")}
              >
                <p className="text-muted-foreground">{t("franchise", "outlookUnavailable")}</p>
              </FranchisePanel>
            </div>
          </div>
        </Tabs.Content>
        <Tabs.Content
          value="roster"
          className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="min-w-0 gap-4 overflow-hidden rounded-md border-border/60 py-4 shadow-none [&_[data-slot=button]]:rounded-sm [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-x-0 [&_[data-slot=table-container]]:border-b-0">
            <CardHeader className="border-b border-border/60 pb-4">
              <h3 className="text-sm font-semibold">{t("dashboard", "roster")}</h3>
              <p className="text-xs text-muted-foreground">{t("league", "readOnly")}</p>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 p-0">
              <div className="px-4">
                <Input
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder={t("dashboard", "rosterSearch")}
                  aria-label={t("dashboard", "rosterSearch")}
                  className="rounded-sm"
                />
                {rosterStatus}
              </div>
              {!rosterStatus &&
                (filteredPlayers.length ? (
                  <RosterTableViews
                    gameId={gameId}
                    players={filteredPlayers}
                    seasonYear={game.seasonYear}
                    leagueTeamId={team.id}
                    leagueReturnQuery={returnQuery}
                    canRelease={false}
                  />
                ) : (
                  <p className="px-4 py-8 text-muted-foreground">{t("league", "noPlayersMatch")}</p>
                ))}
            </CardContent>
          </Card>
        </Tabs.Content>
        <Tabs.Content
          value="finances"
          className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="grid min-w-0 items-start gap-[18px] min-[1100px]:grid-cols-2">
            <CapSpaceWidget
              gameId={gameId}
              teamId={team.id}
              rosterHref={franchiseHref(gameId, team.id, rosterParams.toString())}
            />
            <FranchisePanel title={t("franchise", "financialOutlook")}>
              <p className="text-muted-foreground">
                {t("franchise", "financialOutlookUnavailable")}
              </p>
            </FranchisePanel>
          </div>
        </Tabs.Content>
        <Tabs.Content
          value="frontOffice"
          className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="grid min-w-0 items-start gap-[18px] min-[1100px]:grid-cols-2">
            <FranchisePanel title={t("franchise", "management")}>
              <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                <span
                  aria-hidden="true"
                  className={`${display.className} flex size-11 shrink-0 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-2xl text-primary`}
                >
                  GM
                </span>
                <span className="font-semibold">
                  {game.selectedTeamId === team.id
                    ? t("franchise", "managedIdentity")
                    : t("franchise", "unavailable")}
                </span>
              </div>
              <p className="text-muted-foreground">
                {game.selectedTeamId === team.id
                  ? t("franchise", "yourFranchise")
                  : t("franchise", "managementUnavailable")}
              </p>
            </FranchisePanel>
            <FranchisePanel title={t("franchise", "history")}>
              <p className="text-muted-foreground">{t("franchise", "historyUnavailable")}</p>
            </FranchisePanel>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
