"use client";

import { useRef, useState } from "react";
import type { useOffseasonPlayerOptions } from "@/application/hooks/offseason/useOffseasonPlayerOptions";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { OffseasonContract } from "@/domain/entities/OffseasonContract";

interface Props {
  rows: OffseasonContract[];
  roster: RosterPlayer[];
  ownerSelected: boolean;
  busy: boolean;
  playerOptions: ReturnType<typeof useOffseasonPlayerOptions>;
}

export function OffseasonPlayerOptions({
  rows,
  roster,
  ownerSelected,
  busy,
  playerOptions,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const { options, resolve } = playerOptions;
  const [confirming, setConfirming] = useState(false);
  const submitting = useRef(false);
  const savedFor = (row: OffseasonContract) =>
    options.data?.find((saved) => saved.playerId === row.playerId && saved.teamId === row.teamId);
  const pending = rows.some((row) => !savedFor(row));
  const formatSalary = (amount: number) =>
    new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  const confirm = () => {
    if (
      !ownerSelected ||
      !pending ||
      options.isError ||
      options.isPending ||
      busy ||
      resolve.isPending ||
      submitting.current
    )
      return;
    submitting.current = true;
    resolve.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  if (!rows.length) return null;
  return (
    <section aria-label={t("offseason", "playerOptions")} className="space-y-3 border-t pt-4">
      <h4 className="font-semibold">{t("offseason", "playerOptions")}</h4>
      <p className="text-sm text-muted-foreground">{t("offseason", "playerOptionsSummary")}</p>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-ring">
          {t("offseason", "simulationPolicy")}
        </summary>
        <p className="pt-2 text-muted-foreground">{t("offseason", "playerOptionsHelp")}</p>
      </details>
      {options.isError && (
        <div role="alert">
          <p>{t("offseason", "playerOptionsFailed")}</p>
          <Button onClick={() => void options.refetch()}>{t("postseason", "retry")}</Button>
        </div>
      )}
      {options.isPending ? (
        <output>{t("common", "loading")}</output>
      ) : options.data ? (
        <>
          {ownerSelected && pending && !options.isError && (
            <Button
              className="h-auto min-h-9 w-full whitespace-normal sm:w-auto"
              disabled={busy || resolve.isPending}
              onClick={() => {
                resolve.reset();
                setConfirming(true);
              }}
            >
              {t("offseason", "resolvePlayerOptions")}
            </Button>
          )}
          <ul className="space-y-2">
            {rows.map((row) => {
              const saved = savedFor(row);
              return (
                <li key={row.playerId} className="space-y-1 rounded-lg bg-muted/40 p-3">
                  <span>
                    {roster.find((member) => member.player.id === row.playerId)?.player.fullName ??
                      row.playerId}
                  </span>{" "}
                  <span>
                    {t(
                      "offseason",
                      !saved
                        ? "playerOptionPending"
                        : saved.decision === "exercise"
                          ? "playerOptionExercised"
                          : "playerOptionDeclined"
                    )}
                  </span>
                  {saved ? (
                    <p className="text-sm text-muted-foreground">
                      {t("offseason", "currentSalary")}: {formatSalary(saved.currentSalary)} ·{" "}
                      {t("offseason", "nextSalary")}: {formatSalary(saved.nextSalary)} ·{" "}
                      {t("offseason", saved.reason)} · {t("offseason", "playerOptionPolicy")}:{" "}
                      {saved.policyVersion}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("offseason", "playerOptionUnresolved")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <AlertDialog
        open={confirming && ownerSelected}
        onOpenChange={(open) => {
          if (!open && !resolve.isPending) setConfirming(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("offseason", "resolvePlayerOptions")}</AlertDialogTitle>
          <AlertDialogDescription>{t("offseason", "confirmPlayerOptions")}</AlertDialogDescription>
          {resolve.isError && <p role="alert">{t("offseason", "playerOptionsFailed")}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolve.isPending}>
              {t("offseason", "cancelDecision")}
            </AlertDialogCancel>
            <Button
              disabled={busy || resolve.isPending || options.isError || options.isPending}
              onClick={confirm}
            >
              {t("offseason", resolve.isPending ? "savingLedger" : "confirmDecision")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
