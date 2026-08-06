import { create } from "zustand";

export const BATCH_SIMULATION_MODE = {
  MONTH: "month",
  SEASON: "season",
} as const;

export type BatchSimulationMode =
  (typeof BATCH_SIMULATION_MODE)[keyof typeof BATCH_SIMULATION_MODE];

interface BatchSimulationState {
  isActive: boolean;
  mode: BatchSimulationMode | null;
  completedDays: number;
  totalDays: number | null;
  error: string | null;
  startBatch: (mode: BatchSimulationMode, totalDays: number | null) => boolean;
  startDay: () => boolean;
  updateProgress: (completedDays: number) => void;
  finishDay: () => void;
  finishBatch: () => void;
  failBatch: (error: string) => void;
}

export const useBatchSimulationStore = create<BatchSimulationState>((set, get) => ({
  isActive: false,
  mode: null,
  completedDays: 0,
  totalDays: null,
  error: null,
  startBatch: (mode, totalDays) => {
    if (get().isActive) return false;
    set({ isActive: true, mode, completedDays: 0, totalDays, error: null });
    return true;
  },
  startDay: () => {
    if (get().isActive) return false;
    set({ isActive: true, mode: null, completedDays: 0, totalDays: null, error: null });
    return true;
  },
  updateProgress: (completedDays) => set({ completedDays }),
  finishDay: () => set((state) => (state.mode === null ? { isActive: false } : state)),
  finishBatch: () => set({ isActive: false, mode: null }),
  failBatch: (error) => set({ isActive: false, mode: null, error }),
}));
