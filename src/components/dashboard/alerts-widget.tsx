"use client";

import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { usePlayersByTeam } from "@/application/hooks/players/usePlayers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AlertsWidgetProps {
  gameId: string;
  teamId: string;
}

export function AlertsWidget({ gameId, teamId }: AlertsWidgetProps) {
  const { data: contracts, isLoading: isLoadingContracts } = useTeamContracts(gameId, teamId);
  const { data: players, isLoading: isLoadingPlayers } = usePlayersByTeam(teamId);

  const currentYear = new Date().getFullYear();

  if (isLoadingContracts || isLoadingPlayers) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded-md w-full"></div>
            <div className="h-10 bg-muted rounded-md w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const expiringContracts = contracts?.filter((c) => c.endYear === currentYear) || [];
  const hasAlerts = expiringContracts.length > 0;

  return (
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Alertas de Roster
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!hasAlerts ? (
          <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            <span>Todo en orden. No hay alertas críticas.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {expiringContracts.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expiran este año
                </h4>
                <div className="space-y-2">
                  {expiringContracts.slice(0, 3).map((contract) => {
                    const player = players?.find((p) => p.id === contract.playerId);
                    return (
                      <div
                        key={contract.id}
                        className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50 border border-border/50"
                      >
                        <span className="font-medium">{player?.lastName || "Jugador"}</span>
                        <span className="text-muted-foreground">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(contract.salaryY1)}
                        </span>
                      </div>
                    );
                  })}
                  {expiringContracts.length > 3 && (
                    <div className="text-xs text-center text-muted-foreground pt-1">
                      + {expiringContracts.length - 3} jugadores más
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
