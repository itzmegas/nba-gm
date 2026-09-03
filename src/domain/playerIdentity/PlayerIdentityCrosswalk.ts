export const PLAYER_IDENTITY_PROVIDER = {
  BASKETBALL_REFERENCE: "basketball-reference",
  ESPN: "espn",
} as const;

export type PlayerIdentityProvider =
  (typeof PLAYER_IDENTITY_PROVIDER)[keyof typeof PLAYER_IDENTITY_PROVIDER];

export interface ExternalPlayerIdentity {
  provider: PlayerIdentityProvider;
  externalId: string;
}

export interface PlayerIdentityBinding {
  canonicalName: string;
  identities: readonly ExternalPlayerIdentity[];
}

export interface PlayerIdentityCrosswalk {
  resolve(
    provider: PlayerIdentityProvider,
    externalId: string,
    targetProvider: PlayerIdentityProvider
  ): readonly string[];
}
