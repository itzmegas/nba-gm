export const NBA_RULES = {
  SALARY_CAP: 140_588_000,
  LUXURY_TAX: 170_814_000,
  FIRST_APRON: 178_132_000,
  SECOND_APRON: 188_931_000,
  MATCHING_TIERS: {
    NON_TAXPAYER_LOW: {
      maxOutgoing: 7_500_000,
      incomingMultiplier: 1.75,
      flatBonus: 100_000,
    },
    NON_TAXPAYER_MID: {
      maxOutgoing: 29_000_000,
      flatBonus: 5_000_000,
    },
    NON_TAXPAYER_HIGH: {
      incomingMultiplier: 1.25,
      flatBonus: 100_000,
    },
    TAXPAYER: {
      incomingMultiplier: 1.25,
      flatBonus: 100_000,
    },
    SECOND_APRON: {
      incomingMultiplier: 1.0,
      flatBonus: 0,
    },
  },
  MAX_SALARY_TIERS: {
    TIER_1: 0.25, // 0-6 years
    TIER_2: 0.3, // 7-9 years
    TIER_3: 0.35, // 10+ years
  },
  ROSTER_LIMITS: {
    IN_SEASON_MIN: 12,
    IN_SEASON_MAX: 15,
    OFFSEASON_MAX: 21,
  },
} as const;

export interface SalaryCapThresholds {
  salaryCap: number;
  luxuryTax: number;
  firstApron: number;
  secondApron: number;
}

const BASE_SALARY_CAP_SEASON = 2024;
const MAX_ANNUAL_CAP_GROWTH = 1.1;

export function getSalaryCapThresholds(seasonYear: number): SalaryCapThresholds {
  const seasonsAfterBase = Math.max(0, seasonYear - BASE_SALARY_CAP_SEASON);
  const growth = MAX_ANNUAL_CAP_GROWTH ** seasonsAfterBase;

  return {
    salaryCap: Math.round(NBA_RULES.SALARY_CAP * growth),
    luxuryTax: Math.round(NBA_RULES.LUXURY_TAX * growth),
    firstApron: Math.round(NBA_RULES.FIRST_APRON * growth),
    secondApron: Math.round(NBA_RULES.SECOND_APRON * growth),
  };
}
