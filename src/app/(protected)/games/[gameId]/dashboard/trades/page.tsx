"use client";

import { ArrowRightLeft, History, RotateCcw, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { use, useState } from "react";
import { display } from "@/app/ui-preview/fonts";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { usePlayerStates } from "@/application/hooks/player-states/usePlayerStates";
import { useReleaseCapCharge } from "@/application/hooks/roster/useReleasePlayer";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useDraftPickInventory } from "@/application/hooks/trades/useDraftPickInventory";
import { useTradeHistory } from "@/application/hooks/trades/useTradeHistory";
import { useExecuteTrade, useSimulateTrade } from "@/application/hooks/trades/useTrades";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { formatSalary } from "@/components/trades/format";
import { TradeAssetPanel } from "@/components/trades/trade-asset-panel";
import { TradeSummary } from "@/components/trades/trade-summary";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";
import type { TradeAsset, TradePackage } from "@/domain/entities/Trade";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

interface TradesPageProps {
  params: Promise<{ gameId: string }>;
}

function toggleSelection(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
}

export default function TradesPage({ params }: TradesPageProps) {
  const t = useT();
  const locale = useLocale();
  const { gameId } = use(params);
  const [opponentId, setOpponentId] = useState("");
  const [teamPlayerIds, setTeamPlayerIds] = useState<string[]>([]);
  const [opponentPlayerIds, setOpponentPlayerIds] = useState<string[]>([]);
  const [teamPickIds, setTeamPickIds] = useState<string[]>([]);
  const [opponentPickIds, setOpponentPickIds] = useState<string[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const gameQuery = useGame(gameId);
  const { data: game, isLoading: isLoadingGame } = gameQuery;
  const teamsQuery = useTeams();
  const { data: teams } = teamsQuery;
  const teamId = game?.selectedTeamId ?? "";
  const team = teams?.find(({ id }) => id === teamId);
  const opponent = teams?.find(({ id }) => id === opponentId);
  const teamRosterQuery = useRoster(gameId, teamId || null, game?.seasonYear);
  const { data: teamRosterData } = teamRosterQuery;
  const opponentRosterQuery = useRoster(gameId, opponentId || null, game?.seasonYear);
  const { data: opponentRosterData } = opponentRosterQuery;
  const teamContractsQuery = useTeamContracts(gameId, teamId || null);
  const { data: teamContractsData } = teamContractsQuery;
  const opponentContractsQuery = useTeamContracts(gameId, opponentId || null);
  const { data: opponentContractsData } = opponentContractsQuery;
  const teamReleaseCharge = useReleaseCapCharge(gameId, teamId || null, game?.seasonYear ?? 2026);
  const opponentReleaseCharge = useReleaseCapCharge(
    gameId,
    opponentId || null,
    game?.seasonYear ?? 2026
  );
  const inventoryQuery = useDraftPickInventory(gameId);
  const { data: inventory = [] } = inventoryQuery;
  const historyQuery = useTradeHistory(gameId);
  const { data: history = [] } = historyQuery;
  const teamStatesQuery = usePlayerStates(gameId, teamId || null);
  const { data: teamPlayerStates = [] } = teamStatesQuery;
  const opponentStatesQuery = usePlayerStates(gameId, opponentId || null);
  const { data: opponentPlayerStates = [] } = opponentStatesQuery;
  const executeTrade = useExecuteTrade();
  const teamRoster = teamRosterData ?? [];
  const opponentRoster = opponentRosterData ?? [];

  const teamPicks = inventory.filter(
    ({ ownerTeamId, isTransferable }) => ownerTeamId === teamId && isTransferable
  );
  const opponentPicks = inventory.filter(
    ({ ownerTeamId, isTransferable }) => ownerTeamId === opponentId && isTransferable
  );

  const pickById = new Map(inventory.map((pick) => [pick.id, pick]));
  const playerStateByPlayerId = new Map(
    [...teamPlayerStates, ...opponentPlayerStates].map((state) => [state.playerId, state])
  );

  const assetsFor = (
    playerIds: string[],
    pickIds: string[],
    roster: typeof teamRoster
  ): TradeAsset[] => [
    ...roster.flatMap(({ player, contract }) =>
      playerIds.includes(player.id) && contract
        ? [{ type: "player" as const, player, contract }]
        : []
    ),
    ...pickIds.map((pickId) => ({ type: "pick" as const, pickId })),
  ];
  const packageA: TradePackage | null = team
    ? {
        teamId,
        teamName: team.name,
        outgoingAssets: assetsFor(teamPlayerIds, teamPickIds, teamRoster),
        incomingAssets: [],
      }
    : null;
  const packageB: TradePackage | null = opponent
    ? {
        teamId: opponentId,
        teamName: opponent.name,
        outgoingAssets: assetsFor(opponentPlayerIds, opponentPickIds, opponentRoster),
        incomingAssets: [],
      }
    : null;
  if (packageA && packageB) {
    packageA.incomingAssets = packageB.outgoingAssets;
    packageB.incomingAssets = packageA.outgoingAssets;
  }

  const teamSnapshot =
    teamRosterData && teamContractsData && teamReleaseCharge.data !== undefined
      ? {
          contracts: teamContractsData,
          rosterSize: teamRosterData.length,
          releaseCapCharge: teamReleaseCharge.data,
        }
      : null;
  const opponentSnapshot =
    opponentRosterData && opponentContractsData && opponentReleaseCharge.data !== undefined
      ? {
          contracts: opponentContractsData,
          rosterSize: opponentRosterData.length,
          releaseCapCharge: opponentReleaseCharge.data,
        }
      : null;
  const simulation = useSimulateTrade(
    gameId,
    teamSnapshot,
    opponentSnapshot,
    packageA,
    packageB,
    game?.seasonYear ?? new Date().getFullYear()
  );

  const submitTrade = async () => {
    if (!game || !teamSnapshot || !opponentSnapshot || !packageA || !packageB) return;
    setExecutionError(null);
    try {
      const result = await executeTrade.mutateAsync({
        gameId,
        teamA: teamSnapshot,
        teamB: opponentSnapshot,
        packageA,
        packageB,
        seasonYear: game.seasonYear,
      });
      if (!result.success) {
        setExecutionError(result.error ?? t("trades", "failed"));
        return;
      }
      setTeamPlayerIds([]);
      setOpponentPlayerIds([]);
      setTeamPickIds([]);
      setOpponentPickIds([]);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : t("trades", "failed"));
    }
  };

  const resetTrade = () => {
    setTeamPlayerIds([]);
    setOpponentPlayerIds([]);
    setTeamPickIds([]);
    setOpponentPickIds([]);
    setExecutionError(null);
  };

  const requiredQueries = [
    gameQuery,
    teamsQuery,
    inventoryQuery,
    historyQuery,
    ...(teamId ? [teamRosterQuery, teamContractsQuery, teamReleaseCharge, teamStatesQuery] : []),
    ...(opponentId
      ? [opponentRosterQuery, opponentContractsQuery, opponentReleaseCharge, opponentStatesQuery]
      : []),
  ];
  if (requiredQueries.some((query) => query.isError)) {
    return (
      <div role="alert" className="space-y-3">
        <p>{t("trades", "loadError")}</p>
        <Button onClick={() => Promise.all(requiredQueries.map((query) => query.refetch()))}>
          {t("trades", "retry")}
        </Button>
      </div>
    );
  }
  if (isLoadingGame || !game || requiredQueries.some((query) => query.isLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <output>{t("trades", "loading")}</output>
      </div>
    );
  }

  const thresholds = getSalaryCapThresholds(game.seasonYear);
  const capCalculator = new SalaryCapCalculator(thresholds);
  const hasPackages = Boolean(packageA?.outgoingAssets.length && packageB?.outgoingAssets.length);

  return (
    <div className="space-y-5">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {t("trades", "context")}
            </p>
            <h1
              className={`${display.className} text-[38px] font-semibold leading-none tracking-tight sm:text-[44px]`}
            >
              {t("trades", "title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{t("trades", "description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="#trade-history">
                <History className="size-3.5" />
                {t("trades", "history")}
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetTrade}
              disabled={executeTrade.isPending}
            >
              <RotateCcw className="size-3.5" />
              {t("trades", "reset")}
            </Button>
            <span className="px-2 py-2 text-xs tabular-nums text-muted-foreground">
              {game.seasonYear}–{String(game.seasonYear + 1).slice(-2)} ·{" "}
              {formatSalary(thresholds.salaryCap)} {t("trades", "cap")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 rounded-[5px] border border-border bg-card px-5 py-3.5">
          {team && (
            <span className="flex items-center gap-2.5 border-border sm:border-r sm:pr-5 text-[13px] font-medium">
              {team.logoUrl && (
                <Image
                  src={team.logoUrl}
                  alt={`${team.name} selected team`}
                  width={32}
                  height={32}
                />
              )}
              <span>
                <small className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("trades", "franchise")}
                </small>
                {team.city} {team.name}
              </span>
            </span>
          )}
          <Select
            value={opponentId}
            disabled={executeTrade.isPending}
            onValueChange={(value) => {
              setOpponentId(value);
              setOpponentPlayerIds([]);
              setOpponentPickIds([]);
              setExecutionError(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-64" aria-label={t("trades", "partner")}>
              <SelectValue placeholder={t("trades", "choosePartner")} />
            </SelectTrigger>
            <SelectContent>
              {teams
                ?.filter(({ id }) => id !== teamId)
                .map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.city} {candidate.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            {t("trades", "autoCheck")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <output className="text-xs text-muted-foreground">
          {!opponent
            ? t("trades", "start")
            : !hasPackages
              ? t("trades", "waiting")
              : !simulation.data
                ? t("trades", "checking")
                : simulation.data.isValid
                  ? t("trades", "legal")
                  : t("trades", "adjustments")}
        </output>
        {opponent && (
          <Button variant="outline" size="sm" asChild>
            <a href="#trade-breakdown">{t("trades", "breakdown")}</a>
          </Button>
        )}
      </div>

      {opponent && (
        <div className="grid items-start gap-4 md:grid-cols-2 min-[90rem]:grid-cols-[minmax(0,34fr)_minmax(0,34fr)_minmax(0,32fr)]">
          <TradeAssetPanel
            teamName={team ? `${team.city} ${team.name}` : t("trades", "franchise")}
            teamLogoUrl={team?.logoUrl}
            roster={teamRoster}
            picks={teamPicks}
            playerStateByPlayerId={playerStateByPlayerId}
            selectedPlayerIds={teamPlayerIds}
            selectedPickIds={teamPickIds}
            onTogglePlayer={(id) => setTeamPlayerIds(toggleSelection(teamPlayerIds, id))}
            onTogglePick={(id) => setTeamPickIds(toggleSelection(teamPickIds, id))}
            seasonYear={game.seasonYear}
            payroll={
              teamSnapshot
                ? capCalculator.calculateTotalSalary(
                    teamSnapshot.contracts,
                    teamSnapshot.releaseCapCharge
                  )
                : null
            }
            incomingAssets={packageA?.incomingAssets ?? []}
            pickById={pickById}
            disabled={executeTrade.isPending}
          />
          <TradeAssetPanel
            key={opponent.id}
            teamName={`${opponent.city} ${opponent.name}`}
            teamLogoUrl={opponent.logoUrl}
            roster={opponentRoster}
            picks={opponentPicks}
            playerStateByPlayerId={playerStateByPlayerId}
            selectedPlayerIds={opponentPlayerIds}
            selectedPickIds={opponentPickIds}
            onTogglePlayer={(id) => setOpponentPlayerIds(toggleSelection(opponentPlayerIds, id))}
            onTogglePick={(id) => setOpponentPickIds(toggleSelection(opponentPickIds, id))}
            seasonYear={game.seasonYear}
            payroll={
              opponentSnapshot
                ? capCalculator.calculateTotalSalary(
                    opponentSnapshot.contracts,
                    opponentSnapshot.releaseCapCharge
                  )
                : null
            }
            incomingAssets={packageB?.incomingAssets ?? []}
            pickById={pickById}
            isPartner
            disabled={executeTrade.isPending}
          />

          {packageA && packageB && (
            <div
              id="trade-breakdown"
              className="min-w-0 scroll-mt-4 md:col-span-2 min-[90rem]:sticky min-[90rem]:top-6 min-[90rem]:col-span-1"
            >
              <TradeSummary
                teamAName={packageA.teamName}
                teamBName={packageB.teamName}
                teamALogoUrl={team?.logoUrl}
                teamBLogoUrl={opponent.logoUrl}
                packageA={packageA}
                packageB={packageB}
                pickById={pickById}
                playerStateByPlayerId={playerStateByPlayerId}
                simulation={simulation.data}
                executionError={
                  executionError ?? (simulation.isError ? t("trades", "loadError") : null)
                }
                isExecuting={executeTrade.isPending}
                onExecute={submitTrade}
                seasonYear={game.seasonYear}
              />
            </div>
          )}
        </div>
      )}

      <details
        id="trade-history"
        className="scroll-mt-4 rounded-[5px] border border-border bg-card"
        open
      >
        <summary className="cursor-pointer px-5 py-4 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-ring">
          {t("trades", "history")}{" "}
          <span className="ml-2 text-xs tabular-nums text-muted-foreground">{history.length}</span>
        </summary>
        <div className="space-y-3 px-5 pb-5">
          {history.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              {t("trades", "noHistory")}
            </p>
          )}
          {history.map((trade) => (
            <div
              key={trade.id}
              className="flex flex-col gap-1 border-t border-border py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2 font-medium">
                {teams?.find(({ id }) => id === trade.teamAId)?.logoUrl ? (
                  <Image
                    src={teams.find(({ id }) => id === trade.teamAId)?.logoUrl ?? ""}
                    alt={`${teams.find(({ id }) => id === trade.teamAId)?.name ?? "Team"} logo`}
                    width={28}
                    height={28}
                  />
                ) : null}
                <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                {teams?.find(({ id }) => id === trade.teamBId)?.logoUrl ? (
                  <Image
                    src={teams.find(({ id }) => id === trade.teamBId)?.logoUrl ?? ""}
                    alt={`${teams.find(({ id }) => id === trade.teamBId)?.name ?? "Team"} logo`}
                    width={28}
                    height={28}
                  />
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {trade.assets.length} {t("trades", "assets")} ·{" "}
                {new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
                  dateStyle: "medium",
                }).format(trade.executedAt)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
