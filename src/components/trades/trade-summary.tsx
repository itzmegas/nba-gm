"use client";

import { AlertTriangle, Info, Scale, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NBA_RULES } from "@/domain/constants/nba-rules";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { getYearsRemaining } from "@/domain/entities/Season";
import type {
  PickInventory,
  TradeAsset,
  TradePackage,
  TradeValidationResult,
} from "@/domain/entities/Trade";
import { cn } from "@/utils/utils";
import { formatPick, formatSalary, formatSignedSalary } from "./format";

function MeterBar({ value, invert = false }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 30 : value >= 70;
  const isMid = invert ? value <= 60 : value >= 40;
  const barColor = isGood ? "bg-green-500" : isMid ? "bg-amber-500" : "bg-red-500";

  return (
    <span className="flex items-center justify-center gap-2">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", barColor)}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{value}</span>
    </span>
  );
}

function playerAssets(assets: TradeAsset[]) {
  return assets.filter(
    (asset): asset is TradeAsset & { player: NonNullable<TradeAsset["player"]> } =>
      asset.type === "player" && Boolean(asset.player)
  );
}

function pickAssets(assets: TradeAsset[]) {
  return assets.filter((asset) => asset.type === "pick" && Boolean(asset.pickId));
}

interface TradeSummaryProps {
  teamAName: string;
  teamBName: string;
  teamAAbbreviation?: string;
  teamBAbbreviation?: string;
  packageA: TradePackage;
  packageB: TradePackage;
  pickById: Map<string, PickInventory>;
  playerStateByPlayerId: Map<string, PlayerState>;
  simulation?: TradeValidationResult;
  executionError: string | null;
  isExecuting: boolean;
  onExecute: () => void;
  seasonYear: number;
}

