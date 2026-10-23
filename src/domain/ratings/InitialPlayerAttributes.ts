import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";

export const PLAYER_ATTRIBUTE_ORIGIN = {
  NBA2K: "nba2kapi",
  ESTIMATED: "estimated",
} as const;

export const PLAYER_ATTRIBUTE_MATCH = {
  NAME_TEAM: "name-and-team",
  NAME_HEIGHT: "name-and-height",
  REVIEWED_ALIAS: "reviewed-espn-alias",
  MISSING: "missing-source",
  INCOMPLETE: "incomplete-attributes",
  AMBIGUOUS: "ambiguous-identity",
  UNCORROBORATED: "uncorroborated-identity",
} as const;

export interface PlayerAttributeIdentityEvidence {
  canonicalName: string;
  sourceName: string | null;
  espnId: number | null;
  rosterTeam: string | null;
  sourceTeam: string | null;
  rosterHeight: string | null;
  sourceHeight: string | null;
  aliasReviewDate: string | null;
}

export interface InitialPlayerAttributes {
  playerId: string;
  origin: (typeof PLAYER_ATTRIBUTE_ORIGIN)[keyof typeof PLAYER_ATTRIBUTE_ORIGIN];
  matchMethod: (typeof PLAYER_ATTRIBUTE_MATCH)[keyof typeof PLAYER_ATTRIBUTE_MATCH];
  attributes: PlayerAttributes;
  sourceSlug: string | null;
  sourceOverall: number | null;
  generatorVersion: string | null;
  evidence: PlayerAttributeIdentityEvidence;
}
