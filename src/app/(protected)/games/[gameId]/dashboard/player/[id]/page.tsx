"use client";

import { Activity, AlertTriangle, ArrowLeft, DollarSign, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useContractsByPlayer } from "@/application/hooks/contracts/useContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { usePlayer } from "@/application/hooks/players/usePlayers";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatSalarySeasonLabel,
  getYearsRemaining,
  isCurrentSalarySeason,
} from "@/domain/entities/Season";

function formatSalary(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface GamePlayerDetailPageProps {
  params: Promise<{ gameId: string; id: string }>;
}

export default function GamePlayerDetailPage({ params }: GamePlayerDetailPageProps) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;
  const playerId = resolvedParams.id;
  const searchParams = useSearchParams();

  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const { data: player, isLoading: isLoadingPlayer } = usePlayer(playerId);
  const { data: contract, isLoading: isLoadingContract } = useContractsByPlayer(gameId, playerId);
  const { data: teams, isLoading: isLoadingTeams } = useTeams();
  const leagueTeamId = searchParams.get("leagueTeamId");
  const validLeagueTeamId =
    leagueTeamId && teams?.some((team) => team.id === leagueTeamId) ? leagueTeamId : null;
  const backHref = validLeagueTeamId
    ? `/games/${gameId}/dashboard/league?teamId=${encodeURIComponent(validLeagueTeamId)}`
    : `/games/${gameId}/dashboard/roster`;
  const backLabel = validLeagueTeamId ? "Volver a la liga" : "Volver al roster";

  if (isLoadingGame || isLoadingPlayer || isLoadingContract || isLoadingTeams) {
    return (
      <output aria-label="Cargando perfil" className="flex flex-col gap-5 animate-pulse">
        <span className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-md bg-muted" />
          <span className="h-8 w-48 bg-muted rounded-md" />
        </span>
        <span className="h-28 bg-muted rounded-md" />
        <span className="h-48 bg-muted rounded-md" />
      </output>
    );
  }

  if (!game || !player) {
    return (
      <div
        className={`${body.className} flex min-h-[50vh] flex-col items-center justify-center gap-4`}
      >
        <UserIcon className="h-16 w-16 text-muted-foreground opacity-50" />
        <p className="text-xl font-medium text-muted-foreground">Jugador no encontrado</p>
        <Button asChild variant="outline" className="rounded-sm">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    );
  }

  const yearsLeft = contract ? getYearsRemaining(game.seasonYear, contract.endYear) : 0;

  return (
    <div className={`${body.className} min-w-0 space-y-5`}>
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 gap-2 rounded-sm text-muted-foreground"
        >
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col items-start gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:gap-5">
        <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/30">
          <PlayerHeadshot
            src={player.headshotUrl}
            alt={player.fullName}
            className="h-full w-full object-cover object-top"
            loading="eager"
          />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
            </span>
            <h1
              className={`${display.className} min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-4xl`}
            >
              {player.fullName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 [&_[data-slot=badge]]:rounded-sm">
            <Badge variant="secondary">{player.position ?? "Sin posición"}</Badge>
            <Badge variant="outline">{player.height ? `${player.height}` : "Altura desc."}</Badge>
            <Badge variant="outline">{player.weight ? `${player.weight} lbs` : "Peso desc."}</Badge>
            {!player.isActive && <Badge variant="destructive">Inactivo</Badge>}
          </div>
        </div>
      </div>

      <Card className="min-w-0 gap-4 rounded-md border-border/60 bg-card py-4 shadow-none [&_[data-slot=table-container]]:rounded-md">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle
            className={`${display.className} flex items-center gap-2 text-lg font-semibold`}
          >
            <DollarSign className="size-4 text-primary" />
            Detalles del Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          {contract ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Duración</dt>
                  <dd className={`${display.className} text-xl font-semibold tabular-nums`}>
                    {yearsLeft} {yearsLeft === 1 ? "año" : "años"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Inicio - Fin</dt>
                  <dd className={`${display.className} text-xl font-semibold tabular-nums`}>
                    {contract.startYear} - {contract.endYear}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Garantizado</dt>
                  <dd className="font-semibold">
                    {contract.isGuaranteed == null
                      ? "Desconocido"
                      : contract.isGuaranteed
                        ? "Sí"
                        : "No"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs text-muted-foreground">Opciones</dt>
                  <dd className="font-semibold">
                    {contract.isPlayerOption
                      ? "Player"
                      : contract.isTeamOption
                        ? "Team"
                        : "Ninguna"}
                  </dd>
                </div>
              </dl>

              <AppTable aria-label="Salarios por temporada">
                <AppTableHeader>
                  <AppTableRow>
                    <AppTableHead>Temporada</AppTableHead>
                    <AppTableHead className="text-right">Salario Base</AppTableHead>
                  </AppTableRow>
                </AppTableHeader>
                <tbody className="tabular-nums">
                  {[
                    { year: contract.startYear, salary: contract.salaryY1 },
                    { year: contract.startYear + 1, salary: contract.salaryY2 },
                    { year: contract.startYear + 2, salary: contract.salaryY3 },
                    { year: contract.startYear + 3, salary: contract.salaryY4 },
                    { year: contract.startYear + 4, salary: contract.salaryY5 },
                  ]
                    .filter(
                      (yearSalary) =>
                        yearSalary.salary !== undefined &&
                        yearSalary.salary !== null &&
                        yearSalary.year <= contract.endYear
                    )
                    .map((yearSalary) => {
                      const isCurrentSeason = isCurrentSalarySeason(
                        game.seasonYear,
                        yearSalary.year
                      );

                      return (
                        <AppTableRow
                          key={yearSalary.year}
                          data-state={isCurrentSeason ? "selected" : undefined}
                        >
                          <AppTableCell className="whitespace-nowrap font-medium">
                            {formatSalarySeasonLabel(yearSalary.year)}
                            {isCurrentSeason && (
                              <span className="ml-2 text-xs text-primary">Actual</span>
                            )}
                          </AppTableCell>
                          <AppTableCell className="whitespace-nowrap text-right font-mono">
                            {formatSalary(yearSalary.salary)}
                          </AppTableCell>
                        </AppTableRow>
                      );
                    })}
                </tbody>
              </AppTable>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
              <p>El jugador actualmente no posee contrato.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <section
        aria-label="Estadísticas y Scouting"
        className="space-y-2 rounded-md border border-border/60 p-4"
      >
        <h2 className={`${display.className} flex items-center gap-2 text-lg font-semibold`}>
          <Activity className="size-4 text-muted-foreground" />
          Estadísticas y Scouting
        </h2>
        <p className="text-sm text-muted-foreground">
          Las estadísticas y el scouting no están disponibles en esta vista.
        </p>
      </section>
    </div>
  );
}
