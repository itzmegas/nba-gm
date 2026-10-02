import { getSalaryCapThresholds, NBA_RULES } from "@/domain/constants/nba-rules";
import type { GamePlayerContractState } from "@/domain/contracts/GameContract";
import { CONTRACT_IDENTITY_RESOLUTION_STATUS } from "@/domain/contracts/GameContract";
import { getMinimumSalary } from "@/domain/contracts/MinimumSalarySchedule";
import type { Player } from "@/domain/entities/Player";
import type { PlayerState } from "@/domain/entities/PlayerState";

export const FREE_AGENCY_CLASSIFICATION = {
  CONFIRMED_UNRESTRICTED: "confirmed-unrestricted-free-agent",
  UNCLASSIFIED: "unclassified",
} as const;

export type FreeAgencyClassification =
  (typeof FREE_AGENCY_CLASSIFICATION)[keyof typeof FREE_AGENCY_CLASSIFICATION];

export interface FreeAgencyCandidate {
  gameId: string;
  player: Player;
  playerState: PlayerState;
  contractState: GamePlayerContractState;
  classification: FreeAgencyClassification;
}

export interface FreeAgencyOffer {
  season: string;
  annualSalary: number;
  years: number;
}

export interface FreeAgencyTeam {
  gameId: string;
  teamId: string;
  payroll: number;
  rosterCount: number;
  roleOpportunity: number;
  teamQuality: number;
}

export interface FreeAgencySimulationPolicy {
  moneyWeight: number;
  opportunityWeight: number;
  teamQualityWeight: number;
}

interface NormalizedSimulationWeights {
  money: number;
  opportunity: number;
  teamQuality: number;
}

export interface FreeAgencyOfferInput {
  gameId: string;
  team: FreeAgencyTeam;
  candidate: FreeAgencyCandidate;
  offer: FreeAgencyOffer;
  simulationPolicy?: FreeAgencySimulationPolicy;
}

export const DEFAULT_FREE_AGENCY_SIMULATION_POLICY: FreeAgencySimulationPolicy = {
  moneyWeight: 0.6,
  opportunityWeight: 0.25,
  teamQualityWeight: 0.15,
};

export const FREE_AGENCY_REASON = {
  CAP_ROOM: "cap-room",
  CANDIDATE_UNAVAILABLE: "candidate-unavailable",
  INVALID_CONTEXT: "invalid-context",
  INVALID_OFFER: "invalid-offer",
  MINIMUM_SALARY_EXCEPTION: "minimum-salary-exception",
  ROSTER_MAXIMUM: "roster-maximum",
  SALARY_BELOW_MINIMUM: "salary-below-minimum",
  SALARY_ABOVE_MAXIMUM: "salary-above-maximum",
  SALARY_SCHEDULE_UNAVAILABLE: "salary-schedule-unavailable",
  ROLE_OPPORTUNITY: "role-opportunity",
  TEAM_QUALITY: "team-quality",
  OFFER_VALUE: "offer-value",
} as const;

export type FreeAgencyReasonCode = (typeof FREE_AGENCY_REASON)[keyof typeof FREE_AGENCY_REASON];

export interface FreeAgencyReason {
  code: FreeAgencyReasonCode;
  detail: string;
  contribution?: number;
}

export interface FreeAgencyOfferEvaluation {
  legal: boolean;
  score: number;
  reasons: readonly FreeAgencyReason[];
}

const MAX_SUPPORTED_OFFER_YEARS = 5;
const MAX_SERVICE_YEARS = 99;

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasValidDates(createdAt: Date, updatedAt: Date): boolean {
  return (
    createdAt instanceof Date &&
    updatedAt instanceof Date &&
    Number.isFinite(createdAt.getTime()) &&
    Number.isFinite(updatedAt.getTime()) &&
    updatedAt.getTime() >= createdAt.getTime()
  );
}

function isValidSeason(season: string): boolean {
  const match = /^(\d{4})-(\d{2})$/u.exec(season);
  return match !== null && Number(match[2]) === (Number(match[1]) + 1) % 100;
}

