"use client";

import { ArrowRightLeft, History } from "lucide-react";
import Image from "next/image";
import { use, useState } from "react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { usePlayerStates } from "@/application/hooks/player-states/usePlayerStates";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useDraftPickInventory } from "@/application/hooks/trades/useDraftPickInventory";
import { useTradeHistory } from "@/application/hooks/trades/useTradeHistory";
import { useExecuteTrade, useSimulateTrade } from "@/application/hooks/trades/useTrades";
import { TradeAssetPanel } from "@/components/trades/trade-asset-panel";
import { TradeSummary } from "@/components/trades/trade-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TradeAsset, TradePackage } from "@/domain/entities/Trade";

interface TradesPageProps {
  params: Promise<{ gameId: string }>;
}

function toggleSelection(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
}

export default function TradesPage({ params }: TradesPageProps) {
  const { gameId } = use(params);
  const [opponentId, setOpponentId] = useState("");
  const [teamPlayerIds, setTeamPlayerIds] = useState<string[]>([]);
  const [opponentPlayerIds, setOpponentPlayerIds] = useState<string[]>([]);
  const [teamPickIds, setTeamPickIds] = useState<string[]>([]);
  const [opponentPickIds, setOpponentPickIds] = useState<string[]>([]);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const { data: teams } = useTeams();
  const teamId = game?.selectedTeamId ?? "";
  const team = teams?.find(({ id }) => id === teamId);
  const opponent = teams?.find(({ id }) => id === opponentId);
  const { data: teamRosterData } = useRoster(gameId, teamId || null);
  const { data: opponentRosterData } = useRoster(gameId, opponentId || null);
  const { data: teamContractsData } = useTeamContracts(gameId, teamId || null);
  const { data: opponentContractsData } = useTeamContracts(gameId, opponentId || null);
  const { data: inventory = [] } = useDraftPickInventory(gameId);
  const { data: history = [] } = useTradeHistory(gameId);
  const { data: teamPlayerStates = [] } = usePlayerStates(gameId, teamId || null);
  const { data: opponentPlayerStates = [] } = usePlayerStates(gameId, opponentId || null);
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
        teamName: `${team.city} ${team.name}`,
        outgoingAssets: assetsFor(teamPlayerIds, teamPickIds, teamRoster),
        incomingAssets: [],
      }
    : null;
  const packageB: TradePackage | null = opponent
    ? {
        teamId: opponentId,
        teamName: `${opponent.city} ${opponent.name}`,
        outgoingAssets: assetsFor(opponentPlayerIds, opponentPickIds, opponentRoster),
        incomingAssets: [],
      }
    : null;
  if (packageA && packageB) {
    packageA.incomingAssets = packageB.outgoingAssets;
    packageB.incomingAssets = packageA.outgoingAssets;
  }

  const teamSnapshot =
    teamRosterData && teamContractsData
      ? { contracts: teamContractsData, rosterSize: teamRosterData.length }
      : null;
  const opponentSnapshot =
    opponentRosterData && opponentContractsData
      ? { contracts: opponentContractsData, rosterSize: opponentRosterData.length }
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
    const result = await executeTrade.mutateAsync({
      gameId,
      teamA: teamSnapshot,
      teamB: opponentSnapshot,
      packageA,
      packageB,
      seasonYear: game.seasonYear,
    });
    if (!result.success) {
      setExecutionError(result.error ?? "Trade execution failed");
      return;
    }
    setTeamPlayerIds([]);
    setOpponentPlayerIds([]);
    setTeamPickIds([]);
    setOpponentPickIds([]);
  };

  if (isLoadingGame || !game) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
          <ArrowRightLeft className="size-8 text-primary" /> Trades
        </h1>
        <p className="text-muted-foreground">Build and execute an atomic two-team transaction.</p>
      </div>

      <Select
        value={opponentId}
        onValueChange={(value) => {
          setOpponentId(value);
          setOpponentPlayerIds([]);
          setOpponentPickIds([]);
        }}
      >
        <SelectTrigger className="w-full md:w-80">
          <SelectValue placeholder="Select trade partner" />
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

      {opponent && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <TradeAssetPanel
              teamName={team ? `${team.city} ${team.name}` : "Your team"}
              teamLogoUrl={team?.logoUrl}
              roster={teamRoster}
              picks={teamPicks}
              playerStateByPlayerId={playerStateByPlayerId}
              selectedPlayerIds={teamPlayerIds}
              selectedPickIds={teamPickIds}
              onTogglePlayer={(id) => setTeamPlayerIds(toggleSelection(teamPlayerIds, id))}
              onTogglePick={(id) => setTeamPickIds(toggleSelection(teamPickIds, id))}
              seasonYear={game.seasonYear}
            />
            <TradeAssetPanel
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
            />
          </div>

          {packageA && packageB && (
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
              executionError={executionError}
              isExecuting={executeTrade.isPending}
              onExecute={submitTrade}
              seasonYear={game.seasonYear}
            />
          )}
        </>
      )}

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-primary" />
            Trade history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              No trades recorded yet.
            </p>
          )}
          {history.map((trade) => (
            <div
              key={trade.id}
              className="flex flex-col gap-1 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                {trade.assets.length} assets ·{" "}
                {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(trade.executedAt)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
