import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface GameStoreState {
  pendingSelectedTeamId: string | null;
  pendingGameName: string;
  isCreating: boolean;
  createError: string | null;
  lastSelectedGameId: string | null;
  setPendingSelectedTeamId: (teamId: string | null) => void;
  setPendingGameName: (name: string) => void;
  startCreate: () => void;
  finishCreate: (gameId: string) => void;
  failCreate: (error: string) => void;
  resetCreateFlow: () => void;
}

export const useGameStore = create<GameStoreState>()(
  devtools(
    (set) => ({
      pendingSelectedTeamId: null,
      pendingGameName: "",
      isCreating: false,
      createError: null,
      lastSelectedGameId: null,

      setPendingSelectedTeamId: (teamId) =>
        set({ pendingSelectedTeamId: teamId }, false, "game/setPendingSelectedTeamId"),

      setPendingGameName: (name) =>
        set({ pendingGameName: name }, false, "game/setPendingGameName"),

      startCreate: () => set({ isCreating: true, createError: null }, false, "game/startCreate"),

      finishCreate: (gameId) =>
        set(
          {
            pendingSelectedTeamId: null,
            pendingGameName: "",
            isCreating: false,
            createError: null,
            lastSelectedGameId: gameId,
          },
          false,
          "game/finishCreate"
        ),

      failCreate: (error) =>
        set({ isCreating: false, createError: error }, false, "game/failCreate"),

      resetCreateFlow: () =>
        set(
          {
            pendingSelectedTeamId: null,
            pendingGameName: "",
            isCreating: false,
            createError: null,
          },
          false,
          "game/resetCreateFlow"
        ),
    }),
    { name: "GameStore" }
  )
);

export const selectPendingSelectedTeamId = (state: GameStoreState) => state.pendingSelectedTeamId;
export const selectPendingGameName = (state: GameStoreState) => state.pendingGameName;
export const selectIsCreating = (state: GameStoreState) => state.isCreating;
export const selectCreateError = (state: GameStoreState) => state.createError;
export const selectLastSelectedGameId = (state: GameStoreState) => state.lastSelectedGameId;
