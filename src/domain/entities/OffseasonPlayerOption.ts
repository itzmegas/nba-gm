import type { OffseasonDecision } from "@/domain/entities/OffseasonContract";

export const PLAYER_OPTION_REASON = {
  SALARY_NOT_LOWER: "salary_not_lower",
  SALARY_LOWER: "salary_lower",
} as const;
export type PlayerOptionReason = (typeof PLAYER_OPTION_REASON)[keyof typeof PLAYER_OPTION_REASON];
export const PLAYER_OPTION_POLICY_VERSION = "salary-comparison-v1";

export interface OffseasonPlayerOption {
  gameId: string;
  seasonYear: number;
  playerId: string;
  teamId: string;
  currentSalary: number;
  nextSalary: number;
  decision: OffseasonDecision;
  reason: PlayerOptionReason;
  policyVersion: typeof PLAYER_OPTION_POLICY_VERSION;
  resolvedAt: string;
}
