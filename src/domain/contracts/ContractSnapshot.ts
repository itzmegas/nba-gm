export const CONTRACT_OPTION_KIND = {
  NONE: "none",
  PLAYER: "player",
  TEAM: "team",
  UNKNOWN: "unknown",
} as const;

export type ContractOptionKind = (typeof CONTRACT_OPTION_KIND)[keyof typeof CONTRACT_OPTION_KIND];

export const CONTRACT_SEASON_GUARANTEE_KIND = {
  GUARANTEED: "guaranteed",
  NOT_GUARANTEED: "not-guaranteed",
  PARTIALLY_GUARANTEED: "partially-guaranteed",
  UNKNOWN: "unknown",
} as const;

export type ContractSeasonGuaranteeKind =
  (typeof CONTRACT_SEASON_GUARANTEE_KIND)[keyof typeof CONTRACT_SEASON_GUARANTEE_KIND];

export interface ContractSeasonSnapshot {
  seasonLabel: string;
  startYear: number;
  endYear: number;
  salaryAmount: number | null;
  optionKind: ContractOptionKind;
  guaranteeKind: ContractSeasonGuaranteeKind;
}

export interface ContractAgreementSnapshot {
  startSeasonLabel: string | null;
  endSeasonLabel: string | null;
  seasons: readonly ContractSeasonSnapshot[];
  remainingGuaranteedAmount: number | null;
}

export interface ContractSnapshotProvenance {
  source: string;
  sourceUrl: string;
  sourcePlayerId: string;
  observedAt: string;
  notes: readonly string[] | null;
}

export interface ContractSnapshot {
  playerId: string | null;
  teamId: string | null;
  agreement: ContractAgreementSnapshot;
  provenance: ContractSnapshotProvenance;
}
