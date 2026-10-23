"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { createT } from "@/application/i18n/createT";
import type { Locale } from "@/application/i18n/types";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { ReleasePlayerButton } from "@/components/roster/release-player-button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableActions } from "@/components/ui/table-actions";
import { CONTRACT_IDENTITY_RESOLUTION_STATUS } from "@/domain/contracts/GameContract";
import { CONTRACT_ORIGIN } from "@/domain/entities/Contract";
import {
  formatSalarySeasonLabel,
  getSalarySeasonYears,
  getYearsRemaining,
} from "@/domain/entities/Season";

export function formatRosterSalary(
  amount: number | null | undefined,
  locale: Locale = "en"
): string {
  if (amount === null || amount === undefined) return createT(locale)("dashboard", "unknownValue");
  const millions = amount >= 1_000_000;
  const formatted = new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: millions ? 1 : 0,
    maximumFractionDigits: millions ? 1 : 3,
  }).format(millions ? amount / 1_000_000 : amount);
  return millions ? `${formatted}M` : formatted;
}

export function getRosterContractClassification(
  rosterPlayer: RosterPlayer,
  locale: Locale = "en"
): {
  label: string;
  title: string;
} {
  const t = createT(locale);
  const state = rosterPlayer.gameContract;
  if (rosterPlayer.contract?.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT) {
    return {
      label: t("dashboard", "contractStandard"),
      title: t("dashboard", "simulatedContractDescription"),
    };
  }
  if (state?.contractType === "two-way")
    return {
      label: t("dashboard", "contractTwoWay"),
      title: t("dashboard", "twoWayContractDescription"),
    };
  if (state?.estimated)
    return {
      label: t("dashboard", "contractEstimated"),
      title: t("dashboard", "estimatedContractDescription"),
    };
  if (
    state?.resolutionStatus === CONTRACT_IDENTITY_RESOLUTION_STATUS.OBSERVED_STANDARD &&
    state.contractType === "standard" &&
    state.provenanceQuality === "observed"
  ) {
    return {
      label: t("dashboard", "contractStandard"),
      title: t("dashboard", "observedContractDescription"),
    };
  }
  return {
    label: t("dashboard", "unknownValue"),
    title: t("dashboard", "unknownContractDescription"),
  };
}

export function shouldRenderRosterPlayer(rosterPlayer: RosterPlayer): boolean {
  return (
    rosterPlayer.contract?.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT ||
    rosterPlayer.gameContract?.resolutionStatus !==
      CONTRACT_IDENTITY_RESOLUTION_STATUS.INACTIVE_EXCLUDED
  );
}

function getContractYearsLeft(baseSeasonYear: number, endYear: number): number {
  return getYearsRemaining(baseSeasonYear, endYear);
}

