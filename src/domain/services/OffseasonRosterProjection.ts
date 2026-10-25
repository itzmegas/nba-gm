import type { OffseasonContractOutlook } from "@/domain/entities/Offseason";
import type { OffseasonContract } from "@/domain/entities/OffseasonContract";
import type { OffseasonPlayerOption } from "@/domain/entities/OffseasonPlayerOption";

export const ROSTER_PROJECTION = {
  COVERED: "projectedCoverage",
  EXERCISED: "projectedExercise",
  DEPARTURE: "projectedDeparture",
  PENDING: "projectedPending",
  UNKNOWN: "projectedUnknown",
} as const;

export function getOffseasonRosterProjection(
  outlook: OffseasonContractOutlook,
  plan?: OffseasonContract,
  playerOption?: OffseasonPlayerOption
): (typeof ROSTER_PROJECTION)[keyof typeof ROSTER_PROJECTION] {
  if (outlook.estimated || outlook.status === "unknown") return ROSTER_PROJECTION.UNKNOWN;
  if (plan && (plan.status !== outlook.status || plan.nextSalary !== outlook.nextSalary))
    return ROSTER_PROJECTION.UNKNOWN;
  if (outlook.status === "expiring") return ROSTER_PROJECTION.DEPARTURE;
  if (outlook.status === "continuing") return ROSTER_PROJECTION.COVERED;
  if (outlook.nextSalary === null) return ROSTER_PROJECTION.PENDING;
  const decision = outlook.status === "team_option" ? plan?.decision : playerOption?.decision;
  if (
    outlook.status === "player_option" &&
    playerOption?.nextSalary !== undefined &&
    playerOption.nextSalary !== outlook.nextSalary
  )
    return ROSTER_PROJECTION.UNKNOWN;
  if (decision === "exercise") return ROSTER_PROJECTION.EXERCISED;
  if (decision === "decline") return ROSTER_PROJECTION.DEPARTURE;
  return ROSTER_PROJECTION.PENDING;
}
