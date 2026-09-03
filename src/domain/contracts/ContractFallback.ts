import {
  CONTRACT_CAP_TREATMENT,
  CONTRACT_FALLBACK_ASSUMPTION,
  CONTRACT_FALLBACK_BLOCK_REASON,
  CONTRACT_PROVENANCE_QUALITY,
  CONTRACT_SOURCE_METHOD,
  CONTRACT_TYPE,
  type ContractFallbackBlockReason,
} from "@/domain/contracts/ContractClassification";
import { getMinimumSalary } from "@/domain/contracts/MinimumSalarySchedule";

export const CONTRACT_FALLBACK_RESULT = {
  BLOCKED: "blocked",
  EXCLUDED: "excluded",
  RESOLVED: "resolved",
} as const;

export interface ContractFallbackInput {
  season: string;
  currentStandardSalary: number | null;
  isOfficialTwoWay: boolean | null;
  isActiveStandardRoster: boolean;
  isMatchedSourcePlayer: boolean;
  allowUnmatchedRosterExperienceFallback: boolean;
  yearsOfService: number | null;
  inactiveEvidence: { sourceUrl: string; observedDate: string; evidence: string } | null;
}

export function resolveContractFallback(input: ContractFallbackInput) {
  // Eligibility is a gate. Inactive/non-roster players never enter the salary hierarchy.
  if (input.inactiveEvidence || !input.isActiveStandardRoster) {
    return {
      status: CONTRACT_FALLBACK_RESULT.EXCLUDED,
      method: CONTRACT_SOURCE_METHOD.CURATED_INACTIVE_STATUS,
      capTreatment: CONTRACT_CAP_TREATMENT.EXCLUDED_INACTIVE,
      evidence: input.inactiveEvidence,
    } as const;
  }
  if (input.currentStandardSalary !== null) {
    return {
      status: CONTRACT_FALLBACK_RESULT.RESOLVED,
      contractType: CONTRACT_TYPE.STANDARD,
      salaryAmount: input.currentStandardSalary,
      estimated: false,
      quality: CONTRACT_PROVENANCE_QUALITY.OBSERVED,
      method: CONTRACT_SOURCE_METHOD.BASKETBALL_REFERENCE_CURRENT_SALARY,
      capTreatment: CONTRACT_CAP_TREATMENT.STANDARD,
    } as const;
  }
  if (input.isOfficialTwoWay === true) {
    return {
      status: CONTRACT_FALLBACK_RESULT.RESOLVED,
      contractType: CONTRACT_TYPE.TWO_WAY,
      salaryAmount: null,
      estimated: false,
      quality: CONTRACT_PROVENANCE_QUALITY.OFFICIAL,
      method: CONTRACT_SOURCE_METHOD.NBA_G_LEAGUE_TWO_WAY_TRACKER,
      capTreatment: CONTRACT_CAP_TREATMENT.EXCLUDED_TWO_WAY,
    } as const;
  }
  let reason: ContractFallbackBlockReason;
  if (input.isOfficialTwoWay === null) {
    reason = CONTRACT_FALLBACK_BLOCK_REASON.TWO_WAY_SOURCE_UNAVAILABLE;
  } else if (input.yearsOfService === null) {
    if (input.allowUnmatchedRosterExperienceFallback && !input.isMatchedSourcePlayer) {
      const minimum = getMinimumSalary(input.season, 0);
      if (minimum) {
        return {
          status: CONTRACT_FALLBACK_RESULT.RESOLVED,
          contractType: CONTRACT_TYPE.STANDARD,
          salaryAmount: minimum.amount,
          estimated: true,
          quality: CONTRACT_PROVENANCE_QUALITY.ESTIMATED,
          method: CONTRACT_SOURCE_METHOD.CURRENT_ROSTER_ESPN_OMITTED_EXPERIENCE_MINIMUM,
          capTreatment: CONTRACT_CAP_TREATMENT.STANDARD,
          sourceUrl: minimum.schedule.sourceUrl,
          evidence: {
            assumption: CONTRACT_FALLBACK_ASSUMPTION.ESPN_OMITTED_EXPERIENCE_ZERO_YOS,
            detail:
              "ESPN omitted years of NBA service; assumed 0 years for current-roster coverage",
          },
        } as const;
      }
      reason = CONTRACT_FALLBACK_BLOCK_REASON.MINIMUM_SCHEDULE_UNAVAILABLE;
    } else {
      reason = CONTRACT_FALLBACK_BLOCK_REASON.MISSING_YEARS_OF_SERVICE;
    }
  } else {
    const minimum = getMinimumSalary(input.season, input.yearsOfService);
    if (minimum) {
      return {
        status: CONTRACT_FALLBACK_RESULT.RESOLVED,
        contractType: CONTRACT_TYPE.STANDARD,
        salaryAmount: minimum.amount,
        estimated: true,
        quality: CONTRACT_PROVENANCE_QUALITY.ESTIMATED,
        method: CONTRACT_SOURCE_METHOD.YEARS_OF_SERVICE_MINIMUM,
        capTreatment: CONTRACT_CAP_TREATMENT.STANDARD,
        sourceUrl: minimum.schedule.sourceUrl,
      } as const;
    }
    reason = CONTRACT_FALLBACK_BLOCK_REASON.MINIMUM_SCHEDULE_UNAVAILABLE;
  }
  return { status: CONTRACT_FALLBACK_RESULT.BLOCKED, reason } as const;
}
