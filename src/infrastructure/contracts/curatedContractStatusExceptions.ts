export interface CuratedInactiveContractStatus {
  espnPlayerId: string;
  playerName: string;
  nbaTeam: string;
  effectiveSeason: string;
  sourceUrl: string;
  observedDate: string;
  evidence: string;
}

export const CURATED_INACTIVE_CONTRACT_STATUSES: readonly CuratedInactiveContractStatus[] = [
  {
    espnPlayerId: "4683686",
    playerName: "Nick Smith Jr.",
    nbaTeam: "LAL",
    effectiveSeason: "2026-27",
    sourceUrl: "https://www.spotrac.com/nba/player/transactions/_/id/82257/nick-smith-jr",
    observedDate: "2026-06-29",
    evidence: "Los Angeles Lakers declined the 2026-27 club option; player status is inactive.",
  },
] as const;