export function getContractStatus(
  rosterPlayer: RosterPlayer,
  baseSeasonYear: number,
  locale: Locale
) {
  const t = createT(locale);
  const { contract } = rosterPlayer;
  if (!contract)
    return {
      label: t("dashboard", "contractUnavailable"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };

  const yearsLeft = getContractYearsLeft(baseSeasonYear, contract.endYear);

  if (contract.isPlayerOption)
    return {
      label: t("dashboard", "contractPlayerOption"),
      variant: "secondary" as const,
      icon: Clock,
    };
  if (contract.isTeamOption)
    return {
      label: t("dashboard", "contractTeamOption"),
      variant: "secondary" as const,
      icon: Clock,
    };
  if (yearsLeft === 1)
    return {
      label: t("dashboard", "contractExpiring"),
      variant: "destructive" as const,
      icon: AlertTriangle,
    };
  if (contract.isGuaranteed === false)
    return {
      label: t("dashboard", "contractNonGuaranteed"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };
  if (contract.isGuaranteed !== true)
    return {
      label: t("dashboard", "contractGuaranteeUnknown"),
      variant: "outline" as const,
      icon: AlertTriangle,
    };

  return {
    label: t("dashboard", "contractGuaranteed"),
    variant: "default" as const,
    icon: CheckCircle2,
  };
}

function ContractYearsBar({
  baseSeasonYear,
  endYear,
}: {
  baseSeasonYear: number;
  endYear: number;
}) {
  const t = useT();
  const yearsLeft = getContractYearsLeft(baseSeasonYear, endYear);
  const maxYears = 5;
  const pct = Math.min((yearsLeft / maxYears) * 100, 100);

  let barColor = "bg-primary";
  if (yearsLeft === 1) barColor = "bg-destructive";
  else if (yearsLeft === 2) barColor = "bg-orange-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {yearsLeft}
        {t("dashboard", "yearsShort")}
      </span>
    </div>
  );
}

interface RosterTableProps {
  gameId: string;
  players: RosterPlayer[];
  seasonYear: number;
  leagueTeamId?: string;
  canRelease?: boolean;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string;
}

export function RosterTable({
  gameId,
  players,
  seasonYear,
  leagueTeamId,
  canRelease = false,
  onSelectPlayer,
  selectedPlayerId,
}: RosterTableProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  const salarySeasonYears = getSalarySeasonYears(seasonYear, 2);

  const sorted = players.filter(shouldRenderRosterPlayer).sort((a, b) => {
    const sa = a.contract?.salaryY1 ?? 0;
    const sb = b.contract?.salaryY1 ?? 0;
    return sb - sa;
  });

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="py-3 px-4 text-left font-medium text-muted-foreground w-8">#</th>
            <th className="py-3 px-4 text-left font-medium text-muted-foreground">
              {t("dashboard", "rosterPlayer")}
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-16">
              {t("dashboard", "rosterPosition")}
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-20 hidden md:table-cell">
              {t("dashboard", "rosterHeight")}
            </th>
            <th className="py-3 px-2 text-right font-medium text-muted-foreground w-28">
              {t("dashboard", "rosterSalary")} {formatSalarySeasonLabel(salarySeasonYears[0])}
            </th>
            <th className="py-3 px-2 text-right font-medium text-muted-foreground w-28 hidden lg:table-cell">
              {t("dashboard", "rosterSalary")} {formatSalarySeasonLabel(salarySeasonYears[1])}
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-28 hidden md:table-cell">
              {t("dashboard", "rosterDuration")}
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-36">
              {t("dashboard", "rosterStatus")}
            </th>
            <th className="py-3 px-4 text-right font-medium text-muted-foreground">
              {t("dashboard", "rosterActions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rosterPlayer, idx) => {
            const { player, contract } = rosterPlayer;
            const status = getContractStatus(rosterPlayer, seasonYear, locale);
            const classification = getRosterContractClassification(rosterPlayer, locale);
            const StatusIcon = status.icon;
            const isEven = idx % 2 === 0;

            return (
              <tr
                key={player.id}
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest("button, [role=menu]")
                  )
                    return;
                  if (onSelectPlayer) onSelectPlayer(player.id);
                  else
                    router.push(
                      `/games/${gameId}/dashboard/player/${player.id}${leagueTeamId ? `?leagueTeamId=${encodeURIComponent(leagueTeamId)}` : ""}`
                    );
                }}
                data-state={selectedPlayerId === player.id ? "selected" : undefined}
                className={`border-b border-border/30 transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/10 ${onSelectPlayer ? "cursor-pointer" : ""} ${isEven ? "" : "bg-muted/10"}`}
              >
                {/* Número camiseta */}
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {player.jerseyNumber ? `${player.jerseyNumber}` : "—"}
                </td>

                {/* Nombre y Foto */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                      <PlayerHeadshot
                        src={player.headshotUrl}
                        alt={player.fullName}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="font-semibold whitespace-nowrap hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                        aria-pressed={onSelectPlayer ? selectedPlayerId === player.id : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (onSelectPlayer) onSelectPlayer(player.id);
                          else
                            router.push(
                              `/games/${gameId}/dashboard/player/${player.id}${leagueTeamId ? `?leagueTeamId=${encodeURIComponent(leagueTeamId)}` : ""}`
                            );
                        }}
                      >
                        {player.fullName}
                      </button>
                      <Badge variant="outline" title={classification.title}>
                        {classification.label}
                      </Badge>
                    </div>
                  </div>
                </td>

                {/* Posición */}
                <td className="py-3 px-2 text-center">
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {player.position ?? "—"}
                  </span>
                </td>

                {/* Altura */}
                <td className="py-3 px-4 text-center text-muted-foreground hidden md:table-cell">
                  {player.height ?? "—"}
                </td>

                {/* Salario Y1 */}
                <td className="py-3 px-4 text-right font-mono font-semibold">
                  {formatRosterSalary(contract?.salaryY1, locale)}
                </td>

                {/* Salario Y2 */}
                <td className="py-3 px-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                  {formatRosterSalary(contract?.salaryY2, locale)}
                </td>

                {/* Barra de años */}
                <td className="py-3 px-4 hidden md:table-cell">
                  {contract ? (
                    <div className="flex justify-center">
                      <ContractYearsBar baseSeasonYear={seasonYear} endYear={contract.endYear} />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-center block">—</span>
                  )}
                </td>

                {/* Estado del contrato */}
                <td className="py-3 px-4 text-center">
                  <Badge
                    variant={status.variant}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <TableActions label={`${t("dashboard", "rosterActions")} — ${player.fullName}`}>
                    <DropdownMenuItem
                      onSelect={() =>
                        router.push(
                          `/games/${gameId}/dashboard/player/${player.id}${leagueTeamId ? `?leagueTeamId=${encodeURIComponent(leagueTeamId)}` : ""}`
                        )
                      }
                    >
                      {t("dashboard", "viewPlayer")}
                    </DropdownMenuItem>
                    {canRelease && (
                      <ReleasePlayerButton gameId={gameId} rosterPlayer={rosterPlayer} asMenuItem />
                    )}
                  </TableActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
