"use client";

import { ArrowRightLeft, Bandage, Check, Ticket, Users } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { display } from "@/app/ui-preview/fonts";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { useT } from "@/application/providers/I18nProvider";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { formatPick, formatSalary } from "@/components/trades/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  disabled?: boolean;
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
  disabled = false,
}: TradeAssetPanelProps) {
  const t = useT();
  const searchId = useId();
  const [view, setView] = useState<"roster" | "picks">("roster");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleRoster = roster.filter(({ player }) =>
    player.fullName.toLocaleLowerCase().includes(query)
  );
  const visiblePicks = picks.filter((pick) => formatPick(pick).toLocaleLowerCase().includes(query));
  const outgoingSalary = roster.reduce(
    (total, { player, contract }) =>
      total + (selectedPlayerIds.includes(player.id) ? (contract?.salaryY1 ?? 0) : 0),
    0
  );
  const selectedCount = selectedPlayerIds.length + selectedPickIds.length;
  const thresholds = getSalaryCapThresholds(seasonYear);
  const limits = [
    { label: t("trades", "cap"), amount: thresholds.salaryCap },
    { label: t("trades", "tax"), amount: thresholds.luxuryTax },
    { label: t("trades", "firstApron"), amount: thresholds.firstApron },
    { label: t("trades", "secondApron"), amount: thresholds.secondApron },
  ];
  const meterMax = Math.max(thresholds.secondApron * 1.1, payroll ?? 0);

  return (
    <section
      aria-label={`${teamName} trade assets`}
      className="min-w-0 overflow-hidden rounded-[5px] border border-border bg-card"
    >
      <div
        className={cn(
          "flex min-h-20 items-center gap-2.5 border-b p-4",
          isPartner ? "border-border bg-muted/40" : "border-primary/25 bg-primary/10"
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden text-primary">
          {teamLogoUrl ? (
            <Image src={teamLogoUrl} alt={`${teamName} logo`} width={40} height={40} />
          ) : (
            <Users className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
            {t("trades", isPartner ? "partner" : "franchise")}
          </p>
          <h2
            className={`${display.className} break-words text-[28px] font-semibold leading-none tracking-tight`}
          >
            {teamName}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {payroll === null
              ? t("trades", "loadingFinances")
              : payroll > thresholds.salaryCap
                ? t("trades", "overCap")
                : t("trades", "underCap")}
          </p>
        </div>
        {selectedCount > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {selectedCount} {t("trades", "selected")}
          </span>
        )}
      </div>
      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("trades", "payroll")}
          </p>
          <p className={`${display.className} text-2xl font-medium tabular-nums`}>
            {payroll === null ? "—" : payroll === 0 ? "$0" : formatSalary(payroll)}
          </p>
          <div aria-hidden="true" className="relative my-2 h-1 rounded-sm bg-muted">
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
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd
                  className={cn(
                    "mt-1 text-xs font-bold tabular-nums",
                    payroll !== null &&
                      (payroll > amount
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-400")
                  )}
                >
                  {formatSalary(amount)}
                  <span className="mt-1 block text-[10px] font-normal">
                    {payroll === null
                      ? "—"
                      : `${payroll > amount ? t("trades", "over") : t("trades", "room")} ${formatSalary(Math.abs(amount - payroll))}`}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-h-20 rounded-[4px] border border-primary/25 bg-primary/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <ArrowRightLeft className="size-3" />
            {teamName} {t("trades", "receives")}
          </p>
          {incomingAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("trades", "incomingHint")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {incomingAssets.map((asset) => {
                const pick = asset.pickId ? pickById.get(asset.pickId) : undefined;
                return (
                  <li
                    key={asset.player?.id ?? asset.pickId}
                    className="max-w-full break-words rounded-[3px] border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] font-medium"
                  >
                    {asset.player?.fullName ?? (pick ? formatPick(pick) : t("trades", "pick"))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-1 px-3 pb-3" aria-label={`${teamName} asset view`}>
        <Button
          variant={view === "roster" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === "roster"}
          onClick={() => setView("roster")}
        >
          {t("trades", "roster")} · {roster.length}
        </Button>
        <Button
          variant={view === "picks" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === "picks"}
          onClick={() => setView("picks")}
        >
          {t("trades", "picks")} · {picks.length}
        </Button>
      </fieldset>
      <label
        htmlFor={searchId}
        className="flex items-center gap-2 border-b px-3 pb-3 text-xs text-muted-foreground"
      >
        {t("trades", "search")}
        <Input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("trades", "searchPlaceholder")}
          className="h-8 min-w-0 rounded-[3px] text-xs"
        />
      </label>
      <div
        aria-hidden="true"
        className="flex gap-2 border-b bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <span className="flex-1">
          {view === "roster" ? t("trades", "playerExperience") : t("trades", "pick")}
        </span>
        {view === "roster" && <span className="w-7 text-right">OVR</span>}
        <span className="w-16 text-right">{t("trades", "salary")}</span>
        <span className="w-[18px]" />
      </div>
      <div className="h-[420px] overflow-y-auto overscroll-contain">
        {view === "roster" && (
          <div className="divide-y divide-border/50">
            {visibleRoster.length === 0 && (
              <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                {t("trades", roster.length === 0 ? "noPlayers" : "noMatches")}
              </p>
            )}
            {visibleRoster.map(({ player, contract, ratings }) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              const isTradeable = Boolean(contract);
              const isInjured = playerStateByPlayerId.get(player.id)?.isInjured ?? false;
              const yearsLeft = contract ? getYearsRemaining(seasonYear, contract.endYear) : null;

              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={!isTradeable || disabled}
                  aria-pressed={isSelected}
                  onClick={() => onTogglePlayer(player.id)}
                  className={cn(
                    "flex min-h-[58px] w-full items-center gap-2 border border-transparent px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/40",
                    !isTradeable && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-muted">
                    <PlayerHeadshot
                      src={player.headshotUrl}
                      alt={player.fullName}
                      className="size-full object-cover"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="break-words text-xs font-medium">{player.fullName}</span>
                      {isInjured && (
                        <Badge variant="destructive" className="shrink-0">
                          <Bandage data-icon="inline-start" />
                          {t("trades", "injured")}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {player.position ?? "—"}
                      </span>
                      <span>
                        {player.yearsOfExperience}
                        {t("trades", "experience")}
                      </span>
                      {!isTradeable && (
                        <span className="text-destructive">{t("trades", "noContract")}</span>
                      )}
                    </span>
                  </span>

                  <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">
                    <span className="sr-only">{t("playerAttributes", "overall")}: </span>
                    {ratings?.overall ?? "—"}
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <span className="block text-xs font-medium tabular-nums">
                      {formatSalary(contract?.salaryY1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {yearsLeft !== null ? `${yearsLeft}${t("trades", "yearsLeft")}` : " "}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border transition-colors",
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
            {visiblePicks.length === 0 && (
              <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                {t("trades", picks.length === 0 ? "noPicks" : "noMatches")}
              </p>
            )}
            <div className="grid gap-2">
              {visiblePicks.map((pick) => {
                const isSelected = selectedPickIds.includes(pick.id);
                return (
                  <button
                    key={pick.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    onClick={() => onTogglePick(pick.id)}
                    className={cn(
                      "flex min-h-[58px] items-center gap-2 rounded-[3px] border p-2.5 text-left text-xs transition-colors",
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
      <div className="flex flex-wrap justify-between gap-2 border-t px-3 py-2.5 text-[11px] text-muted-foreground">
        <span>
          {selectedCount} {t("trades", "selected")}
        </span>
        <strong className="font-medium tabular-nums text-foreground">
          {t("trades", "sending")} {formatSalary(outgoingSalary)}
        </strong>
      </div>
    </section>
  );
}