export function TradeSummary({
  teamAName,
  teamBName,
  teamAAbbreviation,
  teamBAbbreviation,
  packageA,
  packageB,
  pickById,
  playerStateByPlayerId,
  simulation,
  executionError,
  isExecuting,
  onExecute,
  seasonYear,
}: TradeSummaryProps) {
  const hasAssets = packageA.outgoingAssets.length > 0 && packageB.outgoingAssets.length > 0;
  const detailsA = simulation?.details.teamA;
  const detailsB = simulation?.details.teamB;

  const groups = [
    {
      label: "You send",
      teamName: teamAName,
      badgeVariant: "secondary" as const,
      players: playerAssets(packageA.outgoingAssets),
      picks: pickAssets(packageA.outgoingAssets),
    },
    {
      label: "You receive",
      teamName: teamBName,
      badgeVariant: "default" as const,
      players: playerAssets(packageB.outgoingAssets),
      picks: pickAssets(packageB.outgoingAssets),
    },
  ].filter((group) => group.players.length > 0 || group.picks.length > 0);

  const hasPlayers = groups.some((group) => group.players.length > 0);
  const rosterMin = NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN;
  const rosterMax = NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="size-5 text-primary" />
          Trade Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAssets && (
          <div className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Select players or picks from both teams to compare packages and validate the trade.
          </div>
        )}

        {simulation && !simulation.isValid && (
          <div className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            {simulation.errors.map((error) => (
              <p key={error.message} className="flex items-start gap-2 text-sm text-destructive">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                {error.message}
              </p>
            ))}
          </div>
        )}

        {simulation?.warnings.map((warning) => (
          <div
            key={warning}
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {warning}
          </div>
        ))}

        {simulation?.isValid && hasAssets && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-medium text-green-600 dark:text-green-400">
            <ShieldCheck className="size-4 shrink-0" />
            Trade is legal under cap and roster rules.
          </div>
        )}

        {executionError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {executionError}
          </div>
        )}

        {detailsA && detailsB && hasAssets && (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="py-2.5 px-4 text-left font-medium text-muted-foreground">
                    Cap impact
                  </th>
                  {[teamAAbbreviation, teamBAbbreviation].map((abbr, index) => (
                    <th key={abbr ?? index} className="py-2.5 px-4 text-right font-medium">
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                          {abbr ?? "—"}
                        </span>
                        <span className="hidden sm:inline">
                          {index === 0 ? teamAName : teamBName}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 px-4 text-muted-foreground">Salary sent</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatSalary(detailsA.outgoingSalary)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatSalary(detailsB.outgoingSalary)}
                  </td>
                </tr>
                <tr className="border-b border-border/30 bg-muted/10">
                  <td className="py-2.5 px-4 text-muted-foreground">Salary received</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatSalary(detailsA.incomingSalary)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatSalary(detailsB.incomingSalary)}
                  </td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="py-2.5 px-4 text-muted-foreground">Net change</td>
                  {[detailsA, detailsB].map((details) => (
                    <td
                      key={details.teamId}
                      className={cn(
                        "py-2.5 px-4 text-right font-mono font-semibold",
                        details.salaryDelta > 0 && "text-destructive",
                        details.salaryDelta < 0 && "text-green-500"
                      )}
                    >
                      {formatSignedSalary(details.salaryDelta)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/30 bg-muted/10">
                  <td className="py-2.5 px-4 text-muted-foreground">Roster after</td>
                  {[detailsA, detailsB].map((details) => (
                    <td
                      key={details.teamId}
                      className={cn(
                        "py-2.5 px-4 text-right font-mono",
                        (details.rosterSizeAfter < rosterMin ||
                          details.rosterSizeAfter > rosterMax) &&
                          "font-semibold text-destructive"
                      )}
                    >
                      {details.rosterSizeAfter}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-muted-foreground">
                    Payroll after
                    <span className="block text-xs">Cap {formatSalary(NBA_RULES.SALARY_CAP)}</span>
                  </td>
                  {[detailsA, detailsB].map((details) => (
                    <td
                      key={details.teamId}
                      className={cn(
                        "py-2.5 px-4 text-right font-mono",
                        details.isOverCapAfter && "font-semibold text-destructive"
                      )}
                    >
                      {formatSalary(details.newTotalSalary)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {hasPlayers && (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="py-2.5 px-4 text-left font-medium text-muted-foreground">
                    Player
                  </th>
                  <th className="py-2.5 px-2 text-center font-medium text-muted-foreground">Pos</th>
                  <th className="py-2.5 px-2 text-center font-medium text-muted-foreground hidden md:table-cell">
                    Exp
                  </th>
                  <th className="py-2.5 px-2 text-center font-medium text-muted-foreground hidden md:table-cell">
                    Ht
                  </th>
                  <th className="py-2.5 px-2 text-right font-medium text-muted-foreground">
                    Salary
                  </th>
                  <th className="py-2.5 px-2 text-center font-medium text-muted-foreground">Yrs</th>
                  <th className="py-2.5 px-2 text-center font-medium text-muted-foreground">
                    Morale
                  </th>
                  <th className="py-2.5 px-4 text-center font-medium text-muted-foreground">
                    Fatigue
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <GroupSection
                    key={group.label}
                    group={group}
                    pickById={pickById}
                    playerStateByPlayerId={playerStateByPlayerId}
                    seasonYear={seasonYear}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={!hasAssets || simulation?.isValid !== true || isExecuting}
          onClick={onExecute}
        >
          {isExecuting ? "Executing..." : "Execute trade"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface GroupSectionProps {
  group: {
    label: string;
    teamName: string;
    badgeVariant: "default" | "secondary";
    players: (TradeAsset & { player: NonNullable<TradeAsset["player"]> })[];
    picks: TradeAsset[];
  };
  pickById: Map<string, PickInventory>;
  playerStateByPlayerId: Map<string, PlayerState>;
  seasonYear: number;
}

function GroupSection({ group, pickById, playerStateByPlayerId, seasonYear }: GroupSectionProps) {
  const pickLabels = group.picks
    .map((asset) => (asset.pickId ? pickById.get(asset.pickId) : undefined))
    .filter((pick): pick is PickInventory => Boolean(pick))
    .map(formatPick);

  return (
    <>
      <tr className="border-b border-border/30 bg-muted/20">
        <td colSpan={8} className="py-2 px-4">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={group.badgeVariant}>{group.label}</Badge>
            <span className="text-xs font-medium text-muted-foreground">{group.teamName}</span>
            {pickLabels.length > 0 && (
              <span className="text-xs text-muted-foreground">
                + picks: {pickLabels.join(", ")}
              </span>
            )}
          </span>
        </td>
      </tr>
      {group.players.map((asset) => {
        const { player, contract } = asset;
        const state = playerStateByPlayerId.get(player.id);
        const yearsLeft = contract ? getYearsRemaining(seasonYear, contract.endYear) : null;

        return (
          <tr key={player.id} className="border-b border-border/30 last:border-0">
            <td className="py-2.5 px-4">
              <span className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {player.headshotUrl ? (
                    // biome-ignore lint/performance/noImgElement: no config next.config.js for remote patterns
                    <img src={player.headshotUrl} alt={player.fullName} loading="lazy" />
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {player.firstName[0]}
                      {player.lastName[0]}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap font-medium">{player.fullName}</span>
              </span>
            </td>
            <td className="py-2.5 px-2 text-center">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {player.position ?? "—"}
              </span>
            </td>
            <td className="py-2.5 px-2 text-center text-muted-foreground hidden md:table-cell">
              {player.yearsOfExperience}y
            </td>
            <td className="py-2.5 px-2 text-center text-muted-foreground hidden md:table-cell">
              {player.height ?? "—"}
            </td>
            <td className="py-2.5 px-2 text-right font-mono font-semibold">
              {formatSalary(contract?.salaryY1)}
            </td>
            <td className="py-2.5 px-2 text-center text-muted-foreground">
              {yearsLeft !== null ? `${yearsLeft}y` : "—"}
            </td>
            <td className="py-2.5 px-2">
              {state ? (
                <MeterBar value={state.morale} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="py-2.5 px-4">
              {state ? (
                <MeterBar value={state.fatigue} invert />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          </tr>
        );
      })}
      {group.players.length === 0 && (
        <tr className="border-b border-border/30">
          <td colSpan={8} className="py-2.5 px-4 text-sm text-muted-foreground">
            Picks only
          </td>
        </tr>
      )}
    </>
  );
}
