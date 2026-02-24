"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { Badge } from "@/components/ui/badge";

const CURRENT_SEASON_YEAR = 2025;

function formatSalary(amount: number | null | undefined): string {
  if (!amount) return "—";
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
}

function getContractYearsLeft(endYear: number): number {
  return Math.max(0, endYear - CURRENT_SEASON_YEAR + 1);
}

function getContractStatus(rosterPlayer: RosterPlayer) {
  const { contract } = rosterPlayer;
  if (!contract)
    return { label: "Sin Contrato", variant: "destructive" as const, icon: AlertTriangle };

  const yearsLeft = getContractYearsLeft(contract.endYear);

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

function ContractYearsBar({ endYear }: { endYear: number }) {
  const yearsLeft = getContractYearsLeft(endYear);
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
  players: RosterPlayer[];
}

export function RosterTable({ players }: RosterTableProps) {
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
            <th className="py-3 px-4 text-right font-medium text-muted-foreground w-28">
              Salario 25-26
            </th>
            <th className="py-3 px-4 text-right font-medium text-muted-foreground w-28 hidden lg:table-cell">
              Salario 26-27
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-28 hidden md:table-cell">
              Duración
            </th>
            <th className="py-3 px-4 text-center font-medium text-muted-foreground w-36">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ player, contract }, idx) => {
            const status = getContractStatus({ player, contract });
            const StatusIcon = status.icon;
            const isEven = idx % 2 === 0;

            return (
              <tr
                key={player.id}
                className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${isEven ? "" : "bg-muted/10"}`}
              >
                {/* Número camiseta */}
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {player.jerseyNumber ? `${player.jerseyNumber}` : "—"}
                </td>

                {/* Nombre */}
                <td className="py-3 px-4">
                  <span className="font-semibold">{player.fullName}</span>
                </td>

                {/* Posición */}
                <td className="py-3 px-4 text-center">
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
                      <ContractYearsBar endYear={contract.endYear} />
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
