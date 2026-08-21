"use client";

import { Users } from "lucide-react";
import { use } from "react";
import { useTeamContracts } from "@/application/hooks/contracts/useTeamContracts";
import { useGame } from "@/application/hooks/games/useGame";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useTeam } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { RosterTable } from "@/components/roster/roster-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSeasonLabel } from "@/domain/entities/Season";
import { SalaryCapCalculator } from "@/domain/services/SalaryCapCalculator";

const SALARY_CAP = 140_000_000;

function formatSalary(amount: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(amount / 1_000_000)}M`;
}

interface GameRosterPageProps {
  params: Promise<{ gameId: string }>;
}

export default function GameRosterPage({ params }: GameRosterPageProps) {
  const { gameId } = use(params);
  const { data: game, isLoading: isLoadingGame } = useGame(gameId);
  const selectedTeamId = game?.selectedTeamId ?? null;

  const { data: team } = useTeam(selectedTeamId ?? "");
  const { data: rosterPlayers, isLoading: isLoadingRoster } = useRoster(gameId, selectedTeamId);
  const { data: contracts } = useTeamContracts(gameId, selectedTeamId);

  const calculator = new SalaryCapCalculator();
  const financials = contracts ? calculator.getFinancialStatus(contracts) : null;
  const totalPlayers = rosterPlayers?.length ?? 0;
  const locale = useLocale();
  const t = useT();

  if (isLoadingGame || isLoadingRoster || !game) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          {t("dashboard", "roster")}
        </h1>
        <p className="text-muted-foreground">
          {team?.city} {team?.name} — {t("dashboard", "season")}{" "}
          {formatSeasonLabel(game.seasonYear)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "players")}
            </p>
            <p className="text-2xl font-black mt-1">{totalPlayers}</p>
            <p className="text-xs text-muted-foreground">{t("dashboard", "playersMax")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "totalPayroll")}
            </p>
            <p className="text-2xl font-black mt-1">
              {financials ? formatSalary(financials.totalSalary, locale) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard", "cap")}: {formatSalary(SALARY_CAP, locale)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "capSpace")}
            </p>
            <p
              className={`text-2xl font-black mt-1 ${
                financials?.isOverCap ? "text-destructive" : "text-green-500"
              }`}
            >
              {financials
                ? financials.isOverCap
                  ? `-${formatSalary(financials.totalSalary - SALARY_CAP, locale)}`
                  : formatSalary(financials.capSpace, locale)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {financials?.isOverCap ? t("dashboard", "overCap") : t("dashboard", "available")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("dashboard", "apronStatus")}
            </p>
            <p className="text-2xl font-black mt-1">
              {financials?.apronStatus === "None"
                ? t("dashboard", "clean")
                : (financials?.apronStatus ?? "—")}
            </p>
            <p className="text-xs text-muted-foreground">
              {financials?.isOverLuxuryTax
                ? t("dashboard", "luxuryTax")
                : t("dashboard", "belowTax")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("dashboard", "activeContracts")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {rosterPlayers && rosterPlayers.length > 0 ? (
            <RosterTable gameId={gameId} players={rosterPlayers} seasonYear={game.seasonYear} />
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              {t("dashboard", "noPlayersRoster")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
