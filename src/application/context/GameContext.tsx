"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const GameIdContext = createContext<string | null>(null);

interface GameIdProviderProps {
  gameId: string;
  children: ReactNode;
}

export function GameIdProvider({ gameId, children }: GameIdProviderProps) {
  return <GameIdContext.Provider value={gameId}>{children}</GameIdContext.Provider>;
}

export function useCurrentGameId() {
  const gameId = useContext(GameIdContext);

  if (!gameId) {
    throw new Error("useCurrentGameId must be used inside GameIdProvider");
  }

  return gameId;
}
