import { z } from "zod";
import {
  estimatePlayerAttributes,
  PLAYER_ATTRIBUTE_ESTIMATE_VERSION,
} from "@/domain/ratings/estimatePlayerAttributes";
import {
  type InitialPlayerAttributes,
  PLAYER_ATTRIBUTE_MATCH,
  PLAYER_ATTRIBUTE_ORIGIN,
} from "@/domain/ratings/InitialPlayerAttributes";
import type { PlayerRatingSourceSnapshot } from "@/domain/ratings/PlayerRatingSourceCache";
import { NBA_TEAM_NAME_BY_ABBREVIATION } from "@/infrastructure/contracts/nbaGLeagueTwoWaySource";
import { canonicalizePlayerName } from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";
import { reviewedNba2kRatingAliases } from "@/infrastructure/ratings/reviewedNba2kRatingAliases";

const rosterSchema = z
  .array(
    z.object({
      playerId: z.uuid(),
      fullName: z.string().trim().min(1),
      espnId: z.number().int().positive().safe().nullable(),
      teamAbbreviation: z
        .string()
        .regex(/^[A-Z]{2,3}$/)
        .nullable(),
      height: z.string().nullable(),
      position: z.string().nullable(),
    })
  )
  .min(1)
  .max(10_000);

function heightInches(value: string | null | undefined): number | null {
  const normalized = value?.replace(/\s/gu, "").replace(/^([5-8])-([0-9]|1[01])$/u, "$1'$2\"");
  const match = normalized?.match(/^([5-8])'([0-9]|1[01])"$/u);
  return match ? Number(match[1]) * 12 + Number(match[2]) : null;
}

function teamKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^los angeles /u, "la ")
    .replace(/[^a-z0-9]/gu, "");
}

export function reconcilePlayerAttributes(
  snapshot: PlayerRatingSourceSnapshot,
  rosterInput: unknown
): InitialPlayerAttributes[] {
  const roster = rosterSchema.parse(rosterInput);
  if (new Set(roster.map(({ playerId }) => playerId)).size !== roster.length) {
    throw new Error("Duplicate roster player IDs");
  }
  const nameCounts = new Map<string, number>();
  const espnCounts = new Map<number, number>();
  for (const player of roster) {
    const name = canonicalizePlayerName(player.fullName);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    if (player.espnId !== null)
      espnCounts.set(player.espnId, (espnCounts.get(player.espnId) ?? 0) + 1);
  }
  const sources = [...snapshot.players, ...snapshot.excludedPlayers];
  const selections = roster.map((player) => {
    const key = canonicalizePlayerName(player.fullName);
    const alias = reviewedNba2kRatingAliases.find(
      (candidate) =>
        candidate.espnId === player.espnId &&
        canonicalizePlayerName(candidate.canonicalName) === key
    );
    const candidates = sources.filter(
      (source) =>
        canonicalizePlayerName(source.name) === key ||
        (alias?.sourceSlug === source.slug &&
          canonicalizePlayerName(alias.sourceName) === canonicalizePlayerName(source.name))
    );
    return { player, key, alias, candidates };
  });
  const claims = new Map<string, number>();
  for (const { candidates } of selections) {
    for (const { slug } of candidates) claims.set(slug, (claims.get(slug) ?? 0) + 1);
  }
  return selections.map(({ player, key, alias, candidates }): InitialPlayerAttributes => {
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    const source = snapshot.players.find(({ slug }) => slug === candidate?.slug);
    const reviewed =
      source !== undefined &&
      alias?.sourceSlug === source.slug &&
      canonicalizePlayerName(alias.sourceName) === canonicalizePlayerName(source.name);
    const expectedTeam = player.teamAbbreviation
      ? NBA_TEAM_NAME_BY_ABBREVIATION[player.teamAbbreviation]
      : undefined;
    const sameTeam = source && expectedTeam && teamKey(source.team) === teamKey(expectedTeam);
    const height = heightInches(player.height);
    const sameHeight = source && height !== null && height === heightInches(source.height);
    const ambiguous =
      candidates.length > 1 ||
      (nameCounts.get(key) ?? 0) > 1 ||
      (player.espnId !== null && (espnCounts.get(player.espnId) ?? 0) > 1) ||
      (candidate !== undefined && (claims.get(candidate.slug) ?? 0) > 1);
    let matchMethod: InitialPlayerAttributes["matchMethod"] = PLAYER_ATTRIBUTE_MATCH.UNCORROBORATED;
    if (ambiguous) matchMethod = PLAYER_ATTRIBUTE_MATCH.AMBIGUOUS;
    else if (!candidate && !alias) matchMethod = PLAYER_ATTRIBUTE_MATCH.MISSING;
    else if (candidate && !source) matchMethod = PLAYER_ATTRIBUTE_MATCH.INCOMPLETE;
    else if (reviewed) matchMethod = PLAYER_ATTRIBUTE_MATCH.REVIEWED_ALIAS;
    else if (sameTeam) matchMethod = PLAYER_ATTRIBUTE_MATCH.NAME_TEAM;
    else if (sameHeight) matchMethod = PLAYER_ATTRIBUTE_MATCH.NAME_HEIGHT;
    const imported =
      source !== undefined && !ambiguous && Boolean(reviewed || sameTeam || sameHeight);
    return {
      playerId: player.playerId,
      origin: imported ? PLAYER_ATTRIBUTE_ORIGIN.NBA2K : PLAYER_ATTRIBUTE_ORIGIN.ESTIMATED,
      matchMethod,
      attributes: imported
        ? { ...source.attributes }
        : estimatePlayerAttributes(player.playerId, player.position),
      sourceSlug: imported ? source.slug : null,
      sourceOverall: imported ? source.overall : null,
      generatorVersion: imported ? null : PLAYER_ATTRIBUTE_ESTIMATE_VERSION,
      evidence: {
        canonicalName: player.fullName,
        sourceName: candidate?.name ?? null,
        espnId: player.espnId,
        rosterTeam: player.teamAbbreviation,
        sourceTeam: source?.team ?? null,
        rosterHeight: player.height,
        sourceHeight: source?.height ?? null,
        aliasReviewDate: reviewed ? "2026-10-23" : null,
      },
    };
  });
}
