"use client";

import Image from "next/image";
import { display } from "@/app/ui-preview/fonts";
import { selectConferenceStandings } from "@/application/dashboard/selectConferenceStandings";
import { useStandings } from "@/application/hooks/simulation";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import type { Game } from "@/domain/entities/Game";
import type { Team } from "@/domain/entities/Team";

interface FranchiseOverviewProps {
  game: Game;
  teams: Team[];
}

export function FranchiseOverview({ game, teams }: FranchiseOverviewProps) {
  const t = useT();
  const locale = useLocale();
  const query = useStandings(game.id);
  const team = teams.find((candidate) => candidate.id === game.selectedTeamId);
  const splitName = !!team?.city && team.name.startsWith(`${team.city} `);
  const standings = selectConferenceStandings(query.data ?? [], teams, game.selectedTeamId);
  const index = standings.findIndex((entry) => entry.teamId === game.selectedTeamId);
  const record = !query.isError && !query.isPending ? standings[index] : undefined;
  const played = record ? record.wins + record.losses : null;
  const recordLabel = record ? `${record.wins}–${record.losses}` : "—";
  const conference =
    team?.conference === "East"
      ? t("dashboard", "easternConference")
      : team?.conference === "West"
        ? t("dashboard", "westernConference")
        : t("dashboard", "conferenceStandings");
  const metrics = [
    { label: t("dashboard", "seasonRecord"), value: recordLabel },
    {
      label: t("dashboard", "winPercentage"),
      value:
        record && played
          ? new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
              style: "percent",
              maximumFractionDigits: 1,
            }).format(record.wins / played)
          : "—",
    },
    { label: conference, value: record ? String(index + 1) : "—" },
    { label: t("dashboard", "gamesPlayed"), value: played === null ? "—" : String(played) },
  ];

  return (
    <>
      <section
        aria-label={t("dashboard", "franchiseOverview")}
        className="relative isolate flex flex-wrap items-center gap-3 overflow-hidden rounded-md border border-primary/30 bg-gradient-to-r from-primary/20 via-card to-card p-5 sm:min-h-64 sm:gap-6 sm:p-6 lg:gap-8 lg:p-8"
      >
        <svg
          viewBox="0 0 490 280"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          aria-hidden="true"
          className="pointer-events-none absolute right-0 -z-10 h-full max-w-full text-primary/15"
        >
          <rect x="12" y="12" width="466" height="256" />
          <path d="M245 12v256 M12 78h92v124H12 M478 78h-92v124h92" />
          <circle cx="245" cy="140" r="48" />
          <path d="M104 78a62 62 0 0 1 0 124 M386 78a62 62 0 0 0 0 124" />
        </svg>
        {team?.logoUrl && (
          <Image
            src={team.logoUrl}
            alt=""
            width={380}
            height={380}
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -z-10 size-80 object-contain opacity-[0.06]"
          />
        )}
        <div className="flex size-18 shrink-0 items-center justify-center sm:size-28 xl:size-36">
          {team?.logoUrl ? (
            <Image
              src={team.logoUrl}
              alt=""
              width={144}
              height={144}
              className="size-full object-contain"
            />
          ) : (
            <span className={`${display.className} text-4xl font-semibold`}>
              {team?.abbreviation ?? "—"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {team?.city ?? t("dashboard", "myFranchise")}
          </p>
          <h2
            aria-label={team?.name ?? t("dashboard", "teamFallback")}
            className={`${display.className} mt-2 break-words text-4xl font-semibold uppercase leading-none tracking-tight sm:text-5xl xl:text-6xl`}
          >
            {splitName && team ? (
              <>
                <span className="block">{team.city}</span>
                <span className="block">{team.name.slice(team.city.length + 1)}</span>
              </>
            ) : (
              (team?.name ?? t("dashboard", "teamFallback"))
            )}
          </h2>
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{conference}</span>
            {team?.division && <span className="border-l border-border pl-3">{team.division}</span>}
          </p>
        </div>
        <div className="w-full border-t border-primary/20 pt-4 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("dashboard", "seasonRecord")}
          </p>
          <p className={`${display.className} mt-1 text-6xl font-semibold tabular-nums`}>
            {recordLabel}
          </p>
        </div>
      </section>
      <section aria-label={t("dashboard", "seasonAtGlance")} className="py-1">
        <dl className="grid grid-cols-2 gap-y-6 py-5 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 border-l border-border px-4 first:border-0 first:pl-0 sm:px-6"
            >
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {metric.label}
              </dt>
              <dd className={`${display.className} mt-2 text-4xl font-medium tabular-nums`}>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        {query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("dashboard", "standingsFailed")}
          </p>
        ) : query.isPending ? (
          <output className="text-sm text-muted-foreground">{t("common", "loading")}</output>
        ) : (
          <p className="text-xs text-muted-foreground">
            {record ? t("dashboard", "standingsOrderHelp") : t("dashboard", "standingsUnavailable")}
          </p>
        )}
      </section>
    </>
  );
}
