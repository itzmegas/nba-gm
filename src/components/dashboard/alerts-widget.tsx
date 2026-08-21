"use client";

import { AlertCircle, Bandage, CheckCircle, Clock } from "lucide-react";
import { usePlayerStates } from "@/application/hooks/player-states/usePlayerStates";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { formatSalary } from "@/components/trades/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AlertsWidgetProps {
  gameId: string;
  teamId: string;
  seasonYear: number;
}

const MAX_VISIBLE = 3;

export function AlertsWidget({ gameId, teamId, seasonYear }: AlertsWidgetProps) {
  const { data: roster, isLoading: isLoadingRoster } = useRoster(gameId, teamId);
  const { data: playerStates, isLoading: isLoadingStates } = usePlayerStates(gameId, teamId);

  if (isLoadingRoster || isLoadingStates) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded-md w-full" />
            <div className="h-10 bg-muted rounded-md w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiring = (roster ?? []).filter(({ contract }) => contract?.endYear === seasonYear);
  const injuredIds = new Set(
    (playerStates ?? []).filter((state) => state.isInjured).map((state) => state.playerId)
  );
  const injured = (roster ?? []).filter(({ player }) => injuredIds.has(player.id));
  const hasAlerts = expiring.length > 0 || injured.length > 0;

  return (
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Alertas de Roster
          {hasAlerts && (
            <Badge variant="secondary" className="ml-auto">
              {expiring.length + injured.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!hasAlerts ? (
          <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            <span>Todo en orden. No hay alertas críticas.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {injured.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Bandage className="h-3 w-3 text-destructive" /> Lesionados
                  <span className="ml-auto rounded-full bg-destructive/10 px-1.5 text-destructive">
                    {injured.length}
                  </span>
                </h4>
                <div className="space-y-2">
                  {injured.slice(0, MAX_VISIBLE).map(({ player }) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2.5 text-sm p-2 rounded-md bg-destructive/10 border border-destructive/20"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-medium text-muted-foreground">
                        {player.firstName[0]}
                        {player.lastName[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{player.lastName}</span>
                      <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                        {player.position ?? "—"}
                      </span>
                    </div>
                  ))}
                  {injured.length > MAX_VISIBLE && (
                    <div className="text-xs text-center text-muted-foreground pt-1">
                      + {injured.length - MAX_VISIBLE} lesionados más
                    </div>
                  )}
                </div>
              </div>
            )}

            {expiring.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3 text-orange-500" /> Expiran este año
                  <span className="ml-auto rounded-full bg-orange-500/10 px-1.5 text-orange-600 dark:text-orange-400">
                    {expiring.length}
                  </span>
                </h4>
                <div className="space-y-2">
                  {expiring.slice(0, MAX_VISIBLE).map(({ player, contract }) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2.5 text-sm p-2 rounded-md bg-orange-500/10 border border-orange-500/20"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-medium text-muted-foreground">
                        {player.firstName[0]}
                        {player.lastName[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{player.lastName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatSalary(contract?.salaryY1)}
                      </span>
                    </div>
                  ))}
                  {expiring.length > MAX_VISIBLE && (
                    <div className="text-xs text-center text-muted-foreground pt-1">
                      + {expiring.length - MAX_VISIBLE} jugadores más
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
