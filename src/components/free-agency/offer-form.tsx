"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { z } from "zod";
import { useSubmitFreeAgencyOffer } from "@/application/hooks/free-agency/useFreeAgencyMarket";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FreeAgencyMarketContext,
  FreeAgencyMarketPlayer,
} from "@/domain/freeAgency/FreeAgencyMarketSnapshot";

interface OfferFormProps {
  gameId: string;
  player: FreeAgencyMarketPlayer;
  context: FreeAgencyMarketContext;
  hasPendingOffer: boolean;
  disabled?: boolean;
}

interface OfferAttempt {
  payload: string;
  requestId: string;
}

export function OfferForm({
  gameId,
  player,
  context,
  hasPendingOffer,
  disabled = false,
}: OfferFormProps) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [salary, setSalary] = useState(String(player.minimumSalary));
  const [years, setYears] = useState("1");
  const attempt = useRef<OfferAttempt | null>(null);
  const submitting = useRef(false);
  const simulationActive = useBatchSimulationStore((state) => state.isActive);
  const submission = useSubmitFreeAgencyOffer();
  const terms = z
    .object({
      annualSalary: z.number().int().safe().min(player.minimumSalary).max(player.maximumSalary),
      years: z.number().int().min(1).max(5),
    })
    .safeParse({ annualSalary: Number(salary), years: Number(years) });
  const capExceeded =
    terms.success &&
    terms.data.annualSalary > context.capRoom &&
    terms.data.annualSalary !== player.minimumSalary;
  const blocked =
    disabled ||
    simulationActive ||
    hasPendingOffer ||
    context.rosterCount >= 15 ||
    submission.isPending;
  const money = new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const dueDate = new Date(`${context.simulationDate}T00:00:00Z`);
  dueDate.setUTCDate(dueDate.getUTCDate() + 1);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || submitting.current || !terms.success || capExceeded) return;
    const offer = { season: context.season, ...terms.data };
    const payload = JSON.stringify({ gameId, playerId: player.playerId, offer });
    if (attempt.current?.payload !== payload) {
      attempt.current = { payload, requestId: crypto.randomUUID() };
    }
    submitting.current = true;
    try {
      await submission.mutateAsync({
        gameId,
        playerId: player.playerId,
        requestId: attempt.current.requestId,
        offer,
      });
    } catch {
      // Keep the request identity for a safe identical retry after an uncertain response.
    } finally {
      submitting.current = false;
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3"
      aria-label={`${t("freeAgency", "submit")} · ${player.firstName} ${player.lastName}`}
    >
      <p className="text-sm text-muted-foreground">
        {t("freeAgency", "minimum")}: {money.format(player.minimumSalary)} ·{" "}
        {t("freeAgency", "maximum")}: {money.format(player.maximumSalary)}
      </p>
      <fieldset disabled={blocked} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-salary`} className="text-sm font-medium">
            {t("freeAgency", "salary")}
          </label>
          <Input
            id={`${id}-salary`}
            type="number"
            required
            min={player.minimumSalary}
            max={player.maximumSalary}
            step="1"
            value={salary}
            onChange={(event) => {
              setSalary(event.target.value);
              submission.reset();
            }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-years`} className="text-sm font-medium">
            {t("freeAgency", "years")}
          </label>
          <Input
            id={`${id}-years`}
            type="number"
            required
            min="1"
            max="5"
            step="1"
            value={years}
            onChange={(event) => {
              setYears(event.target.value);
              submission.reset();
            }}
          />
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">{t("freeAgency", "minimumException")}</p>
      <p className="text-sm">
        {t("freeAgency", "due")}:{" "}
        <time dateTime={dueDate.toISOString().slice(0, 10)}>{date.format(dueDate)}</time>
      </p>
      {!terms.success && (
        <p className="text-sm text-destructive">{t("freeAgency", "invalidTerms")}</p>
      )}
      {capExceeded && <p className="text-sm text-destructive">{t("freeAgency", "capExceeded")}</p>}
      {context.rosterCount >= 15 && (
        <p className="text-sm text-destructive">{t("freeAgency", "rosterFull")}</p>
      )}
      {simulationActive && (
        <p className="text-sm text-muted-foreground">{t("freeAgency", "simulationActive")}</p>
      )}
      {hasPendingOffer && (
        <p className="text-sm text-muted-foreground">{t("freeAgency", "pendingExists")}</p>
      )}
      {submission.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("freeAgency", "submitFailed")}
        </p>
      )}
      {submission.isSuccess && (
        <output className="block text-sm text-primary">{t("freeAgency", "submitted")}</output>
      )}
      <Button type="submit" disabled={blocked || !terms.success || capExceeded}>
        {submission.isPending ? t("freeAgency", "submitting") : t("freeAgency", "submit")}
      </Button>
    </form>
  );
}
