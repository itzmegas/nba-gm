import type {
  ContractCapTreatment,
  ContractProvenanceQuality,
  ContractSourceMethod,
  ContractType,
} from "@/domain/contracts/ContractClassification";
import type {
  ContractOptionKind,
  ContractSeasonGuaranteeKind,
} from "@/domain/contracts/ContractSnapshot";

export const CONTRACT_IDENTITY_RESOLUTION_STATUS = {
  OBSERVED_STANDARD: "observed-standard",
  OFFICIAL_TWO_WAY: "official-two-way",
  ESTIMATED_MINIMUM: "estimated-minimum",
  INACTIVE_EXCLUDED: "inactive-excluded",
  UNCLASSIFIED: "unclassified",
} as const;

export type ContractIdentityResolutionStatus =
  (typeof CONTRACT_IDENTITY_RESOLUTION_STATUS)[keyof typeof CONTRACT_IDENTITY_RESOLUTION_STATUS];

export interface GameContractSeason {
  seasonLabel: string;
  startYear: number;
  endYear: number;
  salaryAmount: number | null;
  optionKind: ContractOptionKind;
  guaranteeKind: ContractSeasonGuaranteeKind;
}

export interface GameContractAgreement {
  id: string;
  gameId: string;
  playerId: string;
  teamId: string;
  startSeasonLabel: string | null;
  endSeasonLabel: string | null;
  remainingGuaranteedAmount: number | null;
  contractType: ContractType;
  provenanceQuality: ContractProvenanceQuality;
  sourceMethod: ContractSourceMethod;
  estimated: boolean;
  capTreatment: ContractCapTreatment;
  seasons: readonly GameContractSeason[];
}

export interface GamePlayerContractState {
  playerId: string;
  resolutionStatus: ContractIdentityResolutionStatus;
  contractType: ContractType | null;
  provenanceQuality: ContractProvenanceQuality | null;
  sourceMethod: ContractSourceMethod | null;
  estimated: boolean;
  capTreatment: ContractCapTreatment;
  exclusionEvidence: Readonly<Record<string, unknown>> | null;
  agreement: GameContractAgreement | null;
}
