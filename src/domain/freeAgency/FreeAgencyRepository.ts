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
  listPendingOffers(gameId: string): Promise<readonly PendingFreeAgencyOffer[]>;
  submitOffer(input: {
    gameId: string;
    playerId: string;
    requestId: string;
    offer: FreeAgencyOffer;
  }): Promise<PendingFreeAgencyOffer>;
}