function isEligibleCandidate(gameId: string, candidate: FreeAgencyCandidate): boolean {
  return (
    candidate.gameId === gameId &&
    candidate.player.id.length > 0 &&
    candidate.playerState.gameId === gameId &&
    candidate.playerState.playerId === candidate.player.id &&
    hasValidDates(candidate.player.createdAt, candidate.player.updatedAt) &&
    hasValidDates(candidate.playerState.createdAt, candidate.playerState.updatedAt) &&
    candidate.playerState.teamId === undefined &&
    candidate.playerState.isActive &&
    candidate.player.isActive &&
    Number.isSafeInteger(candidate.player.yearsOfExperience) &&
    candidate.player.yearsOfExperience >= 0 &&
    candidate.player.yearsOfExperience <= MAX_SERVICE_YEARS &&
    candidate.classification === FREE_AGENCY_CLASSIFICATION.CONFIRMED_UNRESTRICTED &&
    candidate.contractState.playerId === candidate.player.id &&
    candidate.contractState.resolutionStatus ===
      CONTRACT_IDENTITY_RESOLUTION_STATUS.OBSERVED_STANDARD &&
    candidate.contractState.agreement === null &&
    candidate.contractState.contractType === null
  );
}

export function getEligibleFreeAgents(
  gameId: string,
  candidates: readonly FreeAgencyCandidate[]
): FreeAgencyCandidate[] {
  if (gameId.length === 0) return [];
  return candidates.filter((candidate) => isEligibleCandidate(gameId, candidate));
}

function normalizeSimulationWeights(
  policy: FreeAgencySimulationPolicy
): NormalizedSimulationWeights | null {
  const weights = [policy.moneyWeight, policy.opportunityWeight, policy.teamQualityWeight];
  if (!weights.every((weight) => Number.isFinite(weight) && weight >= 0)) return null;

  const scale = Math.max(...weights);
  if (scale === 0) return null;

  const scaledMoney = policy.moneyWeight / scale;
  const scaledOpportunity = policy.opportunityWeight / scale;
  const scaledTeamQuality = policy.teamQualityWeight / scale;
  const scaledTotal = scaledMoney + scaledOpportunity + scaledTeamQuality;
  return {
    money: scaledMoney / scaledTotal,
    opportunity: scaledOpportunity / scaledTotal,
    teamQuality: scaledTeamQuality / scaledTotal,
  };
}

