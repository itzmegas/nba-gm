"use client";

import { Users } from "lucide-react";
import { use, useState } from "react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { useReleaseCapCharge } from "@/application/hooks/roster/useReleasePlayer";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeam } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import {
  formatRosterSalary,
  getContractStatus,
  RosterTable,
} from "@/components/roster/roster-table";
import { Badge } from "@/components/ui/badge";
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

  if (isLoadingGame || isLoadingRoster || !game) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex shrink-0 flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            {t("dashboard", "roster")}
          </h1>
          <p className="text-muted-foreground">
            {team?.name} — {t("dashboard", "season")} {formatSeasonLabel(game.seasonYear)}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:max-w-3xl flex-1 [&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:py-0 [&_.text-2xl]:text-lg">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "standardPlayers")}
              </p>
              <p className="text-2xl font-black mt-1">{standardPlayers}</p>
              <p className="text-xs text-muted-foreground">{t("dashboard", "playersMax")}</p>
              <p className="text-xs text-muted-foreground">
                {twoWayPlayers} {t("dashboard", "twoWayPlayers")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "totalPayroll")}
              </p>
              <p className="text-2xl font-black mt-1">
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

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "capSpace")}
              </p>
              <p
                className={`text-2xl font-black mt-1 ${
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

          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {t("dashboard", "apronStatus")}
              </p>
              <p className="text-2xl font-black mt-1">
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

      {selectedPlayer && (
        <section
          aria-label={t("dashboard", "rosterPlayer")}
          className="sticky top-0 z-20 flex flex-wrap items-center gap-5 rounded-xl border border-border/50 bg-card px-6 py-4 shadow-sm md:gap-8"
          aria-live="polite"
        >
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted/30 md:h-40 md:w-40">
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
              <h2 className="text-2xl font-black tracking-tight md:text-4xl">
                {selectedPlayer.fullName}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1 text-lg font-bold">
                {selectedPlayer.position ?? "—"}
              </Badge>
              <Badge variant="outline">
                {t("dashboard", "playerAge")}: {playerAge ?? t("dashboard", "unknownValue")}
              </Badge>
              <Badge variant="outline">{selectedPlayer.height ?? "—"}</Badge>
              <Badge variant="outline">{selectedPlayer.weight ?? "—"}</Badge>
            </div>
          </div>
          <div className="w-full border-t border-border/50 pt-4 lg:ml-auto lg:w-auto lg:min-w-60 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
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
        </section>
      )}

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("dashboard", "activeContracts")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isRosterError ? (
            <p role="alert" className="px-6 py-12 text-center text-destructive">
              {t("dashboard", "rosterLoadFailed")}
            </p>
          ) : rosterPlayers && rosterPlayers.length > 0 ? (
            <RosterTable
              gameId={gameId}
              players={rosterPlayers}
              seasonYear={game.seasonYear}
              onSelectPlayer={setSelectedPlayerId}
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
    </div>
  );
}
