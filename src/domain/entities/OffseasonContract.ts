export const OFFSEASON_DECISION = { EXERCISE: "exercise", DECLINE: "decline" } as const;
export type OffseasonDecision = (typeof OFFSEASON_DECISION)[keyof typeof OFFSEASON_DECISION];
export const OFFSEASON_LEDGER_STATUS = {
  EXPIRING: "expiring",
  TEAM_OPTION: "team_option",
  PLAYER_OPTION: "player_option",
} as const;
export type OffseasonLedgerStatus =
  (typeof OFFSEASON_LEDGER_STATUS)[keyof typeof OFFSEASON_LEDGER_STATUS];

export interface OffseasonContract {
  playerId: string;
  teamId: string;
  seasonYear: number;
  status: OffseasonLedgerStatus;
  decision: OffseasonDecision | null;
  nextSalary: number | null;
}
