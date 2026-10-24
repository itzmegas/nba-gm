"use client";

import { useRef } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useEnterOffseason } from "@/application/hooks/offseason/useEnterOffseason";
import { useOffseason } from "@/application/hooks/offseason/useOffseason";
import { useRoster } from "@/application/hooks/roster/useRoster";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatSeasonLabel } from "@/domain/entities/Season";
import { getOffseasonContractOutlook } from "@/domain/services/OffseasonContractOutlook";

interface OffseasonPanelProps {
  gameId: string;
  selectedTeamId: string;
}

interface OffseasonPlanningProps extends OffseasonPanelProps {
  seasonYear: number;
}

export function OffseasonPanel(props: OffseasonPanelProps) {
  const t = useT();
  const game = useGame(props.gameId);
  if (game.isPending) return <output>{t("common", "loading")}</output>;
  if (game.isError || !game.data)
    return (
      <div role="alert" className="space-y-3">
        <p>{t("offseason", "loadFailed")}</p>
        <Button onClick={() => void game.refetch()}>{t("postseason", "retry")}</Button>
      </div>
    );
  return <OffseasonPlanning {...props} seasonYear={game.data.seasonYear} />;
}

function OffseasonPlanning({ gameId, selectedTeamId, seasonYear }: OffseasonPlanningProps) {
  const t = useT();
  const locale = useLocale();
  const entry = useOffseason(gameId, seasonYear);
  const enter = useEnterOffseason();
  const entering = useRef(false);
  const roster = useRoster(entry.data && !entry.isError ? gameId : null, selectedTeamId);
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);

  const enterOffseason = () => {
    if (entering.current || enter.isPending || entry.isPending || entry.isError || entry.data)
      return;
    entering.current = true;
    enter.mutate(
      { gameId, seasonYear },
      {
        onSettled: () => {
          entering.current = false;
        },
      }
    );
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="text-lg font-bold">{t("offseason", "title")}</h2>
        <p className="text-sm text-muted-foreground">{t("offseason", "preserved")}</p>
        {entry.isError ? (
          <div role="alert" className="space-y-3">
            <p>{t("offseason", "loadFailed")}</p>
            <Button onClick={() => void entry.refetch()}>{t("postseason", "retry")}</Button>
          </div>
        ) : entry.isPending ? (
          <output>{t("common", "loading")}</output>
        ) : !entry.data ? (
          <div className="space-y-3">
            <Button onClick={enterOffseason} disabled={enter.isPending}>
              {t("offseason", enter.isPending ? "entering" : "enter")}
            </Button>
            {enter.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t("offseason", "enterFailed")}
              </p>
            )}
          </div>
        ) : (
          <>
            <output className="block font-semibold">{t("offseason", "entered")}</output>
            <h3 className="font-semibold">
              {t("offseason", "contractOutlook")} · {formatSeasonLabel(seasonYear + 1)}
            </h3>
            <p className="text-sm text-muted-foreground">{t("offseason", "informational")}</p>
            {roster.isError ? (
              <div role="alert" className="space-y-3">
                <p>{t("offseason", "rosterFailed")}</p>
                <Button onClick={() => void roster.refetch()}>{t("postseason", "retry")}</Button>
              </div>
            ) : roster.isPending ? (
              <output>{t("common", "loading")}</output>
            ) : !roster.data?.length ? (
              <p>{t("offseason", "empty")}</p>
            ) : (
              <AppTable aria-label={t("offseason", "contractOutlook")}>
                <AppTableHeader>
                  <AppTableRow>
                    <AppTableHead>{t("offseason", "player")}</AppTableHead>
                    <AppTableHead>{t("offseason", "contractStatus")}</AppTableHead>
                    <AppTableHead>{t("offseason", "nextSalary")}</AppTableHead>
                  </AppTableRow>
                </AppTableHeader>
                <tbody>
                  {roster.data.map(({ player, contract, gameContract }) => {
                    const outlook = getOffseasonContractOutlook(contract, gameContract, seasonYear);
                    return (
                      <AppTableRow key={player.id}>
                        <AppTableCell>{player.fullName}</AppTableCell>
                        <AppTableCell>
                          {t("offseason", outlook.status)}
                          {outlook.estimated && (
                            <Badge variant="outline" className="ml-2">
                              {t("offseason", "estimated")}
                            </Badge>
                          )}
                        </AppTableCell>
                        <AppTableCell className="tabular-nums">
                          {outlook.nextSalary === null
                            ? t("offseason", "unknownSalary")
                            : formatCurrency(outlook.nextSalary)}
                        </AppTableCell>
                      </AppTableRow>
                    );
                  })}
                </tbody>
              </AppTable>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
