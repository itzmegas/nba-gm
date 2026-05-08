"use client";

import { Users } from "lucide-react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useGameStore } from "@/application/stores/useGameStore";
import { useTeam } from "@/application/hooks/teams/useTeams";
import { useTeamStore } from "@/application/stores/useTeamStore";
import { RosterTable } from "@/components/roster/roster-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

const SALARY_CAP = 140_000_000;

function formatSalary(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}

export default function RosterPage() {
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const gameId = useGameStore((state) => state.lastSelectedGameId);
  const { data: team } = useTeam(selectedTeamId ?? "");
  const { data: rosterPlayers, isLoading } = useRoster(gameId, selectedTeamId);
  const { data: contracts } = useTeamContracts(gameId, selectedTeamId);

  const calculator = new SalaryCapCalculator();
  const financials = contracts ? calculator.getFinancialStatus(contracts) : null;

  const totalPlayers = rosterPlayers?.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Roster
        </h1>
        <p className="text-muted-foreground">
          {team?.city} {team?.name} — Temporada 2025-26
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Jugadores</p>
            <p className="text-2xl font-black mt-1">{totalPlayers}</p>
            <p className="text-xs text-muted-foreground">/ 15 máx</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Nómina Total</p>
            <p className="text-2xl font-black mt-1">
              {financials ? formatSalary(financials.totalSalary) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Cap: {formatSalary(SALARY_CAP)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cap Space</p>
            <p
              className={`text-2xl font-black mt-1 ${
                financials?.isOverCap ? "text-destructive" : "text-green-500"
              }`}
            >
              {financials
                ? financials.isOverCap
                  ? `-${formatSalary(financials.totalSalary - SALARY_CAP)}`
                  : formatSalary(financials.capSpace)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {financials?.isOverCap ? "OVER CAP" : "disponible"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Apron Status</p>
            <p className="text-2xl font-black mt-1">
              {financials?.apronStatus === "None" ? "Clean" : (financials?.apronStatus ?? "—")}
            </p>
            <p className="text-xs text-muted-foreground">
              {financials?.isOverLuxuryTax ? "Luxury Tax" : "Below tax"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Contratos Activos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {rosterPlayers && rosterPlayers.length > 0 ? (
            <RosterTable players={rosterPlayers} />
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              No hay jugadores en el roster.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
