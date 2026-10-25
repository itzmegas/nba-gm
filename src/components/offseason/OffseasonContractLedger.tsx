"use client";

import { useRef, useState } from "react";
import { useOffseasonContracts } from "@/application/hooks/offseason/useOffseasonContracts";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { useT } from "@/application/providers/I18nProvider";
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
import { getOffseasonContractOutlook } from "@/domain/services/OffseasonContractOutlook";

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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const submitting = useRef(false);
  const ownerSelected = selectedTeamId === ownerTeamId;
  const busy = prepare.isPending || decide.isPending;
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
    <section aria-label={t("offseason", "ledger")} className="space-y-3">
      <h3 className="font-semibold">{t("offseason", "ledger")}</h3>
      <p>{t("offseason", "ledgerHelp")}</p>
      {ledger.isError ? (
        <div role="alert">
          <p>{t("offseason", "ledgerFailed")}</p>
          <Button onClick={() => void ledger.refetch()}>{t("postseason", "retry")}</Button>
        </div>
      ) : ledger.isPending ? (
        <output>{t("common", "loading")}</output>
      ) : (
        <>
          {ownerSelected && (
            <Button
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
              ?.filter((row) => row.teamId === selectedTeamId)
              .map((row) => {
                const member = roster.find((member) => member.player.id === row.playerId);
                const actionable = canDecide(row);
                return (
                  <li key={row.playerId} className="flex flex-wrap items-center gap-2">
                    <span>{member?.player.fullName ?? row.playerId}</span>
                    <span>
                      {t(
                        "offseason",
                        row.status === "expiring"
                          ? "plannedDeparture"
                          : row.decision === "decline"
                            ? "optionDeclined"
                            : row.status === "player_option"
                              ? "playerOptionPending"
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
        </>
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
