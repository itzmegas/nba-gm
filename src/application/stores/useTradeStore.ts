import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface TradePackage {
  teamId: string;
  playerIds: string[];
  contracts: string[];
  cashConsiderations: number;
  draftPicks: string[];
}

interface TradeValidation {
  isValid: boolean;
  errors: string[];
  salaryDiff: number;
}

interface TradeState {
  // State
  teamA: TradePackage | null;
  teamB: TradePackage | null;
  isValidating: boolean;
  validationResult: TradeValidation | null;
  proposedTrades: TradePackage[];

  // Actions
  setTeamA: (teamId: string) => void;
  setTeamB: (teamId: string) => void;
  addPlayerToTrade: (teamId: string, playerId: string) => void;
  removePlayerFromTrade: (teamId: string, playerId: string) => void;
  addCashToTrade: (teamId: string, amount: number) => void;
  addDraftPickToTrade: (teamId: string, pickDescription: string) => void;
  clearTrade: () => void;
  swapTeams: () => void;
  saveProposedTrade: () => void;
  executeTrade: () => Promise<void>;
}

export const useTradeStore = create<TradeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      teamA: null,
      teamB: null,
      isValidating: false,
      validationResult: null,
      proposedTrades: [],

      // Actions
      setTeamA: (teamId) =>
        set(
          {
            teamA: { teamId, playerIds: [], contracts: [], cashConsiderations: 0, draftPicks: [] },
          },
          false,
          "trade/setTeamA"
        ),

      setTeamB: (teamId) =>
        set(
          {
            teamB: { teamId, playerIds: [], contracts: [], cashConsiderations: 0, draftPicks: [] },
          },
          false,
          "trade/setTeamB"
        ),

      addPlayerToTrade: (teamId, playerId) =>
        set(
          (state) => {
            const targetTeam = state.teamA?.teamId === teamId ? "teamA" : "teamB";
            const currentTeam = state[targetTeam];
            if (!currentTeam) return state;

            return {
              [targetTeam]: {
                ...currentTeam,
                playerIds: [...currentTeam.playerIds, playerId],
              },
            };
          },
          false,
          "trade/addPlayerToTrade"
        ),

      removePlayerFromTrade: (teamId, playerId) =>
        set(
          (state) => {
            const targetTeam = state.teamA?.teamId === teamId ? "teamA" : "teamB";
            const currentTeam = state[targetTeam];
            if (!currentTeam) return state;

            return {
              [targetTeam]: {
                ...currentTeam,
                playerIds: currentTeam.playerIds.filter((id) => id !== playerId),
              },
            };
          },
          false,
          "trade/removePlayerFromTrade"
        ),

      addCashToTrade: (teamId, amount) =>
        set(
          (state) => {
            const targetTeam = state.teamA?.teamId === teamId ? "teamA" : "teamB";
            const currentTeam = state[targetTeam];
            if (!currentTeam) return state;

            return {
              [targetTeam]: {
                ...currentTeam,
                cashConsiderations: currentTeam.cashConsiderations + amount,
              },
            };
          },
          false,
          "trade/addCashToTrade"
        ),

      addDraftPickToTrade: (teamId, pickDescription) =>
        set(
          (state) => {
            const targetTeam = state.teamA?.teamId === teamId ? "teamA" : "teamB";
            const currentTeam = state[targetTeam];
            if (!currentTeam) return state;

            return {
              [targetTeam]: {
                ...currentTeam,
                draftPicks: [...currentTeam.draftPicks, pickDescription],
              },
            };
          },
          false,
          "trade/addDraftPickToTrade"
        ),

      clearTrade: () =>
        set({ teamA: null, teamB: null, validationResult: null }, false, "trade/clearTrade"),

      swapTeams: () =>
        set(
          (state) => ({
            teamA: state.teamB,
            teamB: state.teamA,
          }),
          false,
          "trade/swapTeams"
        ),

      saveProposedTrade: () => {
        const { teamA, proposedTrades } = get();
        if (teamA) {
          set({ proposedTrades: [...proposedTrades, teamA] }, false, "trade/saveProposedTrade");
        }
      },

      executeTrade: async () => {
        // TODO: Implementar lógica de ejecución de traspaso
        // Esto debería llamar a un use case o API route
        set({ isValidating: true }, false, "trade/executeTrade/start");
        try {
          // Simulación de ejecución
          await new Promise((resolve) => setTimeout(resolve, 1000));
          set(
            { teamA: null, teamB: null, isValidating: false },
            false,
            "trade/executeTrade/success"
          );
        } catch {
          set({ isValidating: false }, false, "trade/executeTrade/error");
        }
      },
    }),
    { name: "TradeStore" }
  )
);

// Selectors
export const selectTeamA = (state: TradeState) => state.teamA;
export const selectTeamB = (state: TradeState) => state.teamB;
export const selectTradePlayers = (teamId: string) => (state: TradeState) => {
  const team = state.teamA?.teamId === teamId ? state.teamA : state.teamB;
  return team?.playerIds ?? [];
};
export const selectIsTradeValid = (state: TradeState) => state.validationResult?.isValid ?? false;
