"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useFreeAgencyMarket,
  useImportInitialFreeAgents,
} from "@/application/hooks/free-agency/useFreeAgencyMarket";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { OfferForm } from "@/components/free-agency/offer-form";
import { OfferResults } from "@/components/free-agency/offer-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FreeAgencyMarketScreenProps {
  gameId: string;
}

export function FreeAgencyMarketScreen({ gameId }: FreeAgencyMarketScreenProps) {
  const t = useT();
  const locale = useLocale();
  const market = useFreeAgencyMarket(gameId);
  const initialImport = useImportInitialFreeAgents(gameId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const snapshot = market.data;
  const money = new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (market.isLoading) return <output className="block">{t("common", "loading")}</output>;

  if (!snapshot) {
    return (
      <div role="alert" className="space-y-3">
        <p>{t("freeAgency", "loadFailed")}</p>
        <Button type="button" onClick={() => void market.refetch()} disabled={market.isFetching}>
          {market.isFetching ? t("freeAgency", "updating") : t("freeAgency", "retry")}
        </Button>
      </div>
    );
  }

  if (!snapshot.supported || !snapshot.context) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black tracking-tight">{t("freeAgency", "title")}</h1>
        <output className="block">{t("freeAgency", "unsupported")}</output>
        <h2 className="text-xl font-semibold">{t("freeAgency", "history")}</h2>
        <OfferResults offers={snapshot.offers} />
      </div>
    );
  }

  const context = snapshot.context;
  const selectedPlayer = snapshot.candidates.find((player) => player.playerId === selectedPlayerId);
  const pendingPlayerIds = new Set(
    snapshot.offers
      .filter(
        (offer) =>
          offer.status === "pending" && offer.origin === "human" && offer.teamId === context.teamId
      )
      .map((offer) => offer.playerId)
  );
  const blockOffers = market.isFetching || market.isError;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{t("freeAgency", "title")}</h1>
        <p className="text-muted-foreground">{t("freeAgency", "description")}</p>
        <p>{t("freeAgency", "policy")}</p>
        <p className="text-sm text-muted-foreground">{t("freeAgency", "preferences")}</p>
        <p className="text-sm text-muted-foreground">{t("freeAgency", "enrollment")}</p>
        <Link className="text-primary underline" href={`/games/${gameId}/dashboard/roster`}>
          {t("dashboard", "roster")}
        </Link>
        <Button
          type="button"
          variant="outline"
          onClick={() => void market.refetch()}
          disabled={market.isFetching}
        >
          {market.isFetching ? t("freeAgency", "updating") : t("freeAgency", "refresh")}
        </Button>
      </header>

      {market.isFetching && <output className="block">{t("freeAgency", "updating")}</output>}
      {market.isError && (
        <p role="alert" className="text-destructive">
          {t("freeAgency", "loadFailed")}
        </p>
      )}

      <section aria-label={t("freeAgency", "title")} className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard", "totalPayroll")}</p>
            <p className="text-xl font-bold">{money.format(context.payroll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard", "capSpace")}</p>
            <p className="text-xl font-bold">{money.format(context.capRoom)}</p>
            <p className="text-xs text-muted-foreground">
              {t("dashboard", "cap")}: {money.format(context.salaryCap)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("dashboard", "standardPlayers")}</p>
            <p className="text-xl font-bold">
              {context.rosterCount} {t("dashboard", "playersMax")}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("freeAgency", "pool")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshot.candidates.length === 0 ? (
            <div className="space-y-3">
              <p>{t("freeAgency", "emptyPool")}</p>
              <p className="text-sm text-muted-foreground">{t("freeAgency", "importHelp")}</p>
              <Button
                type="button"
                variant="outline"
                disabled={initialImport.isPending || initialImport.isSuccess || market.isFetching}
                onClick={() => initialImport.mutate()}
              >
                {initialImport.isPending
                  ? t("freeAgency", "importing")
                  : t("freeAgency", "importInitial")}
              </Button>
              {initialImport.isError && <p role="alert">{t("freeAgency", "importFailed")}</p>}
              {initialImport.isSuccess && (
                <output className="block">{t("freeAgency", "imported")}</output>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {snapshot.candidates.map((player) => (
                <li
                  key={player.playerId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {player.firstName} {player.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {player.position} · {money.format(player.minimumSalary)}–
                      {money.format(player.maximumSalary)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={blockOffers}
                    onClick={() => setSelectedPlayerId(player.playerId)}
                  >
                    {t("freeAgency", "submit")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {selectedPlayer && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">
                {selectedPlayer.firstName} {selectedPlayer.lastName}
              </h3>
              <OfferForm
                key={`${gameId}-${selectedPlayer.playerId}`}
                gameId={gameId}
                player={selectedPlayer}
                context={context}
                hasPendingOffer={pendingPlayerIds.has(selectedPlayer.playerId)}
                disabled={blockOffers}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("freeAgency", "history")}</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferResults offers={snapshot.offers} />
        </CardContent>
      </Card>
    </div>
  );
}
