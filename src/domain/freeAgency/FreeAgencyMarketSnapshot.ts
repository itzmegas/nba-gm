import type { FreeAgencyOffer } from "@/domain/freeAgency/freeAgencyMarket";

export const FREE_AGENCY_MARKET_OFFER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export type FreeAgencyMarketOfferStatus =
  (typeof FREE_AGENCY_MARKET_OFFER_STATUS)[keyof typeof FREE_AGENCY_MARKET_OFFER_STATUS];

export const FREE_AGENCY_OFFER_ORIGIN = {
  HUMAN: "human",
  AI: "ai",
} as const;

export type FreeAgencyOfferOrigin =
  (typeof FREE_AGENCY_OFFER_ORIGIN)[keyof typeof FREE_AGENCY_OFFER_ORIGIN];

export interface FreeAgencyMarketContext {
  teamId: string;
  season: string;
  simulationDate: string;
  salaryCap: number;
  payroll: number;
  capRoom: number;
  rosterCount: number;
}

export interface FreeAgencyMarketPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  minimumSalary: number;
  maximumSalary: number;
}

export interface FreeAgencyMarketOffer {
  id: string;
  requestId: string;
  gameId: string;
  playerId: string;
  teamId: string;
  offer: FreeAgencyOffer;
  dueDate: string;
  status: FreeAgencyMarketOfferStatus;
  origin: FreeAgencyOfferOrigin;
  playerName: string;
  teamName: string;
  resolvedDate: string | null;
  resolutionReason: string | null;
  resolutionDetail: string | null;
  resolvedContractId: string | null;
}

export interface FreeAgencyMarketSnapshot {
  gameId: string;
  supported: boolean;
  context: FreeAgencyMarketContext | null;
  candidates: readonly FreeAgencyMarketPlayer[];
  offers: readonly FreeAgencyMarketOffer[];
}

export interface SubmitFreeAgencyOfferInput {
  gameId: string;
  playerId: string;
  requestId: string;
  offer: FreeAgencyOffer;
}
