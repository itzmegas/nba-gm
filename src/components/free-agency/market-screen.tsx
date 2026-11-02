"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  useFreeAgencyMarket,
  useImportInitialFreeAgents,
} from "@/application/hooks/free-agency/useFreeAgencyMarket";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { OfferForm } from "@/components/free-agency/offer-form";
import { OfferResults } from "@/components/free-agency/offer-results";
import { PlayerHeadshot } from "@/components/players/player-headshot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FreeAgencyMarketScreenProps {
  gameId: string;
}

export function FreeAgencyMarketScreen({ gameId }: FreeAgencyMarketScreenProps) {
  const t = useT();
  const locale = useLocale();
  const market = useFreeAgencyMarket(gameId);
  const initialImport = useImportInitialFreeAgents(gameId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const offerButton = useRef<HTMLButtonElement>(null);
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
  const selectedPlayer =
    snapshot.candidates.find((player) => player.playerId === selectedPlayerId) ??
    snapshot.candidates[0];
  const pendingPlayerIds = new Set(
    snapshot.offers
      .filter(
        (offer) =>
          offer.status === "pending" && offer.origin === "human" && offer.teamId === context.teamId
      )
      .map((offer) => offer.playerId)
  );
  const blockOffers = market.isFetching || market.isError;
  const positions = [...new Set(snapshot.candidates.map((player) => player.position))].sort();
  const filteredPlayers = snapshot.candidates.filter(
    (player) =>
      `${player.firstName} ${player.lastName}`
        .toLocaleLowerCase(locale)
        .includes(query.trim().toLocaleLowerCase(locale)) &&
      (!position || player.position === position) &&
      (!pendingOnly || pendingPlayerIds.has(player.playerId))
  );

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("freeAgency", "frontOffice")} / {context.season}
          </p>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">
            {t("freeAgency", "title")}
          </h1>
          <p className="text-muted-foreground">{t("freeAgency", "description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
        </div>
      </header>

      {market.isFetching && <output className="block">{t("freeAgency", "updating")}</output>}
      {market.isError && (
        <p role="alert" className="text-destructive">
          {t("freeAgency", "loadFailed")}
        </p>
      )}

      <section
        aria-label={t("freeAgency", "finances")}
        className="grid grid-cols-2 gap-5 rounded-md border bg-card p-5 lg:grid-cols-4 lg:divide-x [&>div]:min-w-0 [&_p]:break-words lg:[&>div:not(:first-child)]:pl-5"
      >
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard", "totalPayroll")}</p>
          <p className="font-display text-3xl tabular-nums">{money.format(context.payroll)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard", "capSpace")}</p>
          <p
            className={`font-display text-3xl tabular-nums ${context.capRoom < 0 ? "text-destructive" : ""}`}
          >
            {money.format(context.capRoom)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("dashboard", "cap")}: {money.format(context.salaryCap)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard", "standardPlayers")}</p>
          <p className="font-display text-3xl tabular-nums">
            {context.rosterCount} {t("dashboard", "playersMax")}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("freeAgency", "activeOffers")}</p>
          <p className="font-display text-3xl tabular-nums">{pendingPlayerIds.size}</p>
        </div>
      </section>

      <p className="rounded-md border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
        {t("freeAgency", "policy")}
      </p>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
        <Card className="min-w-0 gap-0 overflow-hidden py-0">
          <CardHeader className="py-4">
            <CardTitle>{t("freeAgency", "pool")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0 pb-0">
            <div className="grid gap-3 border-y p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor="fa-search">
                {t("freeAgency", "search")}
                <Input
                  id="fa-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor="fa-position">
                {t("freeAgency", "position")}
                <select
                  id="fa-position"
                  className="h-9 w-full rounded border bg-background px-3 text-sm text-foreground"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                >
                  <option value="">{t("freeAgency", "allPositions")}</option>
                  {positions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={pendingOnly}
                  onChange={(event) => setPendingOnly(event.target.checked)}
                />
                {t("freeAgency", "yourPending")}
              </label>
            </div>
            {snapshot.candidates.length === 0 ? (
              <div className="space-y-3 p-4">
                <p>{t("freeAgency", "emptyPool")}</p>
                <p className="text-sm text-muted-foreground">{t("freeAgency", "importHelp")}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={initialImport.isPending || initialImport.isSuccess || blockOffers}
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
              <div className="max-h-[580px] overflow-auto">
                <table className="w-full min-w-[580px] text-left text-sm tabular-nums">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      {(["player", "position", "minimum", "maximum", "offerStatus"] as const).map(
                        (key) => (
                          <th key={key} scope="col" className="border-y px-3 py-3 font-medium">
                            {t("freeAgency", key)}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr
                        key={player.playerId}
                        className={`border-b hover:bg-primary/5 ${selectedPlayer?.playerId === player.playerId ? "bg-primary/10" : ""}`}
                      >
                        <td className="p-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left font-medium"
                            aria-pressed={selectedPlayer?.playerId === player.playerId}
                            onClick={() => setSelectedPlayerId(player.playerId)}
                          >
                            <PlayerHeadshot
                              src={player.headshotUrl}
                              alt=""
                              className="h-9 w-9 rounded bg-muted object-contain"
                            />
                            {player.firstName} {player.lastName}
                          </button>
                        </td>
                        <td className="p-3">{player.position}</td>
                        <td className="p-3">{money.format(player.minimumSalary)}</td>
                        <td className="p-3">{money.format(player.maximumSalary)}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {t(
                            "freeAgency",
                            pendingPlayerIds.has(player.playerId) ? "pending" : "noYourOffer"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPlayers.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground">
                    {t("freeAgency", "noMatches")}
                  </p>
                )}
              </div>
            )}
            <p className="border-t px-4 py-3 text-xs text-muted-foreground" aria-live="polite">
              {filteredPlayers.length} / {snapshot.candidates.length} · {t("freeAgency", "pool")}
            </p>
          </CardContent>
        </Card>
        <aside
          aria-label={t("freeAgency", "inspector")}
          className="overflow-hidden rounded-md border border-primary/25 bg-primary/5 xl:sticky xl:top-5"
        >
          <h2 className="border-b border-primary/20 px-4 py-3 text-xs uppercase tracking-widest text-primary">
            {t("freeAgency", "inspector")}
          </h2>
          {selectedPlayer ? (
            <>
              <div className="relative flex justify-center overflow-hidden bg-primary/5 pt-4">
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-0 font-display text-9xl text-primary/10"
                >
                  {selectedPlayer.position}
                </span>
                <PlayerHeadshot
                  src={selectedPlayer.headshotUrl}
                  alt=""
                  className="relative h-44 w-44 object-contain"
                />
              </div>
              <div className="space-y-4 p-4">
                <p className="text-xs uppercase tracking-widest text-primary">
                  {selectedPlayer.position}
                </p>
                <h3 className="font-display text-3xl font-semibold">
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </h3>
                <dl className="grid grid-cols-2 gap-3 border-y border-primary/20 py-4">
                  {(["minimum", "maximum"] as const).map((key) => (
                    <div key={key}>
                      <dt className="text-xs text-muted-foreground">{t("freeAgency", key)}</dt>
                      <dd className="mt-1 font-display text-xl tabular-nums">
                        {money.format(
                          key === "minimum"
                            ? selectedPlayer.minimumSalary
                            : selectedPlayer.maximumSalary
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {pendingPlayerIds.has(selectedPlayer.playerId) && (
                  <p className="text-sm">{t("freeAgency", "pendingExists")}</p>
                )}
                <Button
                  ref={offerButton}
                  type="button"
                  className="w-full"
                  disabled={blockOffers}
                  onClick={() => {
                    setSelectedPlayerId(selectedPlayer.playerId);
                    setOfferOpen(true);
                  }}
                >
                  {t("freeAgency", "submit")}
                </Button>
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t("freeAgency", "emptyPool")}</p>
          )}
        </aside>
      </div>

      <Sheet
        open={offerOpen && selectedPlayer?.playerId === selectedPlayerId}
        onOpenChange={setOfferOpen}
      >
        <SheetContent
          showCloseButton={false}
          className="w-full overflow-y-auto sm:max-w-[480px]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            offerButton.current?.focus();
          }}
        >
          <SheetHeader className="border-b bg-primary/5">
            <SheetTitle className="pr-8 font-display text-3xl">
              {selectedPlayer?.firstName} {selectedPlayer?.lastName}
            </SheetTitle>
            <SheetDescription>{t("freeAgency", "contractOffer")}</SheetDescription>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                {t("common", "cancel")}
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="p-6">
            {selectedPlayer && (
              <OfferForm
                key={`${gameId}-${selectedPlayer.playerId}`}
                gameId={gameId}
                player={selectedPlayer}
                context={context}
                hasPendingOffer={pendingPlayerIds.has(selectedPlayer.playerId)}
                disabled={blockOffers}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <details className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          {t("freeAgency", "marketRules")}
        </summary>
        <div className="mt-3 space-y-2">
          <p>{t("freeAgency", "preferences")}</p>
          <p>{t("freeAgency", "enrollment")}</p>
        </div>
      </details>

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
