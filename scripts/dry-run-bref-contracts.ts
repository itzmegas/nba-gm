import {
  getAllTeamContractSnapshots,
  TEAM_CONTRACT_OUTCOME_STATUS,
} from "@/application/contracts/getAllTeamContractSnapshots";
import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
  ContractSnapshotCacheIdentity,
  StoreContractSnapshotInput,
} from "@/domain/contracts/ContractSnapshotCache";
import { basketballReferenceContractSnapshotFetcher } from "@/infrastructure/contracts/basketballReferenceContractSnapshotFetcher";
import {
  type BasketballReferenceContractSnapshot,
  CONTRACT_SOURCE,
} from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";
import { fetchEspnTeamRoster } from "@/infrastructure/playerIdentity/espnRosterSource";
import {
  type ContractRosterPlayer,
  reconcileContractPlayerIdentities,
} from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";
import { curatedContractIdentityExceptions } from "@/infrastructure/playerIdentity/validatedPlayerIdentityCrosswalk";

class TransientContractSnapshotCache
  implements ContractSnapshotCache<BasketballReferenceContractSnapshot>
{
  private readonly snapshots = new Map<
    string,
    CachedContractSnapshot<BasketballReferenceContractSnapshot>
  >();
  private revision = 0;

  async getCurrent(
    identity: ContractSnapshotCacheIdentity
  ): Promise<CachedContractSnapshot<BasketballReferenceContractSnapshot> | null> {
    return this.snapshots.get(JSON.stringify(identity)) ?? null;
  }

  async reserveRevalidation(): Promise<number> {
    this.revision += 1;
    return this.revision;
  }

  async store(
    input: StoreContractSnapshotInput<BasketballReferenceContractSnapshot>
  ): Promise<CachedContractSnapshot<BasketballReferenceContractSnapshot>> {
    const value = {
      versionId: null,
      identity: input.identity,
      snapshot: input.snapshot,
      contentHash: input.contentHash,
      observedAt: input.observedAt,
      storedAt: input.fetchedAt,
      revalidatedAt: input.fetchedAt,
    };
    this.snapshots.set(JSON.stringify(input.identity), value);
    return value;
  }
}

const season = process.argv[2] ?? "2026-27";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 240_000);

try {
  const result = await getAllTeamContractSnapshots(
    {
      cache: new TransientContractSnapshotCache(),
      fetcher: basketballReferenceContractSnapshotFetcher,
      onProgress: ({ completed, total, outcome }) =>
        console.error(`${completed}/${total} ${outcome.nbaAbbreviation}: ${outcome.status}`),
    },
    {
      teams: NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
        ({ nbaAbbreviation, basketballReferenceAbbreviation }) => ({
          nbaAbbreviation,
          sourceTeam: basketballReferenceAbbreviation,
        })
      ),
      source: CONTRACT_SOURCE.BASKETBALL_REFERENCE,
      season,
      ttlMs: 0,
      allowStaleOnFetchError: false,
      minimumFetchIntervalMs: 3_000,
      signal: controller.signal,
    }
  );

  const successful = result.outcomes.filter(
    (outcome) => outcome.status !== TEAM_CONTRACT_OUTCOME_STATUS.FAILED
  );
  const rosterPlayers: ContractRosterPlayer[] = [];
  const rosterFailures: { nbaTeam: string; error: string }[] = [];
  let rosterRequestsAttempted = 0;
  for (const team of NBA_TO_BASKETBALL_REFERENCE_TEAMS) {
    try {
      rosterRequestsAttempted += 1;
      rosterPlayers.push(
        ...(await fetchEspnTeamRoster({
          nbaTeam: team.nbaAbbreviation,
          sourceTeam: team.basketballReferenceAbbreviation,
          signal: controller.signal,
        }))
      );
    } catch (error) {
      rosterFailures.push({
        nbaTeam: team.nbaAbbreviation,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }
  const rosterTeamsFetched = new Set(rosterPlayers.map(({ nbaTeam }) => nbaTeam));
  const reconcilableSnapshots = successful
    .filter(({ nbaAbbreviation }) => rosterTeamsFetched.has(nbaAbbreviation))
    .map(({ value }) => value.snapshot);
  const snapshots = successful.map(({ value }) => value.snapshot);
  const reconciliation = reconcileContractPlayerIdentities(
    reconcilableSnapshots,
    rosterPlayers,
    curatedContractIdentityExceptions
  );
  const validatedTargetIds = new Set(
    reconciliation.validated.map(({ evidence }) => evidence.targetProviderId)
  );
  const sourceAbsence = rosterPlayers
    .filter(({ providerId }) => !validatedTargetIds.has(providerId))
    .map(({ providerId, fullName, nbaTeam, sourceTeam }) => ({
      providerId,
      fullName,
      nbaTeam,
      sourceTeam,
    }));
  const currentSalaryMissing = snapshots.flatMap((snapshot) =>
    snapshot.contracts
      .filter(
        (contract) => contract.salaries.find((salary) => salary.season === season)?.amount == null
      )
      .map(({ playerSlug, fullName, teamAbbreviation }) => ({
        playerSlug,
        fullName,
        sourceTeam: teamAbbreviation,
      }))
  );
  const teamGaps = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map((team) => {
    const contractCount =
      snapshots.find(
        ({ metadata }) =>
          metadata.cacheIdentity.teamAbbreviation === team.basketballReferenceAbbreviation
      )?.contracts.length ?? 0;
    const rosterCount = rosterPlayers.filter(
      ({ nbaTeam }) => nbaTeam === team.nbaAbbreviation
    ).length;
    const matched = reconciliation.validated.filter(
      ({ evidence }) => evidence.nbaTeam === team.nbaAbbreviation
    ).length;
    return { ...team, contractCount, rosterCount, matched, gap: rosterCount - matched };
  });
  const complete =
    result.complete &&
    rosterFailures.length === 0 &&
    reconciliation.unresolved.length === 0 &&
    sourceAbsence.length === 0 &&
    currentSalaryMissing.length === 0;
  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        writeOperationCount: 0,
        rawSourceBytesSaved: 0,
        season,
        requests: {
          basketballReference: {
            attempted: 30,
            succeeded: successful.length,
            minimumIntervalMs: 3000,
          },
          espn: {
            attempted: rosterRequestsAttempted,
            succeeded: rosterTeamsFetched.size,
            minimumIntervalMs: 800,
          },
        },
        totals: {
          contracts: snapshots.reduce((sum, snapshot) => sum + snapshot.contracts.length, 0),
          rosterPlayers: rosterPlayers.length,
          matched: reconciliation.validated.length,
          matchingFailures: reconciliation.unresolved.length,
          sourceAbsences: sourceAbsence.length,
          currentSalaryMissing: currentSalaryMissing.length,
        },
        complete,
        teamGaps,
        unresolved: {
          matchingFailures: reconciliation.unresolved,
          sourceAbsence,
          currentSalaryMissing,
          rosterFailures,
        },
      },
      null,
      2
    )
  );
  if (!complete) process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
