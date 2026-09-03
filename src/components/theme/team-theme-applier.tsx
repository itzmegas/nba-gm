"use client";

import { useEffect } from "react";
import { selectTeamAbbreviation, useTeamThemeStore } from "@/application/stores/useTeamThemeStore";
import { isKnownTeamAbbreviation } from "@/domain/constants/team-colors";

/**
 * Bridges the persisted team-theme store to the DOM: keeps
 * `document.documentElement.dataset.team` in sync with the selected
 * abbreviation so the per-team CSS token overrides in globals.css apply.
 * Renders nothing.
 */
export function TeamThemeApplier() {
  const teamAbbreviation = useTeamThemeStore(selectTeamAbbreviation);

  useEffect(() => {
    const root = document.documentElement;
    if (teamAbbreviation && isKnownTeamAbbreviation(teamAbbreviation)) {
      root.dataset.team = teamAbbreviation;
    } else {
      delete root.dataset.team;
    }
  }, [teamAbbreviation]);

  return null;
}
