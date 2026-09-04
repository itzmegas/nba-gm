"use client";

import { useEffect } from "react";
import { isKnownTeamAbbreviation } from "@/domain/constants/team-colors";

interface TeamThemeApplierProps {
  teamAbbreviation: string | null | undefined;
}

/** Keeps the current game's team theme in sync with the document root. */
export function TeamThemeApplier({ teamAbbreviation }: TeamThemeApplierProps) {
  useEffect(() => {
    const root = document.documentElement;
    if (teamAbbreviation && isKnownTeamAbbreviation(teamAbbreviation)) {
      root.dataset.team = teamAbbreviation;
    } else {
      delete root.dataset.team;
    }

    return () => {
      delete root.dataset.team;
    };
  }, [teamAbbreviation]);

  return null;
}
