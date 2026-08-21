import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface TeamState {
  // State
  /** Selected team for UI flows (team picker, filters). Gameplay team context comes from Game.selectedTeamId via URL. */
  selectedTeamId: string | null;
  searchQuery: string;
  conferenceFilter: "all" | "east" | "west";

  // Actions
  selectTeam: (teamId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setConferenceFilter: (conference: "all" | "east" | "west") => void;
  clearFilters: () => void;
}

export const useTeamStore = create<TeamState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedTeamId: null,
      searchQuery: "",
      conferenceFilter: "all",

      // Actions
      selectTeam: (teamId) => set({ selectedTeamId: teamId }, false, "team/selectTeam"),

      setSearchQuery: (query) => set({ searchQuery: query }, false, "team/setSearchQuery"),

      setConferenceFilter: (conference) =>
        set({ conferenceFilter: conference }, false, "team/setConferenceFilter"),

      clearFilters: () =>
        set({ searchQuery: "", conferenceFilter: "all" }, false, "team/clearFilters"),
    }),
    { name: "TeamStore" }
  )
);

// Selectors
export const selectSelectedTeamId = (state: TeamState) => state.selectedTeamId;
export const selectSearchQuery = (state: TeamState) => state.searchQuery;
export const selectConferenceFilter = (state: TeamState) => state.conferenceFilter;
