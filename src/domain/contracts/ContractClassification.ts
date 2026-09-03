export const CONTRACT_TYPE = {
  STANDARD: "standard",
  TWO_WAY: "two-way",
} as const;

export type ContractType = (typeof CONTRACT_TYPE)[keyof typeof CONTRACT_TYPE];

export const CONTRACT_UI_CLASSIFICATION = {
  STANDARD: "Standard",
  TWO_WAY: "Two-Way",
  ESTIMATED: "Estimated",
  UNKNOWN: "Unknown",
} as const;

export type ContractUiClassification =
  (typeof CONTRACT_UI_CLASSIFICATION)[keyof typeof CONTRACT_UI_CLASSIFICATION];

export const CONTRACT_PROVENANCE_QUALITY = {
  OBSERVED: "observed",
  OFFICIAL: "official",
  ESTIMATED: "estimated",
} as const;

export type ContractProvenanceQuality =
  (typeof CONTRACT_PROVENANCE_QUALITY)[keyof typeof CONTRACT_PROVENANCE_QUALITY];

export const CONTRACT_SOURCE_METHOD = {
  BASKETBALL_REFERENCE_CURRENT_SALARY: "basketball-reference-current-salary",
  NBA_G_LEAGUE_TWO_WAY_TRACKER: "nba-g-league-two-way-tracker",
  YEARS_OF_SERVICE_MINIMUM: "years-of-service-minimum",
  CURRENT_ROSTER_ESPN_OMITTED_EXPERIENCE_MINIMUM: "current-roster-espn-omitted-experience-minimum",
  CURATED_INACTIVE_STATUS: "curated-inactive-status",
} as const;

export type ContractSourceMethod =
  (typeof CONTRACT_SOURCE_METHOD)[keyof typeof CONTRACT_SOURCE_METHOD];

export const CONTRACT_CAP_TREATMENT = {
  STANDARD: "standard-cap-and-matching",
  EXCLUDED_TWO_WAY: "excluded-two-way",
  EXCLUDED_INACTIVE: "excluded-inactive",
} as const;

export type ContractCapTreatment =
  (typeof CONTRACT_CAP_TREATMENT)[keyof typeof CONTRACT_CAP_TREATMENT];

export const CONTRACT_FALLBACK_BLOCK_REASON = {
  MINIMUM_SCHEDULE_UNAVAILABLE: "minimum-schedule-unavailable",
  MISSING_YEARS_OF_SERVICE: "missing-years-of-service",
  TWO_WAY_SOURCE_UNAVAILABLE: "two-way-source-unavailable",
} as const;

export type ContractFallbackBlockReason =
  (typeof CONTRACT_FALLBACK_BLOCK_REASON)[keyof typeof CONTRACT_FALLBACK_BLOCK_REASON];

export const CONTRACT_FALLBACK_ASSUMPTION = {
  ESPN_OMITTED_EXPERIENCE_ZERO_YOS: "espn-omitted-experience-assumed-zero-years-of-service",
} as const;

export type ContractFallbackAssumption =
  (typeof CONTRACT_FALLBACK_ASSUMPTION)[keyof typeof CONTRACT_FALLBACK_ASSUMPTION];
