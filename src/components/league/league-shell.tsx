"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { body, display } from "@/app/ui-preview/fonts";
import { useT } from "@/application/providers/I18nProvider";

const sections = ["overview", "standings", "teams", "players", "leaders", "transactions"] as const;

interface LeagueShellProps {
  gameId: string;
  children: ReactNode;
}

export function LeagueShell({ gameId, children }: LeagueShellProps) {
  const t = useT();
  const pathname = usePathname();
  const teamsHref = `/games/${gameId}/dashboard/league/teams`;

  return (
    <div data-slot="league-screen" className={`${body.className} min-w-0 space-y-5`}>
      <header className="space-y-1">
        <h1 className={`${display.className} text-3xl font-semibold tracking-tight sm:text-4xl`}>
          {t("league", "title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("league", "description")}</p>
      </header>

      <nav aria-label={t("league", "navigation")} className="min-w-0 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-border/60 pb-2">
          {sections.map((section) => (
            <li key={section}>
              {section === "teams" || section === "standings" ? (
                <Link
                  href={
                    section === "teams" ? teamsHref : `/games/${gameId}/dashboard/league/standings`
                  }
                  aria-current={
                    pathname === `/games/${gameId}/dashboard/league/${section}` ||
                    pathname.startsWith(`/games/${gameId}/dashboard/league/${section}/`)
                      ? "page"
                      : undefined
                  }
                  className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    pathname === `/games/${gameId}/dashboard/league/${section}` ||
                    pathname.startsWith(`/games/${gameId}/dashboard/league/${section}/`)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t("league", section)}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
                >
                  {t("league", section)}
                  <span className="rounded-sm border border-border/60 px-1.5 py-0.5 text-xs">
                    {t("league", "comingSoon")}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
