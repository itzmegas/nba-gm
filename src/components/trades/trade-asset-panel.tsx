"use client";

import { ArrowRightLeft, Bandage, Check, Ticket, Users } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { formatPick, formatSalary } from "@/components/trades/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { getYearsRemaining } from "@/domain/entities/Season";
import type { PickInventory, TradeAsset } from "@/domain/entities/Trade";
import { cn } from "@/utils/utils";

interface TradeAssetPanelProps {
  teamName: string;
  teamLogoUrl?: string;
  roster: RosterPlayer[];
  picks: PickInventory[];
  playerStateByPlayerId: Map<string, PlayerState>;
  selectedPlayerIds: string[];
  selectedPickIds: string[];
  onTogglePlayer: (playerId: string) => void;
  onTogglePick: (pickId: string) => void;
  seasonYear: number;
  payroll: number | null;
  incomingAssets: TradeAsset[];
  pickById: Map<string, PickInventory>;
  isPartner?: boolean;
}

export function TradeAssetPanel({
  teamName,
  teamLogoUrl,
  roster,
  picks,
  playerStateByPlayerId,
  selectedPlayerIds,
  selectedPickIds,
  onTogglePlayer,
  onTogglePick,
  seasonYear,
  payroll,
  incomingAssets,
  pickById,
  isPartner = false,
}: TradeAssetPanelProps) {
  const [view, setView] = useState<"roster" | "picks">("roster");
  const selectedCount = selectedPlayerIds.length + selectedPickIds.length;
  const thresholds = getSalaryCapThresholds(seasonYear);
  const limits = [
    { label: "Cap", amount: thresholds.salaryCap },
    { label: "Tax", amount: thresholds.luxuryTax },
    { label: "1st apron", amount: thresholds.firstApron },
    { label: "2nd apron", amount: thresholds.secondApron },
  ];
  const meterMax = Math.max(thresholds.secondApron * 1.1, payroll ?? 0);

  return (
    <section
      aria-label={`${teamName} trade assets`}
      className="min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card"
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b p-4",
          isPartner
            ? "border-sky-500/25 bg-gradient-to-r from-sky-500/20 to-sky-500/5"
            : "border-primary/25 bg-gradient-to-r from-primary/20 to-primary/5"
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
          {teamLogoUrl ? (
            <Image src={teamLogoUrl} alt={`${teamName} logo`} width={40} height={40} />
          ) : (
            <Users className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{teamName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {payroll === null
              ? "Loading finances…"
              : payroll > thresholds.salaryCap
                ? "Over the cap"
                : "Under the cap"}
          </p>
        </div>
        {selectedCount > 0 && (
          <Badge variant="default" className="ml-auto">
            {selectedCount} selected
          </Badge>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Payroll
          </p>
          <p className="text-xl font-black tabular-nums">
            {payroll === null ? "—" : payroll === 0 ? "$0" : formatSalary(payroll)}
          </p>
          <div aria-hidden="true" className="relative my-2 h-2 rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", isPartner ? "bg-sky-500" : "bg-primary")}
              style={{ width: `${((payroll ?? 0) / meterMax) * 100}%` }}
            />
            {limits.map(({ label, amount }) => (
              <span
                key={label}
                className="absolute -top-0.5 h-3 w-px bg-foreground/50"
                style={{ left: `${(amount / meterMax) * 100}%` }}
              />
            ))}
          </div>
          <dl className="grid grid-cols-4 gap-2">
            {limits.map(({ label, amount }) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd
                  className={cn(
                    "mt-1 text-xs font-bold tabular-nums",
                    payroll !== null && (payroll > amount ? "text-destructive" : "text-emerald-500")
                  )}
                >
                  {payroll === null
                    ? "—"
                    : `${payroll > amount ? "Over" : "Room"} ${payroll === amount ? "$0" : formatSalary(Math.abs(amount - payroll))}`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-h-24 rounded-xl border border-dashed border-border/70 bg-background/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <ArrowRightLeft className="size-3" />
            {teamName} receive
          </p>
          {incomingAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Select players or picks from the other team to send them here.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {incomingAssets.map((asset) => {
                const pick = asset.pickId ? pickById.get(asset.pickId) : undefined;
                return (
                  <li
                    key={asset.player?.id ?? asset.pickId}
                    className="rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs font-medium"
                  >
                    {asset.player?.fullName ?? (pick ? formatPick(pick) : "Draft pick")}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <fieldset className="flex gap-2 border-b px-4 pb-2" aria-label={`${teamName} asset view`}>
        <Button
          variant={view === "roster" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === "roster"}
          onClick={() => setView("roster")}
        >
          Roster · {roster.length}
        </Button>
        <Button
          variant={view === "picks" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === "picks"}
          onClick={() => setView("picks")}
        >
          Picks · {picks.length}
        </Button>
      </fieldset>
      <div className="max-h-[32rem] overflow-y-auto overscroll-contain p-2">
        {view === "roster" && (
          <div className="divide-y divide-border/50">
            {roster.length === 0 && (
              <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                No players on roster
              </p>
            )}
            {roster.map(({ player, contract }) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              const isTradeable = Boolean(contract);
              const isInjured = playerStateByPlayerId.get(player.id)?.isInjured ?? false;
              const yearsLeft = contract ? getYearsRemaining(seasonYear, contract.endYear) : null;

              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={!isTradeable}
                  aria-pressed={isSelected}
                  onClick={() => onTogglePlayer(player.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/40",
                    !isTradeable && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    <PlayerHeadshot
                      src={player.headshotUrl}
                      alt={player.fullName}
                      className="size-full object-cover"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{player.fullName}</span>
                      {isInjured && (
                        <Badge variant="destructive" className="shrink-0">
                          <Bandage data-icon="inline-start" />
                          Injured
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {player.position ?? "—"}
                      </span>
                      <span>{player.yearsOfExperience}y exp</span>
                      {!isTradeable && <span className="text-destructive">No contract</span>}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-semibold">
                      {formatSalary(contract?.salaryY1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {yearsLeft !== null ? `${yearsLeft}y left` : " "}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {view === "picks" && (
          <div className="space-y-2 p-2">
            {picks.length === 0 && (
              <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                No transferable picks
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {picks.map((pick) => {
                const isSelected = selectedPickIds.includes(pick.id);
                return (
                  <button
                    key={pick.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onTogglePick(pick.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <Ticket
                      className={cn(
                        "size-4 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="flex-1 font-medium">{formatPick(pick)}</span>
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && <Check className="size-2.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
