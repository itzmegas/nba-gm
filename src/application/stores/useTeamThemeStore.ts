import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { isKnownTeamAbbreviation } from "@/domain/constants/team-colors";

interface TeamThemeState {
  // State
  /** Abbreviation of the team whose colors reskin the app, or null for the neutral default. */
  teamAbbreviation: string | null;

  // Actions
  /** Applies a team theme; null clears it back to the neutral default. Unknown abbreviations are ignored. */
  setTeam: (abbreviation: string | null) => void;
}

export const TEAM_THEME_STORAGE_KEY = "nba-gm:team-theme";

export const useTeamThemeStore = create<TeamThemeState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        teamAbbreviation: null,

        // Actions
        setTeam: (abbreviation) => {
          // Defensive: never persist/apply an unknown abbreviation.
          if (abbreviation !== null && !isKnownTeamAbbreviation(abbreviation)) return;
          set({ teamAbbreviation: abbreviation }, false, "teamTheme/setTeam");
        },
      }),
      {
        name: TEAM_THEME_STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
      }
    ),
    { name: "TeamThemeStore" }
  )
);

// Selectors
export const selectTeamAbbreviation = (state: TeamThemeState) => state.teamAbbreviation;
