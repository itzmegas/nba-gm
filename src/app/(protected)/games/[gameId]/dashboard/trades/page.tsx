"use client";

import { ArrowRightLeft } from "lucide-react";
import { use, useState } from "react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useDraftPickInventory } from "@/application/hooks/trades/useDraftPickInventory";
import { useTradeHistory } from "@/application/hooks/trades/useTradeHistory";
import { useExecuteTrade, useSimulateTrade } from "@/application/hooks/trades/useTrades";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PickInventory, TradeAsset, TradePackage } from "@/domain/entities/Trade";

interface TradesPageProps {
  params: Promise<{ gameId: string }>;
}

function toggleSelection(current: string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
}

function formatPick(pick: PickInventory): string {
  const protection = pick.pick.protection ? ` (${pick.pick.protection})` : "";
  return `${pick.pick.draftYear} R${pick.pick.draftRound}${protection}`;
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
  const { data: teamRoster = [] } = useRoster(gameId, teamId || null);
  const { data: opponentRoster = [] } = useRoster(gameId, opponentId || null);
  const { data: teamContracts = [] } = useTeamContracts(gameId, teamId || null);
  const { data: opponentContracts = [] } = useTeamContracts(gameId, opponentId || null);
  const { data: inventory = [] } = useDraftPickInventory(gameId);
  const { data: history = [] } = useTradeHistory(gameId);
  const executeTrade = useExecuteTrade();

  const teamPicks = inventory.filter(
    ({ ownerTeamId, isTransferable }) => ownerTeamId === teamId && isTransferable
  );
  const opponentPicks = inventory.filter(
    ({ ownerTeamId, isTransferable }) => ownerTeamId === opponentId && isTransferable
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

  const simulation = useSimulateTrade(gameId, teamContracts, opponentContracts, packageA, packageB);
  const hasAssets = Boolean(packageA?.outgoingAssets.length && packageB?.outgoingAssets.length);

  const submitTrade = async () => {
    if (!packageA || !packageB) return;
    setExecutionError(null);
    const result = await executeTrade.mutateAsync({
      gameId,
      teamAContracts: teamContracts,
      teamBContracts: opponentContracts,
      packageA,
      packageB,
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
    return <div className="flex min-h-[50vh] items-center justify-center">Loading trades...</div>;
  }

  const renderAssets = (
    roster: typeof teamRoster,
    picks: PickInventory[],
    selectedPlayers: string[],
    selectedPicks: string[],
    setPlayers: (ids: string[]) => void,
    setPicks: (ids: string[]) => void
  ) => (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Players</p>
        {roster.map(({ player, contract }) => (
          <label
            key={player.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3"
          >
            <span>
              <span className="block font-medium">{player.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {contract ? `$${(contract.salaryY1 / 1_000_000).toFixed(1)}M` : "No contract"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={selectedPlayers.includes(player.id)}
              disabled={!contract}
              onChange={() => setPlayers(toggleSelection(selectedPlayers, player.id))}
              className="size-4 accent-primary"
            />
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Draft picks
        </p>
        {picks.map((pick) => (
          <label
            key={pick.id}
            className="flex cursor-pointer items-center justify-between rounded-xl border p-3"
          >
            <span>{formatPick(pick)}</span>
            <input
              type="checkbox"
              checked={selectedPicks.includes(pick.id)}
              onChange={() => setPicks(toggleSelection(selectedPicks, pick.id))}
              className="size-4 accent-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );

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
            <Card>
              <CardHeader>
                <CardTitle>
                  {team?.city} {team?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderAssets(
                  teamRoster,
                  teamPicks,
                  teamPlayerIds,
                  teamPickIds,
                  setTeamPlayerIds,
                  setTeamPickIds
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {opponent.city} {opponent.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderAssets(
                  opponentRoster,
                  opponentPicks,
                  opponentPlayerIds,
                  opponentPickIds,
                  setOpponentPlayerIds,
                  setOpponentPickIds
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="space-y-3 pt-1">
              {simulation.data && !simulation.data.isValid && (
                <div className="text-sm text-destructive">
                  {simulation.data.errors.map((error) => error.message).join(" ")}
                </div>
              )}
              {executionError && <div className="text-sm text-destructive">{executionError}</div>}
              <Button
                className="w-full"
                size="lg"
                disabled={!hasAssets || simulation.data?.isValid !== true || executeTrade.isPending}
                onClick={submitTrade}
              >
                {executeTrade.isPending ? "Executing..." : "Execute trade"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trade history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && <p className="text-muted-foreground">No trades recorded.</p>}
          {history.map((trade) => (
            <div
              key={trade.id}
              className="flex flex-col gap-1 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                {teams?.find(({ id }) => id === trade.teamAId)?.abbreviation ?? "Team"} ↔{" "}
                {teams?.find(({ id }) => id === trade.teamBId)?.abbreviation ?? "Team"}
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
