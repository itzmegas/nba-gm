import type {
  FreeAgencyMarketSnapshot,
  SubmitFreeAgencyOfferInput,
} from "@/domain/freeAgency/FreeAgencyMarketSnapshot";
import type { FreeAgencyOffer } from "@/domain/freeAgency/freeAgencyMarket";

export interface PendingFreeAgencyOffer {
  id: string;
  requestId: string;
  gameId: string;
  playerId: string;
  teamId: string;
  offer: FreeAgencyOffer;
  dueDate: string;
  status: "pending";
}

export interface FreeAgencyRepository {
  getMarket(gameId: string): Promise<FreeAgencyMarketSnapshot>;
  listPendingOffers(gameId: string): Promise<readonly PendingFreeAgencyOffer[]>;
  submitOffer(input: SubmitFreeAgencyOfferInput): Promise<PendingFreeAgencyOffer>;
}
