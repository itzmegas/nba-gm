"use client";

import { Activity, AlertTriangle, ArrowLeft, DollarSign, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { use } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useContractsByPlayer } from "@/application/hooks/contracts/useContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { usePlayer } from "@/application/hooks/players/usePlayers";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useT } from "@/application/providers/I18nProvider";
import { franchiseHref } from "@/components/league/navigation";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatSalarySeasonLabel,
  getYearsRemaining,
  isCurrentSalarySeason,
} from "@/domain/entities/Season";

function formatSalary(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface GamePlayerDetailPageProps {
  params: Promise<{ gameId: string; id: string }>;
}

export default function GamePlayerDetailPage({ params }: GamePlayerDetailPageProps) {
  const t = useT();
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;
  const playerId = resolvedParams.id;
  const searchParams = useSearchParams();

  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const { data: player, isLoading: isLoadingPlayer } = usePlayer(playerId);
  const { data: contract, isLoading: isLoadingContract } = useContractsByPlayer(gameId, playerId);
  const { data: teams, isLoading: isLoadingTeams } = useTeams();
  const leagueTeamId = searchParams.get("leagueTeamId");
  const validLeagueTeamId =
    leagueTeamId && teams?.some((team) => team.id === leagueTeamId) ? leagueTeamId : null;
  const backHref = validLeagueTeamId
    ? franchiseHref(gameId, validLeagueTeamId, searchParams.get("leagueReturnQuery") ?? "")
    : `/games/${gameId}/dashboard/roster`;
  const backLabel = validLeagueTeamId ? t("profile", "backFranchise") : t("profile", "backRoster");

  if (isLoadingGame || isLoadingPlayer || isLoadingContract || isLoadingTeams) {
    return (
      <output aria-label={t("profile", "loading")} className="flex flex-col gap-5 animate-pulse">
        <span className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-md bg-muted" />
          <span className="h-8 w-48 bg-muted rounded-md" />
        </span>
        <span className="h-28 bg-muted rounded-md" />
        <span className="h-48 bg-muted rounded-md" />
      </output>
    );
  }

  if (!game || !player) {
    return (
      <div
        className={`${body.className} flex min-h-[50vh] flex-col items-center justify-center gap-4`}
      >
        <UserIcon className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-xl font-medium text-muted-foreground">{t("profile", "notFound")}</p>
        <Button asChild variant="outline" className="rounded-sm">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    );
  }

  const yearsLeft = contract ? getYearsRemaining(game.seasonYear, contract.endYear) : 0;

  return (
    <div className={`${body.className} min-w-0 space-y-5`}>
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("profile", "context")}
        </p>
        <h2 className={`${display.className} text-4xl font-semibold uppercase`}>
          {t("profile", "title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("profile", "description")}</p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 gap-2 rounded-sm text-muted-foreground"
        >
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("profile", "readOnly")}
        </span>
      </div>

      <section
        aria-label={t("profile", "identity")}
        className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] items-center gap-4 rounded-md border border-primary/30 bg-primary/10 p-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-6 sm:px-6 sm:py-[18px]"
      >
        <div className="aspect-[1040/760] min-w-0 overflow-hidden">
          <PlayerHeadshot
            src={player.headshotUrl}
            alt={player.fullName}
            className="h-full w-full object-contain object-bottom"
            loading="eager"
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
            </span>
            <h1
              className={`${display.className} min-w-0 break-words text-[31px] leading-none font-semibold tracking-tight sm:text-[43px]`}
            >
              {player.fullName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 [&_[data-slot=badge]]:rounded-sm">
            <Badge variant="secondary">{player.position ?? t("profile", "noPosition")}</Badge>
            <Badge variant="outline">
              {player.height ? `${player.height}` : t("profile", "noHeight")}
            </Badge>
            <Badge variant="outline">
              {player.weight ? `${player.weight} lbs` : t("profile", "noWeight")}
            </Badge>
            {!player.isActive && <Badge variant="destructive">{t("profile", "inactive")}</Badge>}
          </div>
          {contract && (
            <p className="text-sm text-muted-foreground">
              {`${contract.startYear}–${contract.endYear} · ${yearsLeft} ${yearsLeft === 1 ? t("profile", "year") : t("profile", "years")}`}
            </p>
          )}
        </div>
      </section>

      <Tabs.Root defaultValue="contract" className="min-w-0 space-y-[18px]">
        <Tabs.List
          aria-label={t("profile", "sections")}
          className="flex w-fit max-w-full flex-wrap gap-1 rounded-sm border border-border bg-muted/30 p-1"
        >
          {["biography", "contract"].map((section) => (
            <Tabs.Trigger
              key={section}
              value={section}
              className="min-h-10 rounded-sm px-4 text-sm text-muted-foreground outline-none data-[state=active]:bg-primary/15 data-[state=active]:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {section === "biography" ? t("profile", "biography") : t("profile", "contract")}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="grid min-w-0 items-start gap-[18px] xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="min-w-0">
            <Tabs.Content
              value="biography"
              className="rounded-md border border-border bg-card p-[18px] focus-visible:outline-2 focus-visible:outline-ring"
            >
              <h2 className={`${display.className} mb-4 text-lg font-semibold`}>
                {t("profile", "biography")}
              </h2>
              <dl className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("profile", "position")}</dt>
                  <dd>{player.position ?? t("profile", "unknown")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("profile", "number")}</dt>
                  <dd>{player.jerseyNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("profile", "height")}</dt>
                  <dd>{player.height ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("profile", "weight")}</dt>
                  <dd>{player.weight ? `${player.weight} lbs` : "—"}</dd>
                </div>
              </dl>
            </Tabs.Content>
            <Tabs.Content
              value="contract"
              className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Card className="min-w-0 gap-4 rounded-md border-border bg-card py-[18px] shadow-none [&_[data-slot=table-container]]:rounded-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle
                    className={`${display.className} flex items-center gap-2 text-lg font-semibold`}
                  >
                    <DollarSign className="size-4 text-primary" />
                    {t("profile", "contract")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  {contract ? (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {t("profile", "duration")}
                          </dt>
                          <dd className={`${display.className} text-xl font-semibold tabular-nums`}>
                            {yearsLeft}{" "}
                            {yearsLeft === 1 ? t("profile", "year") : t("profile", "years")}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">{t("profile", "term")}</dt>
                          <dd className={`${display.className} text-xl font-semibold tabular-nums`}>
                            {contract.startYear} - {contract.endYear}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {t("profile", "guaranteed")}
                          </dt>
                          <dd className="font-semibold">
                            {contract.isGuaranteed == null
                              ? t("profile", "unknown")
                              : contract.isGuaranteed
                                ? t("profile", "yes")
                                : t("profile", "no")}
                          </dd>
                        </div>
                        <div className="space-y-1">
                          <dt className="text-xs text-muted-foreground">
                            {t("profile", "options")}
                          </dt>
                          <dd className="font-semibold">
                            {contract.isPlayerOption
                              ? "Player"
                              : contract.isTeamOption
                                ? "Team"
                                : t("profile", "none")}
                          </dd>
                        </div>
                      </dl>

                      <AppTable aria-label={t("profile", "salaries")}>
                        <AppTableHeader>
                          <AppTableRow>
                            <AppTableHead>{t("profile", "season")}</AppTableHead>
                            <AppTableHead className="text-right">
                              {t("profile", "baseSalary")}
                            </AppTableHead>
                          </AppTableRow>
                        </AppTableHeader>
                        <tbody className="tabular-nums">
                          {[
                            { year: contract.startYear, salary: contract.salaryY1 },
                            { year: contract.startYear + 1, salary: contract.salaryY2 },
                            { year: contract.startYear + 2, salary: contract.salaryY3 },
                            { year: contract.startYear + 3, salary: contract.salaryY4 },
                            { year: contract.startYear + 4, salary: contract.salaryY5 },
                          ]
                            .filter(
                              (yearSalary) =>
                                yearSalary.salary !== undefined &&
                                yearSalary.salary !== null &&
                                yearSalary.year <= contract.endYear
                            )
                            .map((yearSalary) => {
                              const isCurrentSeason = isCurrentSalarySeason(
                                game.seasonYear,
                                yearSalary.year
                              );

                              return (
                                <AppTableRow
                                  key={yearSalary.year}
                                  data-state={isCurrentSeason ? "selected" : undefined}
                                >
                                  <AppTableCell className="whitespace-nowrap font-medium">
                                    {formatSalarySeasonLabel(yearSalary.year)}
                                    {isCurrentSeason && (
                                      <span className="ml-2 text-xs text-primary">
                                        {t("profile", "current")}
                                      </span>
                                    )}
                                  </AppTableCell>
                                  <AppTableCell className="whitespace-nowrap text-right font-mono">
                                    {formatSalary(yearSalary.salary)}
                                  </AppTableCell>
                                </AppTableRow>
                              );
                            })}
                        </tbody>
                      </AppTable>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                      <p>{t("profile", "noContract")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Tabs.Content>
          </div>

          <aside
            aria-label={t("profile", "scouting")}
            className="space-y-2 rounded-md border border-border bg-card p-[18px]"
          >
            <h2 className={`${display.className} flex items-center gap-2 text-lg font-semibold`}>
              <Activity className="size-4 text-muted-foreground" />
              {t("profile", "scouting")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("profile", "unavailable")}</p>
          </aside>
        </div>
      </Tabs.Root>
    </div>
  );
}
