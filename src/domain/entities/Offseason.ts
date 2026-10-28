export interface OffseasonEntry {
  seasonYear: number;
  enteredAt: string;
}

export const OFFSEASON_CONTRACT_STATUS = {
  EXPIRING: "expiring",
  PLAYER_OPTION: "player_option",
  TEAM_OPTION: "team_option",
  CONTINUING: "continuing",
  UNKNOWN: "unknown",
} as const;

export type OffseasonContractStatus =
  (typeof OFFSEASON_CONTRACT_STATUS)[keyof typeof OFFSEASON_CONTRACT_STATUS];

export interface OffseasonContractOutlook {
  status: OffseasonContractStatus;
  nextSalary: number | null;
  estimated: boolean;
}
