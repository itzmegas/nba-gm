import { z } from "zod";
import {
  PLAYER_IDENTITY_MATCH_METHOD,
  type UnresolvedPlayerIdentityRecord,
  type ValidatedPlayerIdentityRecord,
} from "@/domain/playerIdentity/ValidatedPlayerIdentityRecord";
import type { BasketballReferenceContractSnapshot } from "@/infrastructure/contracts/basketballReferenceContractSource";

const rosterPlayerSchema = z.object({
  playerId: z.string().min(1),
  providerId: z.string().min(1),
  fullName: z.string().min(1),
  nbaTeam: z.string().regex(/^[A-Z]{2,3}$/),
  sourceTeam: z.string().regex(/^[A-Z]{2,3}$/),
  yearsOfExperience: z.number().int().nonnegative().max(99).nullable().default(null),
});

export type ContractRosterPlayer = z.input<typeof rosterPlayerSchema>;

export interface CuratedIdentityException {
  sourcePlayerId: string;
  targetProviderId: string;
  evidence: string;
}

export interface ContractIdentityReconciliationResult {
  validated: readonly ValidatedPlayerIdentityRecord[];
  unresolved: readonly UnresolvedPlayerIdentityRecord[];
}

const NAME_SUFFIX = {
  II: "ii",
  III: "iii",
  IV: "iv",
  JR: "jr",
  SR: "sr",
} as const;

export function canonicalizePlayerName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[’‘ʼ]/gu, "'")
    .replace(/[‐‑‒–—−]/gu, "-")
    .toLocaleLowerCase("en-US")
    .trim();
  const tokens = normalized.split(/\s+/u);
  const suffixCandidate = tokens.at(-1)?.replace(/\./gu, "").toUpperCase() ?? "";
  const suffix = NAME_SUFFIX[suffixCandidate as keyof typeof NAME_SUFFIX] ?? "";
  const baseTokens = suffix ? tokens.slice(0, -1) : tokens;
  const base = baseTokens.join(" ").replace(/\.+/gu, "").replace(/\s+/gu, " ").trim();
  return `${base}\u0000${suffix}`;
}

export function reconcileContractPlayerIdentities(
  snapshots: readonly BasketballReferenceContractSnapshot[],
  rosterPlayersInput: readonly ContractRosterPlayer[],
  curatedExceptions: readonly CuratedIdentityException[] = []
): ContractIdentityReconciliationResult {
  const rosterPlayers = z.array(rosterPlayerSchema).parse(rosterPlayersInput);
  const exceptionBySource = new Map(
    curatedExceptions.map((value) => [value.sourcePlayerId, value])
  );
  const validated: ValidatedPlayerIdentityRecord[] = [];
  const unresolved: UnresolvedPlayerIdentityRecord[] = [];
  const usedTargets = new Set<string>();
  const sourceCounts = new Map<string, number>();
  for (const snapshot of snapshots) {
    for (const contract of snapshot.contracts) {
      sourceCounts.set(contract.playerSlug, (sourceCounts.get(contract.playerSlug) ?? 0) + 1);
    }
  }
  const targetProviderCounts = new Map<string, number>();
  for (const player of rosterPlayers) {
    targetProviderCounts.set(
      player.providerId,
      (targetProviderCounts.get(player.providerId) ?? 0) + 1
    );
  }

  for (const snapshot of snapshots) {
    for (const contract of snapshot.contracts) {
      const exception = exceptionBySource.get(contract.playerSlug);
      const canonicalName = canonicalizePlayerName(contract.fullName);
      const candidates = exception
        ? rosterPlayers.filter(
            ({ providerId, sourceTeam }) =>
              providerId === exception.targetProviderId && sourceTeam === contract.teamAbbreviation
          )
        : rosterPlayers.filter(
            ({ fullName, sourceTeam }) =>
              canonicalizePlayerName(fullName) === canonicalName &&
              sourceTeam === contract.teamAbbreviation
          );
      const candidate = candidates.length === 1 ? candidates[0] : undefined;
      const duplicateSource = sourceCounts.get(contract.playerSlug) !== 1;
      const duplicateTarget =
        candidate !== undefined && targetProviderCounts.get(candidate.providerId) !== 1;
      if (
        !candidate ||
        duplicateSource ||
        duplicateTarget ||
        usedTargets.has(candidate.providerId)
      ) {
        unresolved.push({
          sourcePlayerId: contract.playerSlug,
          sourceFullName: contract.fullName,
          sourceTeam: contract.teamAbbreviation,
          reason: duplicateSource
            ? "duplicate-source-player"
            : duplicateTarget || usedTargets.has(candidate?.providerId ?? "")
              ? "duplicate-target-player"
              : candidates.length > 1
                ? "ambiguous-provider-records"
                : candidates.length === 0
                  ? "no-exact-provider-record"
                  : "duplicate-target-player",
        });
        continue;
      }
      usedTargets.add(candidate.providerId);
      validated.push({
        sourcePlayerId: contract.playerSlug,
        targetPlayerId: candidate.playerId,
        matchMethod: exception
          ? PLAYER_IDENTITY_MATCH_METHOD.CURATED_EXCEPTION
          : PLAYER_IDENTITY_MATCH_METHOD.EXACT_PROVIDER_RECORD,
        evidence: {
          canonicalName: candidate.fullName,
          nbaTeam: candidate.nbaTeam,
          sourceTeam: candidate.sourceTeam,
          sourceFullName: contract.fullName,
          targetFullName: candidate.fullName,
          targetProviderId: candidate.providerId,
          ...(exception ? { corroboration: exception.evidence } : {}),
        },
      });
    }
  }
  return { validated, unresolved };
}
