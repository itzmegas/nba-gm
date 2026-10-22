import { z } from "zod";
import { canonicalizePlayerName } from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";
import type { fetchNba2kRatings } from "@/infrastructure/ratings/nba2kRatingsSource";

const rosterSchema = z.object({
  seasonYear: z.literal(2026),
  seasonEraId: z.literal("modern"),
  players: z.array(z.object({ playerId: z.uuid(), fullName: z.string().trim().min(1) })).min(1),
});

export const RATING_COVERAGE_STATUS = {
  CANDIDATE: "candidate-needs-review",
  MISSING: "missing",
  AMBIGUOUS: "ambiguous",
  INCOMPLETE: "incomplete-attributes",
} as const;

export function getNba2kRatingCoverage(
  snapshot: Awaited<ReturnType<typeof fetchNba2kRatings>>,
  rosterInput: unknown
) {
  const roster = rosterSchema.parse(rosterInput);
  if (new Set(roster.players.map(({ playerId }) => playerId)).size !== roster.players.length) {
    throw new Error("Duplicate roster player IDs");
  }
  const sources = [...snapshot.players, ...snapshot.excludedPlayers].map(({ slug, name }) => ({
    slug,
    key: canonicalizePlayerName(name),
  }));
  const targets = roster.players.map((player) => ({
    ...player,
    key: canonicalizePlayerName(player.fullName),
  }));
  const validSlugs = new Set(snapshot.players.map(({ slug }) => slug));
  const players = targets.map(({ playerId, fullName, key }) => {
    const sourceSlugs = sources.filter((source) => source.key === key).map(({ slug }) => slug);
    const status =
      targets.filter((target) => target.key === key).length > 1 || sourceSlugs.length > 1
        ? RATING_COVERAGE_STATUS.AMBIGUOUS
        : sourceSlugs.length === 0
          ? RATING_COVERAGE_STATUS.MISSING
          : validSlugs.has(sourceSlugs[0])
            ? RATING_COVERAGE_STATUS.CANDIDATE
            : RATING_COVERAGE_STATUS.INCOMPLETE;
    return { playerId, fullName, status, sourceSlugs };
  });
  const candidateCount = players.filter(
    ({ status }) => status === RATING_COVERAGE_STATUS.CANDIDATE
  ).length;
  return {
    seasonYear: roster.seasonYear,
    seasonEraId: roster.seasonEraId,
    rosterCount: players.length,
    candidateCount,
    unresolvedCount: players.length - candidateCount,
    identityVerified: false,
    players,
  };
}
