"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
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
import {
  formatRosterSalary,
  getContractStatus,
  getRosterContractClassification,
  shouldRenderRosterPlayer,
} from "@/components/roster/roster-table";
import { RosterTableViews } from "@/components/roster/roster-table-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [expiring, setExpiring] = useState(false);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const selectedTeamId = game?.selectedTeamId ?? null;

  const { data: team } = useTeam(selectedTeamId ?? "");
  const {
    data: rosterPlayers,
    isLoading: isLoadingRoster,
    isError: isRosterError,
  } = useRoster(gameId, selectedTeamId, game?.seasonYear);
  const { data: contracts, isError: isContractsError } = useTeamContracts(gameId, selectedTeamId);
  const releaseCapCharge = useReleaseCapCharge(gameId, selectedTeamId, game?.seasonYear ?? 2026);

  const thresholds = getSalaryCapThresholds(game?.seasonYear ?? 2024);
  const calculator = new SalaryCapCalculator(thresholds);
  const financials =
    contracts &&
    !isContractsError &&
    !releaseCapCharge.isError &&
    releaseCapCharge.data !== undefined
      ? calculator.getFinancialStatus(contracts, releaseCapCharge.data)
      : null;
  const activePlayers = isRosterError ? [] : (rosterPlayers ?? []).filter(shouldRenderRosterPlayer);
  const twoWayPlayers = activePlayers.filter(
    ({ contract, gameContract }) =>
      contract?.origin !== CONTRACT_ORIGIN.SIMULATED_AGREEMENT &&
      gameContract?.capTreatment === CONTRACT_CAP_TREATMENT.EXCLUDED_TWO_WAY
  ).length;
  const standardPlayers = activePlayers.length - twoWayPlayers;
  const locale = useLocale();
  const t = useT();
  const selectedRosterPlayer =
    activePlayers.find(({ player }) => player.id === selectedPlayerId) ??
    activePlayers.toSorted((a, b) => (b.contract?.salaryY1 ?? 0) - (a.contract?.salaryY1 ?? 0))[0];
  const selectedPlayer = selectedRosterPlayer?.player;
  const selectedContract = selectedRosterPlayer?.contract;
  const playerAge =
    selectedPlayer && game ? getPlayerAge(selectedPlayer, game.simulationDate) : undefined;
  const filteredPlayers = activePlayers.filter(
    ({ player, contract }) =>
      player.fullName.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)) &&
      (!position || player.position === position) &&
      (!expiring ||
        (contract && getYearsRemaining(game?.seasonYear ?? 2026, contract.endYear) === 1))
  );
  const positions = [
    ...new Set(activePlayers.flatMap(({ player }) => (player.position ? [player.position] : []))),
  ].sort();
  const classification = selectedRosterPlayer
    ? getRosterContractClassification(selectedRosterPlayer, locale)
    : null;

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
      <div className="space-y-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {t("rosterUI", "context")}
            </p>
            <h1
              className={`${display.className} text-3xl font-semibold uppercase tracking-tight sm:text-4xl`}
            >
              {t("rosterUI", "title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("rosterUI", "description")}</p>
          </div>
          <Badge variant="outline" className="px-3 py-2 uppercase tracking-wide">
            {formatSeasonLabel(game.seasonYear)} {t("dashboard", "season")}
          </Badge>
        </div>

        <div
          data-slot="roster-summary"
          className="grid grid-cols-2 items-stretch overflow-hidden rounded-md border border-border bg-card lg:grid-cols-[minmax(180px,1.25fr)_repeat(4,minmax(0,1fr))]"
        >
          <div className="col-span-2 flex items-center gap-3 border-b border-border p-5 lg:col-span-1 lg:border-b-0">
            {team?.logoUrl && (
              <Image
                src={team.logoUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 object-contain"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium">{team?.name ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSeasonLabel(game.seasonYear)} · {t("dashboard", "activeContracts")}
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-1 border-l border-border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "standardPlayers")}
            </p>
            <p className={`${display.className} text-2xl font-semibold tabular-nums`}>
              {isRosterError ? "—" : standardPlayers}
            </p>
            <p className="text-xs text-muted-foreground">{t("dashboard", "playersMax")}</p>
            <p className="text-xs text-muted-foreground">
              {isRosterError ? "—" : twoWayPlayers} {t("dashboard", "twoWayPlayers")}
            </p>
          </div>

          <div className="min-w-0 space-y-1 border-l border-border p-5">
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
          </div>

          <div className="min-w-0 space-y-1 border-l border-border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "capSpace")}
            </p>
            <p
              className={`${display.className} break-words text-2xl font-semibold tabular-nums ${
                financials?.isOverCap ? "text-destructive" : "text-foreground"
              }`}
            >
              {financials
                ? financials.isOverCap
                  ? `-${formatSalary(financials.totalSalary - thresholds.salaryCap, locale)}`
                  : formatSalary(financials.capSpace, locale)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {financials
                ? financials.isOverCap
                  ? t("dashboard", "overCap")
                  : t("dashboard", "available")
                : t("dashboard", "unknownValue")}
            </p>
          </div>

          <div className="min-w-0 space-y-1 border-l border-border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "apronStatus")}
            </p>
            <p className={`${display.className} text-2xl font-semibold`}>
              {financials?.apronStatus === "None"
                ? t("dashboard", "clean")
                : (financials?.apronStatus ?? "—")}
            </p>
            <p className="text-xs text-muted-foreground">
              {!financials
                ? t("dashboard", "unknownValue")
                : financials.isOverLuxuryTax
                  ? t("dashboard", "luxuryTax")
                  : t("dashboard", "belowTax")}
            </p>
          </div>
        </div>
      </div>

      {(releaseCapCharge.isError || isContractsError) && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            "dashboard",
            releaseCapCharge.isError ? "releaseChargesFailed" : "contractUnavailable"
          )}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-5 xl:has-[>section]:grid-cols-[minmax(0,1fr)_18.5rem]">
        <div className="min-w-0 space-y-4 overflow-hidden rounded-md border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <h2 className="text-base font-semibold">{t("dashboard", "activeContracts")}</h2>
            <span className="text-xs text-muted-foreground">{t("rosterUI", "selectHelp")}</span>
          </div>
          <div className="min-w-0">
            {isRosterError ? (
              <p role="alert" className="px-6 py-12 text-center text-destructive">
                {t("dashboard", "rosterLoadFailed")}
              </p>
            ) : activePlayers.length > 0 ? (
              <>
                <RosterTableViews
                  initialView="overview"
                  gameId={gameId}
                  players={filteredPlayers}
                  seasonYear={game.seasonYear}
                  onSelectPlayer={selectPlayer}
                  selectedPlayerId={selectedPlayer?.id}
                  canRelease={
                    game.status === "active" &&
                    game.seasonEraId === "modern" &&
                    game.seasonYear === 2026
                  }
                >
                  <div className="mb-4 flex flex-wrap items-end gap-3 px-5">
                    <label
                      htmlFor="roster-search"
                      className="grid min-w-40 flex-1 gap-1.5 text-xs text-muted-foreground"
                    >
                      {t("rosterUI", "search")}
                      <Input
                        id="roster-search"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t("rosterUI", "searchPlaceholder")}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-muted-foreground">
                      {t("dashboard", "rosterPosition")}
                      <select
                        className="h-9 max-w-full rounded-sm border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        value={position}
                        onChange={(event) => setPosition(event.target.value)}
                      >
                        <option value="">{t("rosterUI", "allPositions")}</option>
                        {positions.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-1 rounded-sm border border-border bg-muted/30 p-1">
                      <Button
                        size="sm"
                        variant={expiring ? "ghost" : "secondary"}
                        aria-pressed={!expiring}
                        onClick={() => setExpiring(false)}
                      >
                        {t("rosterUI", "allPlayers")}
                      </Button>
                      <Button
                        size="sm"
                        variant={expiring ? "secondary" : "ghost"}
                        aria-pressed={expiring}
                        onClick={() => setExpiring(true)}
                      >
                        {t("dashboard", "contractExpiring")}
                      </Button>
                    </div>
                  </div>
                </RosterTableViews>
                {filteredPlayers.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {t("rosterUI", "noMatches")}
                  </p>
                )}
                <output className="block border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  {filteredPlayers.length} / {activePlayers.length} · {t("rosterUI", "allPlayers")}
                </output>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                {t("dashboard", "noPlayersRoster")}
              </div>
            )}
          </div>
        </div>
        {selectedPlayer && (
          <section
            aria-label={t("dashboard", "rosterPlayer")}
            className="min-w-0 space-y-4 overflow-hidden rounded-md border border-primary/25 bg-card pb-5 xl:sticky xl:top-4 [&>div:not([data-slot=portrait-stage])]:mx-5 [&>a]:mx-5 [&>a]:w-[calc(100%-2.5rem)]"
            aria-live="polite"
          >
            <div className="flex items-center justify-between border-b border-primary/20 py-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("rosterUI", "selectedPlayer")}
              </span>
              <div className="flex gap-1">
                {[-1, 1].map((direction) => (
                  <Button
                    key={direction}
                    size="icon"
                    variant="ghost"
                    aria-label={t("rosterUI", direction < 0 ? "previousPlayer" : "nextPlayer")}
                    onClick={() => {
                      const index = activePlayers.findIndex(
                        ({ player }) => player.id === selectedPlayer.id
                      );
                      selectPlayer(
                        activePlayers[
                          (index + direction + activePlayers.length) % activePlayers.length
                        ].player.id
                      );
                    }}
                  >
                    {direction < 0 ? <ChevronLeft /> : <ChevronRight />}
                  </Button>
                ))}
              </div>
            </div>
            <div
              data-slot="portrait-stage"
              className="relative isolate h-52 overflow-hidden bg-primary/10"
            >
              <span
                aria-hidden="true"
                className={`${display.className} absolute left-5 top-0 -z-10 text-[160px] leading-none font-semibold text-primary/10`}
              >
                {selectedPlayer.jerseyNumber}
              </span>
              <PlayerHeadshot
                src={selectedPlayer.headshotUrl}
                alt={selectedPlayer.fullName}
                className="h-full w-full object-contain object-bottom"
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
                  className={`${display.className} min-w-0 scroll-mt-4 break-words text-4xl font-semibold uppercase leading-none tracking-tight focus-visible:outline-2 focus-visible:outline-primary`}
                >
                  {selectedPlayer.fullName}
                </h2>
              </div>
              {classification && (
                <Badge variant="outline" title={classification.title}>
                  {classification.label}
                </Badge>
              )}
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
            {selectedRosterPlayer?.ratings && (
              <div className="space-y-3 border-t border-border pt-4">
                {(["closeShot", "passAccuracy", "perimeterDefense"] as const).map((attribute) => (
                  <div
                    key={attribute}
                    className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {t("playerAttributes", attribute)}
                    </span>
                    <span className="font-mono">
                      {selectedRosterPlayer.ratings?.attributes[attribute] ?? "—"}
                    </span>
                    {selectedRosterPlayer.ratings?.attributes[attribute] != null && (
                      <meter
                        className="col-span-2 h-2 w-full accent-primary"
                        min={0}
                        max={100}
                        value={selectedRosterPlayer.ratings.attributes[attribute]}
                        aria-label={t("playerAttributes", attribute)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
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
            <Button asChild className="rounded-sm">
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
