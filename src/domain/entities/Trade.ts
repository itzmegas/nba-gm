import type { Contract } from "./Contract";
import type { Player } from "./Player";

export interface TradeAsset {
  type: "player" | "pick" | "cash";
  player?: Player;
  contract?: Contract;
  // Para picks del draft
  pickYear?: number;
  pickRound?: number;
  pickProtection?: string;
  // Para cash considerations
  cashAmount?: number;
}

export interface TradePackage {
  teamId: string;
  teamName: string; // Para debugging/logs
  outgoingAssets: TradeAsset[];
  incomingAssets: TradeAsset[]; // Esto se calcula después
}

export interface TradeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    teamA: TeamTradeDetails;
    teamB: TeamTradeDetails;
  };
}

export interface TeamTradeDetails {
  teamId: string;
  outgoingSalary: number;
  incomingSalary: number;
  salaryDelta: number;
  rosterSizeAfter: number;
  isOverCapAfter: boolean;
  isOverHardCapAfter: boolean;
}
