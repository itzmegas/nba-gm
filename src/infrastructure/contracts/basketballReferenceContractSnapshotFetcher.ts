import type { ContractSnapshotFetcher } from "@/application/contracts/getFreshContractSnapshot";
import type { ContractSnapshotCacheIdentity } from "@/domain/contracts/ContractSnapshotCache";
import {
  type BasketballReferenceContractSnapshot,
  fetchBasketballReferenceTeamContracts,
} from "@/infrastructure/contracts/basketballReferenceContractSource";

export const basketballReferenceContractSnapshotFetcher: ContractSnapshotFetcher<BasketballReferenceContractSnapshot> =
  {
    async fetch(identity: ContractSnapshotCacheIdentity, signal?: AbortSignal) {
      const snapshot = await fetchBasketballReferenceTeamContracts({
        teamAbbreviation: identity.team,
        season: identity.season,
        signal,
      });
      return {
        snapshot,
        contentHash: snapshot.metadata.contentHash,
        observedAt: snapshot.metadata.observedAt,
      };
    },
  };
