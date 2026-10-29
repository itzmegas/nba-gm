"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { selectConferenceStandings } from "@/application/dashboard/selectConferenceStandings";
import { useStandings } from "@/application/hooks/simulation";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useLocale, useT } from "@/application/providers/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StandingsWidget({ gameId, teamId }: { gameId: string; teamId: string }) {
  const t = useT();
  const locale = useLocale();
  const query = useStandings(gameId);
  const { data: teams = [] } = useTeams();
  const conference = teams.find((team) => team.id === teamId)?.conference;
  const standings = selectConferenceStandings(query.data ?? [], teams, teamId);
  const selectedIndex = standings.findIndex((standing) => standing.teamId === teamId);
  const start = Math.max(0, Math.min(selectedIndex - 2, standings.length - 5));
  return (
    <Card className="min-w-0 gap-4 rounded-md border-border/60 bg-card py-4 shadow-none">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            {t("dashboard", "conferenceStandings")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {conference === "East"
              ? t("games", "east")
              : conference === "West"
                ? t("games", "west")
                : "—"}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link href={`/games/${gameId}/dashboard/league/standings`}>
            {t("dashboard", "viewStandings")}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <output className="block py-8 text-sm text-muted-foreground">
            {t("common", "loading")}
          </output>
        ) : query.isError ? (
          <p role="alert" className="py-8 text-sm text-destructive">
            {t("dashboard", "standingsFailed")}
          </p>
        ) : standings.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            {t("dashboard", "standingsUnavailable")}
          </p>
        ) : (
          <>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-3 text-left font-medium">#</th>
                  <th className="pb-3 text-left font-medium">{t("dashboard", "teamFallback")}</th>
                  <th className="pb-3 text-right font-medium">{t("dashboard", "winsShort")}</th>
                  <th className="pb-3 text-right font-medium">{t("dashboard", "lossesShort")}</th>
                  <th className="pb-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(start, start + 5).map((standing, index) => {
                  const team = teams.find((team) => team.id === standing.teamId);
                  return (
                    <tr
                      key={standing.teamId}
                      className={
                        standing.teamId === teamId
                          ? "bg-primary/10 font-bold"
                          : "border-b border-border/40 last:border-0"
                      }
                    >
                      <td className="rounded-l-md py-3 pl-2">{start + index + 1}</td>
                      <td className="py-3 pr-2">
                        <Link
                          href={`/games/${gameId}/dashboard/league/teams/${standing.teamId}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          {team?.logoUrl && (
                            <Image
                              src={team.logoUrl}
                              alt=""
                              width={24}
                              height={24}
                              className="size-6 shrink-0 object-contain"
                            />
                          )}
                          <span>{team?.name ?? "—"}</span>
                        </Link>
                      </td>
                      <td className="py-3 text-right">{standing.wins}</td>
                      <td className="py-3 pl-2 text-right">{standing.losses}</td>
                      <td className="rounded-r-md py-3 pr-2 text-right text-muted-foreground">
                        {standing.wins + standing.losses === 0
                          ? "—"
                          : new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
                              style: "percent",
                              maximumFractionDigits: 1,
                            }).format(standing.wins / (standing.wins + standing.losses))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {t("dashboard", "standingsOrderHelp")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
