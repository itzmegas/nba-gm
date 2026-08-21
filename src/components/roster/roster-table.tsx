"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { Badge } from "@/components/ui/badge";
import {
  formatSalarySeasonLabel,
  getSalarySeasonYears,
  getYearsRemaining,
} from "@/domain/entities/Season";

function formatSalary(amount: number | null | undefined): string {
  if (!amount) return "—";
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
}

function getContractYearsLeft(baseSeasonYear: number, endYear: number): number {
  return getYearsRemaining(baseSeasonYear, endYear);
}

function getContractStatus(rosterPlayer: RosterPlayer, baseSeasonYear: number) {
  const { contract } = rosterPlayer;
  if (!contract)
    return { label: "Sin Contrato", variant: "destructive" as const, icon: AlertTriangle };

  const yearsLeft = getContractYearsLeft(baseSeasonYear, contract.endYear);

  if (contract.isPlayerOption)
    return { label: "Player Option", variant: "secondary" as const, icon: Clock };
  if (contract.isTeamOption)
    return { label: "Team Option", variant: "secondary" as const, icon: Clock };
  if (yearsLeft === 1)
    return { label: "Expiring", variant: "destructive" as const, icon: AlertTriangle };
  if (!contract.isGuaranteed)
    return { label: "Non-Guaranteed", variant: "outline" as const, icon: AlertTriangle };

  return { label: "Guaranteed", variant: "default" as const, icon: CheckCircle2 };
}

function ContractYearsBar({
  baseSeasonYear,
  endYear,
}: {
  baseSeasonYear: number;
  endYear: number;
}) {
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
      <span className="text-xs text-muted-foreground tabular-nums">{yearsLeft}a</span>
    </div>
  );
}

interface RosterTableProps {
  gameId: string;
  players: RosterPlayer[];
  seasonYear: number;
  leagueTeamId?: string;
}

export function RosterTable({ gameId, players, seasonYear, leagueTeamId }: RosterTableProps) {
  const router = useRouter();

  const salarySeasonYears = getSalarySeasonYears(seasonYear, 2);

  const sorted = [...players].sort((a, b) => {
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
            <th className="py-3 px-4 text-left font-medium text-muted-foreground">Jugador</th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-16">Pos</th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-20 hidden md:table-cell">
              Alt
            </th>
            <th className="py-3 px-2 text-right font-medium text-muted-foreground w-28">
              Salario {formatSalarySeasonLabel(salarySeasonYears[0])}
            </th>
            <th className="py-3 px-2 text-right font-medium text-muted-foreground w-28 hidden lg:table-cell">
              Salario {formatSalarySeasonLabel(salarySeasonYears[1])}
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-28 hidden md:table-cell">
              Duración
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-36">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ player, contract }, idx) => {
            const status = getContractStatus({ player, contract }, seasonYear);
            const StatusIcon = status.icon;
            const isEven = idx % 2 === 0;

            return (
              <tr
                key={player.id}
                onClick={() =>
                  router.push(
                    `/games/${gameId}/dashboard/player/${player.id}${leagueTeamId ? `?leagueTeamId=${encodeURIComponent(leagueTeamId)}` : ""}`
                  )
                }
                className={`border-b border-border/30 transition-colors hover:bg-muted/40 cursor-pointer ${isEven ? "" : "bg-muted/10"}`}
              >
                {/* Número camiseta */}
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {player.jerseyNumber ? `${player.jerseyNumber}` : "—"}
                </td>

                {/* Nombre y Foto */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                      {player.headshotUrl ? (
                        // biome-ignore lint/performance/noImgElement: no config next.config.js for remote patterns
                        <img src={player.headshotUrl} alt={player.fullName} loading="lazy" />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {player.firstName[0]}
                          {player.lastName[0]}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold whitespace-nowrap">{player.fullName}</span>
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
                  {formatSalary(contract?.salaryY1)}
                </td>

                {/* Salario Y2 */}
                <td className="py-3 px-4 text-right font-mono text-muted-foreground hidden lg:table-cell">
                  {formatSalary(contract?.salaryY2)}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
