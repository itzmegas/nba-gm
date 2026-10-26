"use client";

import { useRef, useState } from "react";
import { useOffseasonContracts } from "@/application/hooks/offseason/useOffseasonContracts";
import { useOffseasonPlayerOptions } from "@/application/hooks/offseason/useOffseasonPlayerOptions";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { useT } from "@/application/providers/I18nProvider";
import { OffseasonPlayerOptions } from "@/components/offseason/OffseasonPlayerOptions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { OffseasonContract, OffseasonDecision } from "@/domain/entities/OffseasonContract";
import { formatSeasonLabel } from "@/domain/entities/Season";
import { getOffseasonContractOutlook } from "@/domain/services/OffseasonContractOutlook";
import { getOffseasonRosterProjection } from "@/domain/services/OffseasonRosterProjection";

interface Props {
  gameId: string;
  seasonYear: number;
  selectedTeamId: string;
  ownerTeamId: string;
  roster: RosterPlayer[];
}
interface Confirmation {
  playerId: string;
  name: string;
  decision: OffseasonDecision;
}

export function OffseasonContractLedger({
  gameId,
  seasonYear,
  selectedTeamId,
  ownerTeamId,
  roster,
}: Props) {
  const t = useT();
  const { ledger, prepare, decide } = useOffseasonContracts(gameId, seasonYear);
  const playerRows = ledger.data?.filter((row) => row.status === "player_option") ?? [];
  const playerOptions = useOffseasonPlayerOptions(
    gameId,
    seasonYear,
    !ledger.isPending && !ledger.isError && playerRows.length > 0
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const submitting = useRef(false);
  const ownerSelected = selectedTeamId === ownerTeamId;
  const busy = prepare.isPending || decide.isPending || playerOptions.resolve.isPending;
  const canDecide = (row: OffseasonContract) => {
    const member = roster.find((member) => member.player.id === row.playerId);
    const outlook = member
      ? getOffseasonContractOutlook(member.contract, member.gameContract, seasonYear)
      : null;
    return (
      ownerSelected &&
      row.teamId === ownerTeamId &&
      row.status === "team_option" &&
      row.decision === null &&
      row.nextSalary !== null &&
      outlook?.status === "team_option" &&
      !outlook.estimated &&
      outlook.nextSalary === row.nextSalary
    );
  };
  const confirm = () => {
    const row = ledger.data?.find((row) => row.playerId === confirmation?.playerId);
    if (!confirmation || !row || !canDecide(row) || ledger.isError || submitting.current || busy)
      return;
    submitting.current = true;
    decide.mutate(
      { playerId: confirmation.playerId, decision: confirmation.decision },
      {
        onSuccess: () => setConfirmation(null),
        onSettled: () => {
          submitting.current = false;
        },
      }
    );
  };
  return (
    <section aria-label={t("offseason", "ledger")} className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold">{t("offseason", "ledger")}</h3>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("offseason", "ledgerHelp")}</p>
      </div>
      {ledger.isError ? (
        <div role="alert">
          <p>{t("offseason", "ledgerFailed")}</p>
          <Button onClick={() => void ledger.refetch()}>{t("postseason", "retry")}</Button>
        </div>
      ) : ledger.isPending ? (
        <output>{t("common", "loading")}</output>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border p-4 sm:p-6">
            {ownerSelected && (
              <Button
                className="h-auto min-h-9 w-full whitespace-normal sm:w-auto"
                disabled={busy}
                onClick={() => {
                  if (!submitting.current && !busy) {
                    submitting.current = true;
                    prepare.mutate(undefined, {
                      onSettled: () => {
                        submitting.current = false;
                      },
                    });
                  }
                }}
              >
                {t("offseason", busy ? "savingLedger" : "prepareLedger")}
              </Button>
            )}
            {!ownerSelected && <p>{t("offseason", "otherTeamReadOnly")}</p>}
            <ul className="space-y-2">
              {ledger.data
                ?.filter((row) => row.teamId === selectedTeamId && row.status !== "player_option")
                .map((row) => {
                  const member = roster.find((member) => member.player.id === row.playerId);
                  const actionable = canDecide(row);
                  return (
                    <li
                      key={row.playerId}
                      className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 p-3"
                    >
                      <span className="font-medium">{member?.player.fullName ?? row.playerId}</span>
                      <span className="mr-auto text-sm text-muted-foreground">
                        {t(
                          "offseason",
                          row.status === "expiring"
                            ? "plannedDeparture"
                            : row.decision === "decline"
                              ? "optionDeclined"
                              : row.decision === "exercise"
                                ? "optionExercised"
                                : "optionPending"
                        )}
                      </span>
                      {actionable &&
                        (["exercise", "decline"] as const).map((decision) => (
                          <Button
                            key={decision}
                            disabled={busy}
                            onClick={() => {
                              decide.reset();
                              setConfirmation({
                                playerId: row.playerId,
                                name: member?.player.fullName ?? row.playerId,
                                decision,
                              });
                            }}
                          >
                            {t("offseason", decision)}
                          </Button>
                        ))}
                    </li>
                  );
                })}
            </ul>
            <OffseasonPlayerOptions
              rows={playerRows.filter((row) => row.teamId === selectedTeamId)}
              roster={roster}
              ownerSelected={ownerSelected}
              busy={busy || confirmation !== null}
              playerOptions={playerOptions}
            />
          </div>
          {roster.length > 0 && (
            <section
              aria-label={t("offseason", "projectedRoster")}
              className="space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-6"
            >
              <h3 className="font-semibold">
                {t("offseason", "projectedRoster")} · {formatSeasonLabel(seasonYear + 1)}
              </h3>
              <p className="text-sm text-muted-foreground">{t("offseason", "projectionHelp")}</p>
              {playerRows.length > 0 && playerOptions.options.isError ? (
                <div role="alert">
                  <p>{t("offseason", "playerOptionsFailed")}</p>
                  <Button onClick={() => void playerOptions.options.refetch()}>
                    {t("postseason", "retry")}
                  </Button>
                </div>
              ) : playerRows.length > 0 && playerOptions.options.isPending ? (
                <output>{t("common", "loading")}</output>
              ) : (
                <ul className="grid gap-2 lg:grid-cols-2">
                  {roster.map(({ player, contract, gameContract }) => {
                    const plan = ledger.data?.find(
                      (row) =>
                        row.playerId === player.id &&
                        row.teamId === selectedTeamId &&
                        row.seasonYear === seasonYear
                    );
                    const option = playerOptions.options.data?.find(
                      (row) =>
                        row.playerId === player.id &&
                        row.teamId === selectedTeamId &&
                        row.seasonYear === seasonYear &&
                        row.gameId === gameId
                    );
                    const projection = getOffseasonRosterProjection(
                      getOffseasonContractOutlook(contract, gameContract, seasonYear),
                      plan,
                      option
                    );
                    return (
                      <li key={player.id} className="rounded-lg border bg-card p-3 text-sm">
                        <span className="font-medium">{player.fullName}</span> ·{" "}
                        <span className="text-muted-foreground">{t("offseason", projection)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
      {prepare.isError && <p role="alert">{t("offseason", "ledgerFailed")}</p>}
      <AlertDialog
        open={confirmation !== null && ownerSelected}
        onOpenChange={(open) => {
          if (!open && !decide.isPending) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmation
              ? `${t("offseason", confirmation.decision)} · ${confirmation.name}`
              : t("offseason", "ledger")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("offseason", "confirmLedger")}</AlertDialogDescription>
          {decide.isError && <p role="alert">{t("offseason", "ledgerFailed")}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decide.isPending}>
              {t("offseason", "cancelDecision")}
            </AlertDialogCancel>
            <Button disabled={decide.isPending} onClick={confirm}>
              {t("offseason", decide.isPending ? "savingLedger" : "confirmDecision")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
