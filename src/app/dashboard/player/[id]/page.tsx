"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  DollarSign,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { useContractsByPlayer } from "@/application/hooks/contracts/useContracts";
import { usePlayer } from "@/application/hooks/players/usePlayers";
import { useGameStore } from "@/application/stores/useGameStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CURRENT_SEASON_YEAR = 2025;

function formatSalary(amount: number | null | undefined): string {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Desempaquetamos la promesa de `params` (React 19 pattern para Next.js 15)
  const resolvedParams = use(params);
  const playerId = resolvedParams.id;
  const gameId = useGameStore((state) => state.lastSelectedGameId);

  const { data: player, isLoading: isLoadingPlayer } = usePlayer(playerId);
  const { data: contract, isLoading: isLoadingContract } = useContractsByPlayer(gameId, playerId);

  if (isLoadingPlayer || isLoadingContract) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-muted" />
          <div className="h-8 w-48 bg-muted rounded-md" />
        </div>
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <UserIcon className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-xl font-medium text-muted-foreground">Jugador no encontrado</p>
        <Link href="/dashboard/roster">
          <Button variant="outline">Volver al roster</Button>
        </Link>
      </div>
    );
  }

  const yearsLeft = contract ? Math.max(0, contract.endYear - CURRENT_SEASON_YEAR + 1) : 0;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header Back Button */}
      <div>
        <Link href="/dashboard/roster">
          <Button variant="ghost" size="sm" className="gap-2 -ml-3 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver al roster
          </Button>
        </Link>
      </div>

      {/* Header Profile */}
      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
        {/* Headshot */}
        <div className="relative shrink-0 w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden bg-muted/30 border-4 border-background shadow-lg flex items-center justify-center">
          {player.headshotUrl ? (
            // biome-ignore lint/performance/noImgElement: no config next.config.js for remote patterns
            <img
              src={player.headshotUrl}
              alt={player.fullName}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <UserIcon className="h-16 w-16 text-muted-foreground opacity-30" />
          )}
        </div>

        {/* Info principal */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground font-mono text-xl font-medium">
              {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">{player.fullName}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
              {player.position ?? "Sin posición"}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-sm text-muted-foreground">
              {player.height ? `${player.height}` : "Altura desc."}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-sm text-muted-foreground">
              {player.weight ? `${player.weight} lbs` : "Peso desc."}
            </Badge>
            {!player.isActive && (
              <Badge variant="destructive" className="px-3 py-1 text-sm">
                Inactivo
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        {/* Situación Contractual */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Detalles del Contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contract ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Duración</p>
                    <p className="font-semibold">
                      {yearsLeft} {yearsLeft === 1 ? "año" : "años"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Inicio - Fin</p>
                    <p className="font-semibold">
                      {contract.startYear} - {contract.endYear}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Garantizado</p>
                    <p className="font-semibold">{contract.isGuaranteed ? "Sí" : "No"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Opciones</p>
                    <p className="font-semibold">
                      {contract.isPlayerOption
                        ? "Player"
                        : contract.isTeamOption
                          ? "Team"
                          : "Ninguna"}
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-2 text-left font-medium">Temporada</th>
                        <th className="px-4 py-2 text-right font-medium">Salario Base</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono">
                      {[
                        { year: contract.startYear, salary: contract.salaryY1 },
                        { year: contract.startYear + 1, salary: contract.salaryY2 },
                        { year: contract.startYear + 2, salary: contract.salaryY3 },
                        { year: contract.startYear + 3, salary: contract.salaryY4 },
                        { year: contract.startYear + 4, salary: contract.salaryY5 },
                      ]
                        .filter(
                          (y) =>
                            y.salary !== undefined &&
                            y.salary !== null &&
                            y.year <= contract.endYear
                        )
                        .map((y) => (
                          <tr
                            key={y.year}
                            className={y.year === CURRENT_SEASON_YEAR ? "bg-primary/5" : ""}
                          >
                            <td className="px-4 py-3 font-medium">
                              {y.year}-{String(y.year + 1).slice(-2)}
                              {y.year === CURRENT_SEASON_YEAR && (
                                <span className="ml-2 text-xs font-sans text-primary">Actual</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">{formatSalary(y.salary)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                <p>El jugador actualmente no posee contrato.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info extra placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Estadísticas y Scouting
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground border-t">
            <Calendar className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center max-w-[250px]">
              El motor de simulación aún no generó estadísticas para esta temporada.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
