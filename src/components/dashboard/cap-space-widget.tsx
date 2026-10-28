"use client";

import { ArrowUpRight, DollarSign } from "lucide-react";
import Link from "next/link";
import { display } from "@/app/ui-preview/fonts";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { useReleaseCapCharge } from "@/application/hooks/roster/useReleasePlayer";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

interface CapSpaceWidgetProps {
  gameId: string;
  teamId: string;
}

export function CapSpaceWidget({ gameId, teamId }: CapSpaceWidgetProps) {
  const contracts = useTeamContracts(gameId, teamId);
  const game = useGame(gameId);
  const releases = useReleaseCapCharge(gameId, teamId, game.data?.seasonYear ?? 2026);
  const t = useT();
  const locale = useLocale();
  const thresholds = getSalaryCapThresholds(game.data?.seasonYear ?? 2026);
  const status =
    contracts.data && releases.data !== undefined
      ? new SalaryCapCalculator(thresholds).getFinancialStatus(contracts.data, releases.data)
      : null;
  const failed = contracts.isError || game.isError || releases.isError;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  const limits = [
    { label: t("dashboard", "salaryCap"), value: thresholds.salaryCap },
    { label: t("dashboard", "luxuryTax"), value: thresholds.luxuryTax },
    { label: t("dashboard", "firstApron"), value: thresholds.firstApron },
    { label: t("dashboard", "secondApron"), value: thresholds.secondApron },
  ];

  return (
    <Card className="min-w-0 gap-4 rounded-md border-border/60 bg-card py-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
        <CardTitle className={`${display.className} flex items-center gap-2 text-lg font-semibold`}>
          <DollarSign className="size-4 text-primary" />
          {t("dashboard", "finances")}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="rounded-sm">
          <Link href={`/games/${gameId}/dashboard/roster`}>
            {t("dashboard", "roster")}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p role="alert" className="py-6 text-sm text-destructive">
            {t("dashboard", "financesFailed")}
          </p>
        ) : !status || !game.data ? (
          <output className="block py-6 text-sm text-muted-foreground">
            {t("common", "loading")}
          </output>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard", "totalPayroll")}</p>
                <p
                  className={`${display.className} mt-1 break-all text-3xl font-semibold tracking-tight tabular-nums`}
                >
                  {formatCurrency(status.totalSalary)}
                </p>
              </div>
              <div className="text-sm">
                <p
                  className={
                    status.isOverCap
                      ? "font-semibold text-destructive"
                      : "font-semibold text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {formatCurrency(Math.abs(thresholds.salaryCap - status.totalSalary))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("dashboard", status.isOverCap ? "aboveSalaryCap" : "capRoom")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative h-2 bg-muted" aria-hidden="true">
                <div
                  className={`h-full ${status.isOverLuxuryTax ? "bg-destructive" : status.isOverCap ? "bg-amber-500" : "bg-primary"}`}
                  style={{
                    width: `${Math.min(100, (status.totalSalary / thresholds.secondApron) * 100)}%`,
                  }}
                />
                {limits.slice(0, 3).map((limit) => (
                  <span
                    key={limit.label}
                    className="absolute -top-1 h-4 w-px bg-foreground/50"
                    style={{ left: `${(limit.value / thresholds.secondApron) * 100}%` }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "dashboard",
                  status.apronStatus === "Second"
                    ? "aboveSecondApron"
                    : status.apronStatus === "First"
                      ? "aboveFirstApron"
                      : status.isOverLuxuryTax
                        ? "luxuryTax"
                        : "belowTax"
                )}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4 xl:grid-cols-4">
              {limits.map((limit) => (
                <div key={limit.label}>
                  <dt className="text-xs text-muted-foreground">{limit.label}</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">
                    {formatCurrency(limit.value)}
                  </dd>
                </div>
              ))}
            </dl>
            {releases.data !== undefined && releases.data > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("dashboard", "releasedSalary")}: {formatCurrency(releases.data)} ·{" "}
                {t("dashboard", "includedInPayroll")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