export function evaluateFreeAgencyOffer(input: FreeAgencyOfferInput): FreeAgencyOfferEvaluation {
  const reasons: FreeAgencyReason[] = [];
  const { gameId, team, candidate, offer } = input;
  const policy = input.simulationPolicy ?? DEFAULT_FREE_AGENCY_SIMULATION_POLICY;
  const normalizedWeights = normalizeSimulationWeights(policy);

  if (
    gameId.length === 0 ||
    team.gameId !== gameId ||
    team.teamId.length === 0 ||
    !isNonNegativeInteger(team.payroll) ||
    !isNonNegativeInteger(team.rosterCount) ||
    team.rosterCount > NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX ||
    !Number.isFinite(team.roleOpportunity) ||
    team.roleOpportunity < 0 ||
    team.roleOpportunity > 100 ||
    !Number.isFinite(team.teamQuality) ||
    team.teamQuality < 0 ||
    team.teamQuality > 100 ||
    normalizedWeights === null
  ) {
    reasons.push({ code: FREE_AGENCY_REASON.INVALID_CONTEXT, detail: "Team context is invalid." });
  }

  if (!isEligibleCandidate(gameId, candidate)) {
    reasons.push({
      code: FREE_AGENCY_REASON.CANDIDATE_UNAVAILABLE,
      detail:
        "Player is not explicitly classified as an eligible teamless free agent in this game.",
    });
  }

  const validOffer =
    isValidSeason(offer.season) &&
    Number.isSafeInteger(offer.annualSalary) &&
    offer.annualSalary > 0 &&
    Number.isInteger(offer.years) &&
    offer.years >= 1 &&
    offer.years <= MAX_SUPPORTED_OFFER_YEARS;
  if (!validOffer) {
    reasons.push({
      code: FREE_AGENCY_REASON.INVALID_OFFER,
      detail: "Offer requires a valid season, positive integer salary, and one to five years.",
    });
  }

  const seasonYear = validOffer ? Number(offer.season.slice(0, 4)) : 0;
  const schedule = validOffer
    ? getMinimumSalary(offer.season, candidate.player.yearsOfExperience)
    : null;
  if (validOffer && schedule === null) {
    reasons.push({
      code: FREE_AGENCY_REASON.SALARY_SCHEDULE_UNAVAILABLE,
      detail: `No verified minimum salary schedule is available for ${offer.season}.`,
    });
  }

  const allInputValid = reasons.length === 0;
  if (!allInputValid || schedule === null || normalizedWeights === null) {
    return { legal: false, score: 0, reasons };
  }

  const salaryCap = getSalaryCapThresholds(seasonYear).salaryCap;
  const maxSalaryRate =
    candidate.player.yearsOfExperience <= 6
      ? NBA_RULES.MAX_SALARY_TIERS.TIER_1
      : candidate.player.yearsOfExperience <= 9
        ? NBA_RULES.MAX_SALARY_TIERS.TIER_2
        : NBA_RULES.MAX_SALARY_TIERS.TIER_3;
  const maximumSalary = Math.floor(salaryCap * maxSalaryRate);
  if (offer.annualSalary < schedule.amount) {
    reasons.push({
      code: FREE_AGENCY_REASON.SALARY_BELOW_MINIMUM,
      detail: `Annual salary is below the verified years-of-service minimum of ${schedule.amount}.`,
    });
  }
  if (offer.annualSalary > maximumSalary) {
    reasons.push({
      code: FREE_AGENCY_REASON.SALARY_ABOVE_MAXIMUM,
      detail: `Annual salary exceeds the supported ${Math.round(maxSalaryRate * 100)}% salary maximum of ${maximumSalary}.`,
    });
  }

  const capRoom = Math.max(0, salaryCap - team.payroll);
  const usesMinimumException = offer.annualSalary === schedule.amount;
  if (offer.annualSalary <= capRoom) {
    reasons.push({
      code: FREE_AGENCY_REASON.CAP_ROOM,
      detail: `Annual salary fits within ${capRoom} of season cap room.`,
    });
  } else if (usesMinimumException) {
    reasons.push({
      code: FREE_AGENCY_REASON.MINIMUM_SALARY_EXCEPTION,
      detail: "Offer matches the verified years-of-service minimum; no other exception is modeled.",
    });
  } else {
    reasons.push({
      code: FREE_AGENCY_REASON.INVALID_OFFER,
      detail:
        "Offer exceeds cap room and is not eligible for the modeled minimum-salary exception.",
    });
  }

  if (team.rosterCount + 1 > NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX) {
    reasons.push({
      code: FREE_AGENCY_REASON.ROSTER_MAXIMUM,
      detail: `Adding a player would exceed the supported in-season roster maximum of ${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX}.`,
    });
  }

  if (reasons.some(({ code }) => code === FREE_AGENCY_REASON.SALARY_ABOVE_MAXIMUM)) {
    return { legal: false, score: 0, reasons };
  }

  if (reasons.some(({ code }) => code === FREE_AGENCY_REASON.SALARY_BELOW_MINIMUM)) {
    return { legal: false, score: 0, reasons };
  }

  const legal =
    (offer.annualSalary <= capRoom || usesMinimumException) &&
    team.rosterCount + 1 <= NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX;
  const maxSalaryForScore = Math.max(schedule.amount, maximumSalary);
  const moneyScore = Math.min(1, (offer.annualSalary - schedule.amount) / maxSalaryForScore);
  const opportunityScore = team.roleOpportunity / 100;
  const teamQualityScore = team.teamQuality / 100;
  const score =
    (moneyScore * normalizedWeights.money +
      opportunityScore * normalizedWeights.opportunity +
      teamQualityScore * normalizedWeights.teamQuality) *
    100;

  reasons.push(
    {
      code: FREE_AGENCY_REASON.OFFER_VALUE,
      detail: "Offer value is measured against the verified minimum and supported salary maximum.",
      contribution: moneyScore * normalizedWeights.money * 100,
    },
    {
      code: FREE_AGENCY_REASON.ROLE_OPPORTUNITY,
      detail: "Role opportunity is the supplied simulated team input, not player preference data.",
      contribution: opportunityScore * normalizedWeights.opportunity * 100,
    },
    {
      code: FREE_AGENCY_REASON.TEAM_QUALITY,
      detail: "Team quality is the supplied simulated team input, not player preference data.",
      contribution: teamQualityScore * normalizedWeights.teamQuality * 100,
    }
  );
  return { legal, score, reasons };
}
