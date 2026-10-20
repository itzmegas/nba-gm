"use client";

import { useLocale, useT } from "@/application/providers/I18nProvider";
import type { FreeAgencyMarketOffer } from "@/domain/freeAgency/FreeAgencyMarketSnapshot";

const RESOLUTION_REASONS = {
  selected_offer_accepted: true,
  another_offer_accepted: true,
  offer_no_longer_legal: true,
} as const;

const RESOLUTION_DETAILS = {
  "Roster maximum reached": true,
  "Offer exceeds cap room": true,
  "Salary outside verified minimum and maximum": true,
  "Explicitly enrolled active teamless player without an agreement required": true,
  "Active explicitly enrolled player required": true,
  "Offer season must match the supported game financial season": true,
  "Stored offer terms are outside supported bounds": true,
  "Offer team does not match the selected game team": true,
  "AI team does not participate in this game": true,
} as const;

interface OfferResultsProps {
  offers: readonly FreeAgencyMarketOffer[];
}

export function OfferResults({ offers }: OfferResultsProps) {
  const t = useT();
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  if (offers.length === 0)
    return <p className="text-muted-foreground">{t("freeAgency", "noOffers")}</p>;

  return (
    <ul className="space-y-4">
      {offers.map((offer) => (
        <li key={offer.id} className="rounded-md border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{offer.playerName}</h3>
            <span>{t("freeAgency", offer.origin)}</span>
          </div>
          <p>
            {offer.teamName} · {money.format(offer.offer.annualSalary)} · {offer.offer.years}{" "}
            {t("freeAgency", "years")}
          </p>
          <p>
            {t("freeAgency", offer.status)}:{" "}
            {t("freeAgency", offer.resolvedDate ? "resolved" : "due")}{" "}
            <time dateTime={offer.resolvedDate ?? offer.dueDate}>
              {date.format(new Date(`${offer.resolvedDate ?? offer.dueDate}T00:00:00Z`))}
            </time>
          </p>
          {offer.resolutionReason && (
            <p>
              {t(
                "freeAgency",
                offer.resolutionReason in RESOLUTION_REASONS
                  ? (offer.resolutionReason as keyof typeof RESOLUTION_REASONS)
                  : "detail"
              )}
            </p>
          )}
          {offer.resolutionDetail && (
            <p className="text-sm text-muted-foreground">
              {t("freeAgency", "detail")}:{" "}
              {offer.resolutionDetail in RESOLUTION_DETAILS
                ? t("freeAgency", offer.resolutionDetail as keyof typeof RESOLUTION_DETAILS)
                : offer.resolutionDetail}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
