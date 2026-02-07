import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface PlayerState {
  // State
  selectedPlayerIds: string[];
  positionFilter: string | null;
  searchQuery: string;
  showInactive: boolean;

  // Actions
  selectPlayer: (playerId: string) => void;
  deselectPlayer: (playerId: string) => void;
  togglePlayerSelection: (playerId: string) => void;
  clearSelection: () => void;
  setPositionFilter: (position: string | null) => void;
  setSearchQuery: (query: string) => void;
  setShowInactive: (show: boolean) => void;
  clearFilters: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  devtools(
    (set) => ({
      // Initial state
      selectedPlayerIds: [],
      positionFilter: null,
      searchQuery: "",
      showInactive: false,

      // Actions
      selectPlayer: (playerId) =>
        set(
          (state) => ({
            selectedPlayerIds: [...state.selectedPlayerIds, playerId],
          }),
          false,
          "player/selectPlayer"
        ),

      deselectPlayer: (playerId) =>
        set(
          (state) => ({
            selectedPlayerIds: state.selectedPlayerIds.filter((id) => id !== playerId),
          }),
          false,
          "player/deselectPlayer"
        ),

      togglePlayerSelection: (playerId) =>
        set(
          (state) => ({
            selectedPlayerIds: state.selectedPlayerIds.includes(playerId)
              ? state.selectedPlayerIds.filter((id) => id !== playerId)
              : [...state.selectedPlayerIds, playerId],
          }),
          false,
          "player/togglePlayerSelection"
        ),

      clearSelection: () => set({ selectedPlayerIds: [] }, false, "player/clearSelection"),

      setPositionFilter: (position) =>
        set({ positionFilter: position }, false, "player/setPositionFilter"),

      setSearchQuery: (query) => set({ searchQuery: query }, false, "player/setSearchQuery"),

      setShowInactive: (show) => set({ showInactive: show }, false, "player/setShowInactive"),

      clearFilters: () =>
        set(
          { positionFilter: null, searchQuery: "", showInactive: false },
          false,
          "player/clearFilters"
        ),
    }),
    { name: "PlayerStore" }
  )
);

// Selectors
export const selectSelectedPlayerIds = (state: PlayerState) => state.selectedPlayerIds;
export const selectIsPlayerSelected = (playerId: string) => (state: PlayerState) =>
  state.selectedPlayerIds.includes(playerId);
export const selectPositionFilter = (state: PlayerState) => state.positionFilter;
export const selectSearchQuery = (state: PlayerState) => state.searchQuery;
export const selectShowInactive = (state: PlayerState) => state.showInactive;
