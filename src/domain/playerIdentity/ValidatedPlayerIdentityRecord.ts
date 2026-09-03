export const PLAYER_IDENTITY_MATCH_METHOD = {
  CURATED_EXCEPTION: "curated-exception",
  EXACT_PROVIDER_RECORD: "exact-provider-record",
} as const;

export type PlayerIdentityMatchMethod =
  (typeof PLAYER_IDENTITY_MATCH_METHOD)[keyof typeof PLAYER_IDENTITY_MATCH_METHOD];

export interface PlayerIdentityMatchEvidence {
  canonicalName: string;
  nbaTeam: string;
  sourceTeam: string;
  sourceFullName: string;
  targetFullName: string;
  targetProviderId: string;
  corroboration?: string;
}

export interface ValidatedPlayerIdentityRecord {
  sourcePlayerId: string;
  targetPlayerId: string;
  matchMethod: PlayerIdentityMatchMethod;
  evidence: PlayerIdentityMatchEvidence;
}

export interface UnresolvedPlayerIdentityRecord {
  sourcePlayerId: string;
  sourceFullName: string;
  sourceTeam: string;
  reason: string;
}
