"use client";

import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { selectTeamAbbreviation, useTeamThemeStore } from "@/application/stores/useTeamThemeStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TEAM_ABBREVIATIONS, TEAM_METADATA } from "@/domain/constants/team-colors";

/**
 * Lets the user reskin the whole app with a team's brand colors.
 * The swatches are the only place allowed to use raw inline colors:
 * they preview the theme that will be applied via CSS token overrides.
 */
export function TeamThemeSelector() {
  const t = useT();
  const teamAbbreviation = useTeamThemeStore(selectTeamAbbreviation);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setTeam = useTeamThemeStore((state) => state.setTeam);
  const selectedLabel =
    mounted && teamAbbreviation && TEAM_METADATA[teamAbbreviation]
      ? `${TEAM_METADATA[teamAbbreviation].city} ${TEAM_METADATA[teamAbbreviation].name}`
      : t("dashboard", "teamThemeDefault");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("dashboard", "teamTheme")}>
          <Palette className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{selectedLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTeam(null)}>
          {t("dashboard", "teamThemeDefault")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {TEAM_ABBREVIATIONS.map((abbreviation) => {
          const metadata = TEAM_METADATA[abbreviation];
          if (!metadata) return null;
          return (
            <DropdownMenuItem key={abbreviation} onClick={() => setTeam(abbreviation)}>
              {/* Inline color is an intentional preview of the team's primary brand color. */}
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: metadata.color }}
              />
              <span className="truncate">
                {metadata.city} {metadata.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {abbreviation}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
