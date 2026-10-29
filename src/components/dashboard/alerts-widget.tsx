"use client";

import { ArrowUpRight, Bandage, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { usePlayerStates } from "@/application/hooks/player-states/usePlayerStates";
import { type RosterPlayer, useRoster } from "@/application/hooks/roster/useRoster";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { formatRosterSalary } from "@/components/roster/roster-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTRACT_ORIGIN } from "@/domain/entities/Contract";

interface AlertsWidgetProps {
  gameId: string;
  teamId: string;
  seasonYear: number;
}

export function getVerifiedContractEndYear({
  contract,
  gameContract,
}: RosterPlayer): number | null {
  if (!contract) return null;
  if (contract.origin === CONTRACT_ORIGIN.SIMULATED_AGREEMENT) return contract.endYear;
  if (gameContract?.estimated) return null;
  if (contract.compatibilityProjection === "observed-season-coverage") {
    const agreement = gameContract?.agreement;
    return (
      agreement?.seasons.find((season) => season.seasonLabel === agreement.endSeasonLabel)
        ?.startYear ?? null
    );
  }
  return contract.endYear;
}

export function AlertsWidget({ gameId, teamId, seasonYear }: AlertsWidgetProps) {
  const roster = useRoster(gameId, teamId);
  const states = usePlayerStates(gameId, teamId);
  const t = useT();
  const locale = useLocale();
  const expiring = (roster.data ?? []).filter(
    (entry) => getVerifiedContractEndYear(entry) === seasonYear
  );
  const unknownEnds = (roster.data ?? []).filter(
    (entry) => getVerifiedContractEndYear(entry) === null
  ).length;
  const injuredIds = new Set(
    (states.data ?? []).filter((state) => state.isInjured).map((state) => state.playerId)
  );
  const injured = (roster.data ?? []).filter(({ player }) => injuredIds.has(player.id));
  const count = injured.length + expiring.length;
  const groups = [
    { label: t("dashboard", "injuredPlayers"), icon: Bandage, entries: injured, injury: true },
    { label: t("dashboard", "expiringThisSeason"), icon: Clock, entries: expiring, injury: false },
  ];

  return (
    <Card className="min-w-0 gap-4 rounded-md border-border/60 bg-card py-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
        <CardTitle className="text-base font-semibold">{t("dashboard", "priorities")}</CardTitle>
        {!roster.isPending &&
          !states.isPending &&
          !roster.isError &&
          !states.isError &&
          count > 0 && <Badge variant="secondary">{count}</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {roster.isError || states.isError ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            {t("dashboard", "alertsFailed")}
          </p>
        ) : roster.isPending || states.isPending ? (
          <output className="block py-6 text-sm text-muted-foreground">
            {t("common", "loading")}
          </output>
        ) : (
          <>
            {count === 0 && (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <CheckCircle className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                {t("dashboard", "noVerifiedAlerts")}
              </div>
            )}
            {groups
              .filter((group) => group.entries.length > 0)
              .map((group) => (
                <div key={group.label} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <group.icon className="size-3.5" />
                    {group.label}
                    <span className="ml-auto">{group.entries.length}</span>
                  </h3>
                  <div className="divide-y divide-border/50">
                    {group.entries.slice(0, 3).map(({ player, contract }) => (
                      <Link
                        key={player.id}
                        href={`/games/${gameId}/dashboard/player/${player.id}`}
                        className="flex items-center justify-between gap-2 rounded-sm py-2 text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0 truncate font-medium">{player.fullName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {group.injury
                            ? (player.position ?? "—")
                            : formatRosterSalary(contract?.salaryY1, locale)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  {group.entries.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{group.entries.length - 3} {t("dashboard", "morePlayers")}
                    </p>
                  )}
                </div>
              ))}
            {unknownEnds > 0 && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("dashboard", "unverifiedContractEnds")}: {unknownEnds}
              </p>
            )}
          </>
        )}
        <Button asChild variant="ghost" size="sm" className="w-full rounded-sm">
          <Link href={`/games/${gameId}/dashboard/roster`}>
            {t("dashboard", "viewRoster")}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
