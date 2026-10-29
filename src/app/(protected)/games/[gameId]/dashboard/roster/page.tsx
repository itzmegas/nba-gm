"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { useReleaseCapCharge } from "@/application/hooks/roster/useReleasePlayer";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeam } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { formatRosterSalary, getContractStatus } from "@/components/roster/roster-table";
import { RosterTableViews } from "@/components/roster/roster-table-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";
import { CONTRACT_CAP_TREATMENT } from "@/domain/contracts/ContractClassification";
import { CONTRACT_ORIGIN } from "@/domain/entities/Contract";
import { getPlayerAge } from "@/domain/entities/Player";
import { formatSeasonLabel, getYearsRemaining } from "@/domain/entities/Season";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

function formatSalary(amount: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount / 1_000_000)}M`;
}

interface GameRosterPageProps {
  params: Promise<{ gameId: string }>;
}

export default function GameRosterPage({ params }: GameRosterPageProps) {
  const { gameId } = use(params);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const selectedTeamId = game?.selectedTeamId ?? null;

  const { data: team } = useTeam(selectedTeamId ?? "");
  const {
    data: rosterPlayers,
    isLoading: isLoadingRoster,
    isError: isRosterError,
  } = useRoster(gameId, selectedTeamId, game?.seasonYear);
  const { data: contracts } = useTeamContracts(gameId, selectedTeamId);
  const releaseCapCharge = useReleaseCapCharge(gameId, selectedTeamId, game?.seasonYear ?? 2026);

  const thresholds = getSalaryCapThresholds(game?.seasonYear ?? 2024);
  const calculator = new SalaryCapCalculator(thresholds);
  const financials =
    contracts && releaseCapCharge.data !== undefined
      ? calculator.getFinancialStatus(contracts, releaseCapCharge.data)
      : null;
  const twoWayPlayers =
    rosterPlayers?.filter(
      ({ contract, gameContract }) =>
        contract?.origin !== CONTRACT_ORIGIN.SIMULATED_AGREEMENT &&
        gameContract?.capTreatment === CONTRACT_CAP_TREATMENT.EXCLUDED_TWO_WAY
    ).length ?? 0;
  const standardPlayers = (rosterPlayers?.length ?? 0) - twoWayPlayers;
  const locale = useLocale();
  const t = useT();
  const selectedRosterPlayer =
    rosterPlayers?.find(({ player }) => player.id === selectedPlayerId) ??
    rosterPlayers?.toSorted((a, b) => (b.contract?.salaryY1 ?? 0) - (a.contract?.salaryY1 ?? 0))[0];
  const selectedPlayer = selectedRosterPlayer?.player;
  const selectedContract = selectedRosterPlayer?.contract;
  const playerAge =
    selectedPlayer && game ? getPlayerAge(selectedPlayer, game.simulationDate) : undefined;

  function selectPlayer(playerId: string) {
    setSelectedPlayerId(playerId);
    if (window.matchMedia("(min-width: 80rem)").matches) return;
    // Wait for the selected player's name to render before moving focus.
    window.requestAnimationFrame(() => {
      inspectorHeading.current?.focus({ preventScroll: true });
      inspectorHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  if (isLoadingGame || isLoadingRoster || !game) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div
      data-slot="roster-screen"
      className={`${body.className} min-w-0 space-y-5 animate-in fade-in duration-500`}
    >
      <div className="space-y-4 border-b border-border/60 pb-5">
        <div className="flex shrink-0 flex-col gap-1">
          <h1
            className={`${display.className} flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl`}
          >
            <Users className="size-6 text-primary" />
            {t("dashboard", "roster")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {team?.name} — {t("dashboard", "season")} {formatSeasonLabel(game.seasonYear)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 [&_[data-slot=card]]:min-w-0 [&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:rounded-md [&_[data-slot=card]]:border-border/60 [&_[data-slot=card]]:py-4 [&_[data-slot=card]]:shadow-none">
          <Card>
            <CardContent className="space-y-1 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "standardPlayers")}
              </p>
              <p className={`${display.className} text-2xl font-semibold tabular-nums`}>
                {standardPlayers}
              </p>
              <p className="text-xs text-muted-foreground">{t("dashboard", "playersMax")}</p>
              <p className="text-xs text-muted-foreground">
                {twoWayPlayers} {t("dashboard", "twoWayPlayers")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "totalPayroll")}
              </p>
              <p className={`${display.className} break-words text-2xl font-semibold tabular-nums`}>
                {financials ? formatSalary(financials.totalSalary, locale) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("dashboard", "cap")}: {formatSalary(thresholds.salaryCap, locale)}
              </p>
              {releaseCapCharge.data !== undefined && releaseCapCharge.data > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("dashboard", "releasedSalary")}: {formatSalary(releaseCapCharge.data, locale)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "capSpace")}
              </p>
              <p
                className={`${display.className} break-words text-2xl font-semibold tabular-nums ${
                  financials?.isOverCap ? "text-destructive" : "text-green-500"
                }`}
              >
                {financials
                  ? financials.isOverCap
                    ? `-${formatSalary(financials.totalSalary - thresholds.salaryCap, locale)}`
                    : formatSalary(financials.capSpace, locale)
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {financials?.isOverCap ? t("dashboard", "overCap") : t("dashboard", "available")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "apronStatus")}
              </p>
              <p className={`${display.className} text-2xl font-semibold`}>
                {financials?.apronStatus === "None"
                  ? t("dashboard", "clean")
                  : (financials?.apronStatus ?? "—")}
              </p>
              <p className="text-xs text-muted-foreground">
                {financials?.isOverLuxuryTax
                  ? t("dashboard", "luxuryTax")
                  : t("dashboard", "belowTax")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {releaseCapCharge.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("dashboard", "releaseChargesFailed")}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:has-[>section]:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 gap-4 overflow-hidden rounded-md border-border/60 bg-card py-4 shadow-none [&_[data-slot=button]]:rounded-sm [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-x-0 [&_[data-slot=table-container]]:border-b-0 [&_[data-slot=table-cell]]:py-2">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className={`${display.className} text-lg font-semibold`}>
              {t("dashboard", "activeContracts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 p-0">
            {isRosterError ? (
              <p role="alert" className="px-6 py-12 text-center text-destructive">
                {t("dashboard", "rosterLoadFailed")}
              </p>
            ) : rosterPlayers && rosterPlayers.length > 0 ? (
              <RosterTableViews
                gameId={gameId}
                players={rosterPlayers}
                seasonYear={game.seasonYear}
                onSelectPlayer={selectPlayer}
                selectedPlayerId={selectedPlayer?.id}
                canRelease={
                  game.status === "active" &&
                  game.seasonEraId === "modern" &&
                  game.seasonYear === 2026
                }
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                {t("dashboard", "noPlayersRoster")}
              </div>
            )}
          </CardContent>
        </Card>
        {selectedPlayer && (
          <section
            aria-label={t("dashboard", "rosterPlayer")}
            className="min-w-0 space-y-4 rounded-md border border-border/60 bg-card p-4 xl:sticky xl:top-4"
            aria-live="polite"
          >
            <div className="mx-auto size-24 overflow-hidden rounded-md bg-muted/30">
              <PlayerHeadshot
                src={selectedPlayer.headshotUrl}
                alt={selectedPlayer.fullName}
                className="h-full w-full object-cover object-top"
                loading="eager"
              />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-muted-foreground">
                  {selectedPlayer.jerseyNumber != null ? `#${selectedPlayer.jerseyNumber}` : ""}
                </span>
                <h2
                  ref={inspectorHeading}
                  tabIndex={-1}
                  className={`${display.className} min-w-0 scroll-mt-4 break-words text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary`}
                >
                  {selectedPlayer.fullName}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-sm">
                  {selectedPlayer.position ?? "—"}
                </Badge>
                <Badge variant="outline">
                  {t("dashboard", "playerAge")}: {playerAge ?? t("dashboard", "unknownValue")}
                </Badge>
                <Badge variant="outline">{selectedPlayer.height ?? "—"}</Badge>
                <Badge variant="outline">{selectedPlayer.weight ?? "—"}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("playerAttributes", "overall")}</p>
                <p className={`${display.className} text-3xl font-semibold tabular-nums`}>
                  {selectedRosterPlayer?.ratings?.overall ?? "—"}
                </p>
              </div>
              {selectedRosterPlayer?.ratings?.estimated && (
                <Badge variant="outline">{t("playerAttributes", "estimated")}</Badge>
              )}
            </div>
            <div className="border-t border-border/60 pt-4">
              <h3 className="mb-3 text-sm font-semibold">{t("dashboard", "playerContract")}</h3>
              {selectedContract ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("dashboard", "rosterSalary")} {formatSeasonLabel(game.seasonYear)}
                    </dt>
                    <dd className="text-lg font-bold">
                      {formatRosterSalary(selectedContract.salaryY1, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("dashboard", "rosterDuration")}</dt>
                    <dd className="text-lg font-bold">
                      {getYearsRemaining(game.seasonYear, selectedContract.endYear)}
                      {t("dashboard", "yearsShort")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("dashboard", "contractEndSeason")}</dt>
                    <dd>{formatSeasonLabel(selectedContract.endYear)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("dashboard", "rosterStatus")}</dt>
                    <dd>
                      {selectedRosterPlayer &&
                        getContractStatus(selectedRosterPlayer, game.seasonYear, locale).label}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard", "contractUnavailable")}
                </p>
              )}
            </div>
            <Button asChild variant="outline" className="w-full rounded-sm">
              <Link href={`/games/${gameId}/dashboard/player/${selectedPlayer.id}`}>
                {t("dashboard", "viewPlayer")}
              </Link>
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
