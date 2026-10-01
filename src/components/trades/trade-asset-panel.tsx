"use client";

import { Bandage, Check, Ticket, Users } from "lucide-react";
import Image from "next/image";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerState } from "@/domain/entities/PlayerState";
import { getYearsRemaining } from "@/domain/entities/Season";
import type { PickInventory } from "@/domain/entities/Trade";
import { cn } from "@/utils/utils";
import { formatPick, formatSalary } from "./format";

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
}: TradeAssetPanelProps) {
  const selectedCount = selectedPlayerIds.length + selectedPickIds.length;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
            {teamLogoUrl ? (
              <Image src={teamLogoUrl} alt={`${teamName} logo`} width={40} height={40} />
            ) : (
              <Users className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{teamName}</span>
          {selectedCount > 0 && (
            <Badge variant="default" className="ml-auto">
              {selectedCount} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Players · {roster.length}
          </p>
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
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/40",
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

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Draft picks · {picks.length}
          </p>
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
      </CardContent>
    </Card>
  );
}
