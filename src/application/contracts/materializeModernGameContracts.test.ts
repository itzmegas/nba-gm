import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_FALLBACK_DIAGNOSTIC_KIND,
  CONTRACT_MATERIALIZATION_FAILURE_KIND,
  ContractFallbackCoverageError,
  ContractSnapshotAcquisitionError,
  materializeModernGameContracts,
} from "@/application/contracts/materializeModernGameContracts";
import type {
  CachedContractSnapshot,
  ContractSnapshotCache,
} from "@/domain/contracts/ContractSnapshotCache";
import type { BasketballReferenceContractSnapshot } from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";

const now = "2026-08-24T12:00:00.000Z";

interface TestRosterPlayer {
  espn_id: number;
  full_name: string;
  years_of_experience: number | null;
}

interface TestRosterRow {
  player_id: string;
  players: TestRosterPlayer;
  teams: { abbreviation: string };
}

function playerId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function cached(team: string): CachedContractSnapshot<BasketballReferenceContractSnapshot> {
  const index = NBA_TO_BASKETBALL_REFERENCE_TEAMS.findIndex(
    ({ basketballReferenceAbbreviation }) => basketballReferenceAbbreviation === team
  );
  return {
    versionId: crypto.randomUUID(),
    identity: { source: "basketball-reference", team, season: "2025-26" },
    snapshot: {
      metadata: {
        sourceUrl: `https://www.basketball-reference.com/contracts/${team}.html`,
        observedAt: now,
        contentHash: "a".repeat(64),
        cacheIdentity: {
          source: "basketball-reference",
          teamAbbreviation: team,
          season: "2025-26",
        },
      },
      contracts: [
        {
          playerSlug: `player${index}`,
          playerUrl: `https://www.basketball-reference.com/players/p/player${index}.html`,
          fullName: `Player ${index}`,
          teamAbbreviation: team,
          salaries: [{ season: "2025-26", amount: 1_000_000 + index, optionKind: "none" }],
          remainingGuaranteedAmount: null,
          contractNotes: null,
        },
      ],
      warnings: [],
    },
    contentHash: "a".repeat(64),
    observedAt: now,
    storedAt: now,
    revalidatedAt: now,
  };
}

function cacheWithFailure(
  failedTeam?: string
): ContractSnapshotCache<BasketballReferenceContractSnapshot> {
  return {
    getCurrent: vi.fn(async ({ team }) => {
      if (team === failedTeam) throw new Error("cache integrity failure");
      return cached(team);
    }),
    reserveRevalidation: vi.fn(),
    store: vi.fn(),
  };
}

describe("materializeModernGameContracts", () => {
  it("keeps cache validation summaries safe and redacts provider payload boundaries", () => {
    const structured = new ContractSnapshotAcquisitionError([
      {
        nbaAbbreviation: "LAL",
        sourceTeam: "LAL",
        error: {
          name: "Error",
          message: JSON.stringify({ body: "provider secret", token: "do-not-log" }),
        },
      },
      {
        nbaAbbreviation: "BOS",
        sourceTeam: "BOS",
        error: {
          name: "ZodError",
          message:
            "Validation failed: path=payload code=invalid_type expected=object received=string",
        },
      },
      {
        nbaAbbreviation: "ATL",
        sourceTeam: "ATL",
        error: {
          name: "Error",
          message: "authorization: Bearer super-secret",
        },
      },
    ]);

    expect(structured.message).toContain("Structured or oversized provider error redacted");
    expect(structured.message).not.toContain("provider secret");
    expect(structured.message).not.toContain("do-not-log");
    expect(structured.message).not.toContain("super-secret");
    expect(structured.message).toContain("authorization: [REDACTED]");
    expect(structured.message).toContain("path=payload code=invalid_type");
    expect(structured.message).toContain("expected=object received=string");
  });

  it("redacts unsafe fields before formatting fallback coverage diagnostics", () => {
    const failure = new ContractFallbackCoverageError("2026-27", [
      {
        kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
        player: '{"name":"provider player"}',
        team: "LAL",
        reason: "token: super-secret",
      },
    ]);

    expect(failure.message).toContain("Structured or oversized provider error redacted");
    expect(failure.message).toContain("reason=token: [REDACTED]");
    expect(failure.message).not.toContain("provider player");
    expect(failure.message).not.toContain("super-secret");
    expect(failure.message.length).toBeLessThanOrEqual(480);
  });

  it("binds all 30 durable current versions to one service RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "materialized" }, error: null }));
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    await materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2025,
      cache: cacheWithFailure(),
      serviceClient: { from, rpc } as never,
      ttlMs: Number.MAX_SAFE_INTEGER,
      fetchTwoWayTracker: async () => ({
        sourceUrl: "https://gleague.nba.com/twowayplayers",
        observedAt: now,
        season: "2025-26",
        rows: [],
      }),
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "materialize_game_contract_snapshots",
      expect.objectContaining({ p_season: "2025-26", p_version_ids: expect.arrayContaining([]) })
    );
    const call = rpc.mock.calls[0] as unknown as [string, { p_version_ids: string[] }];
    expect(call[1].p_version_ids).toHaveLength(30);
    const identityCall = (
      rpc.mock.calls as unknown as [string, { p_identity_crosswalk: unknown[] }][]
    )[0][1];
    expect(identityCall.p_identity_crosswalk).toHaveLength(30);
  });

  it("materializes a realistic Lakers mix while excluding two-way and inactive players", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "materialized" }, error: null }));
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    const lakers = [
      [31, 9001, "Arthur Kaluma", 1],
      [32, 9002, "Chris Mañon", 1],
      [33, 9003, "AK Okereke", 0],
      [34, 4683686, "Nick Smith Jr.", 3],
      [35, 9005, "Eligible Minimum", 1],
    ] as const;
    rosterRows.push(
      ...lakers.map(([id, espnId, fullName, years]) => ({
        player_id: playerId(id),
        players: { espn_id: espnId, full_name: fullName, years_of_experience: years },
        teams: { abbreviation: "LAL" },
      }))
    );
    const baseCache = cacheWithFailure();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      ...baseCache,
      getCurrent: vi.fn(async (identity) => {
        const value = await baseCache.getCurrent(identity);
        if (!value) return null;
        return {
          ...value,
          identity: { ...value.identity, season: "2026-27" },
          snapshot: {
            ...value.snapshot,
            metadata: {
              ...value.snapshot.metadata,
              cacheIdentity: { ...value.snapshot.metadata.cacheIdentity, season: "2026-27" },
            },
            contracts: value.snapshot.contracts.map((contract) => ({
              ...contract,
              salaries: contract.salaries.map((salary) => ({ ...salary, season: "2026-27" })),
            })),
          },
        };
      }),
    };
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));
    await materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2026,
      cache,
      serviceClient: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc } as never,
      ttlMs: Number.MAX_SAFE_INTEGER,
      fetchTwoWayTracker: async () => ({
        sourceUrl: "https://gleague.nba.com/twowayplayers",
        observedAt: now,
        season: "2026-27",
        rows: lakers.slice(0, 3).map(([, , playerName]) => ({
          playerName,
          nbaTeamName: "Los Angeles Lakers",
          gLeagueAffiliateName: "South Bay Lakers",
        })),
      }),
    });
    const params = (
      rpc.mock.calls[0] as unknown as [
        string,
        {
          p_contract_classifications: Array<{
            targetPlayerId: string;
            resolution: { status: string; capTreatment: string; estimated?: boolean };
          }>;
        },
      ]
    )[1];
    const extras = params.p_contract_classifications.slice(-5).map(({ resolution }) => resolution);
    expect(extras.map(({ status }) => status)).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "excluded",
      "resolved",
    ]);
    expect(
      extras.slice(0, 3).every(({ capTreatment }) => capTreatment === "excluded-two-way")
    ).toBe(true);
    expect(extras[3]?.capTreatment).toBe("excluded-inactive");
    expect(extras[4]).toMatchObject({ capTreatment: "standard-cap-and-matching", estimated: true });
  });

  it("materializes a Jameer-like unmatched roster player with the current-roster estimate", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "materialized" }, error: null }));
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    rosterRows.push({
      player_id: playerId(100),
      players: { espn_id: 10_001, full_name: "Jameer Nelson Jr.", years_of_experience: null },
      teams: { abbreviation: "PHI" },
    });
    const baseCache = cacheWithFailure();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      ...baseCache,
      getCurrent: vi.fn(async (identity) => {
        const value = await baseCache.getCurrent(identity);
        if (!value) return null;
        return {
          ...value,
          identity: { ...value.identity, season: "2026-27" },
          snapshot: {
            ...value.snapshot,
            metadata: {
              ...value.snapshot.metadata,
              cacheIdentity: { ...value.snapshot.metadata.cacheIdentity, season: "2026-27" },
            },
            contracts: value.snapshot.contracts.map((contract) => ({
              ...contract,
              salaries: contract.salaries.map((salary) => ({ ...salary, season: "2026-27" })),
            })),
          },
        };
      }),
    };
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));

    await materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2026,
      cache,
      serviceClient: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc } as never,
      ttlMs: Number.MAX_SAFE_INTEGER,
      allowUnmatchedRosterExperienceFallback: true,
      fetchTwoWayTracker: async () => ({
        sourceUrl: "https://gleague.nba.com/twowayplayers",
        observedAt: now,
        season: "2026-27",
        rows: [],
      }),
    });

    const params = (
      rpc.mock.calls[0] as unknown as [
        string,
        {
          p_contract_classifications: Array<{
            targetPlayerId: string;
            sourcePlayerId: string | null;
            resolution: Record<string, unknown>;
          }>;
        },
      ]
    )[1];
    const classification = params.p_contract_classifications.at(-1);
    expect(classification).toMatchObject({
      sourcePlayerId: null,
      resolution: {
        status: "resolved",
        salaryAmount: 1_357_763,
        estimated: true,
        method: "current-roster-espn-omitted-experience-minimum",
        capTreatment: "standard-cap-and-matching",
        evidence: {
          assumption: "espn-omitted-experience-assumed-zero-years-of-service",
        },
      },
    });
    expect(JSON.stringify(classification)).not.toContain("basketball-reference");
  });

  it("reports bounded actionable fallback coverage failures for the 2026-27 branch", async () => {
    const rpc = vi.fn();
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    rosterRows.push(
      ...Array.from({ length: 20 }, (_, index) => ({
        player_id: playerId(100 + index),
        players: {
          espn_id: 9_100 + index,
          full_name: `Unresolved Active Player ${index}`,
          years_of_experience: null,
        },
        teams: { abbreviation: "LAL" },
      }))
    );
    const baseCache = cacheWithFailure();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      ...baseCache,
      getCurrent: vi.fn(async (identity) => {
        const value = await baseCache.getCurrent(identity);
        if (!value) return null;
        return {
          ...value,
          identity: { ...value.identity, season: "2026-27" },
          snapshot: {
            ...value.snapshot,
            metadata: {
              ...value.snapshot.metadata,
              cacheIdentity: { ...value.snapshot.metadata.cacheIdentity, season: "2026-27" },
            },
            contracts: value.snapshot.contracts.map((contract) => ({
              ...contract,
              fullName: identity.team === "LAL" ? "Unresolved source player" : contract.fullName,
              salaries: contract.salaries.map((salary) => ({ ...salary, season: "2026-27" })),
            })),
          },
        };
      }),
    };
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));

    const failure = await materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2026,
      cache,
      serviceClient: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc } as never,
      ttlMs: Number.MAX_SAFE_INTEGER,
      fetchTwoWayTracker: async () => ({
        sourceUrl: "https://gleague.nba.com/twowayplayers",
        observedAt: now,
        season: "2026-27",
        rows: [],
      }),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ContractFallbackCoverageError);
    expect(failure).toMatchObject({
      name: "ContractFallbackCoverageError",
      failureKind: CONTRACT_MATERIALIZATION_FAILURE_KIND.FALLBACK_COVERAGE,
      diagnostics: [
        {
          kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
          player: "Unresolved Active Player 0",
          team: "LAL",
          reason: "missing-years-of-service",
        },
        {
          kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
          player: "Unresolved Active Player 1",
          team: "LAL",
          reason: "missing-years-of-service",
        },
      ],
      omittedCount: 18,
    });
    expect((failure as ContractFallbackCoverageError).diagnostics).toHaveLength(2);
    expect((failure as ContractFallbackCoverageError).message).toContain(
      "blocked-fallback player=Unresolved Active Player 0 team=LAL reason=missing-years-of-service"
    );
    expect((failure as ContractFallbackCoverageError).message).toContain(
      "additional diagnostics redacted=18"
    );
    expect((failure as ContractFallbackCoverageError).message).not.toMatch(/[{}[\]]/u);
    expect((failure as ContractFallbackCoverageError).message.length).toBeLessThanOrEqual(480);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports source-only unmatched contracts as nonfatal and omits them from the crosswalk", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "materialized" }, error: null }));
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    const baseCache = cacheWithFailure();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      ...baseCache,
      getCurrent: vi.fn(async (identity) => {
        const value = await baseCache.getCurrent(identity);
        if (!value) return null;
        return {
          ...value,
          identity: { ...value.identity, season: "2026-27" },
          snapshot: {
            ...value.snapshot,
            metadata: {
              ...value.snapshot.metadata,
              cacheIdentity: { ...value.snapshot.metadata.cacheIdentity, season: "2026-27" },
            },
            contracts: value.snapshot.contracts.map((contract) => ({
              ...contract,
              fullName: identity.team === "LAL" ? "Unresolved source player" : contract.fullName,
              salaries: contract.salaries.map((salary) => ({ ...salary, season: "2026-27" })),
            })),
          },
        };
      }),
    };
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));

    await materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2026,
      cache,
      serviceClient: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc } as never,
      ttlMs: Number.MAX_SAFE_INTEGER,
      fetchTwoWayTracker: async () => ({
        sourceUrl: "https://gleague.nba.com/twowayplayers",
        observedAt: now,
        season: "2026-27",
        rows: [],
      }),
    });
    expect(rpc).toHaveBeenCalledOnce();
    const params = (
      rpc.mock.calls[0] as unknown as [
        string,
        { p_identity_crosswalk: Array<{ sourcePlayerId: string }> },
      ]
    )[1];
    expect(params.p_identity_crosswalk).toHaveLength(29);
    expect(params.p_identity_crosswalk).not.toContainEqual(
      expect.objectContaining({ sourcePlayerId: "player13" })
    );
  });

  it("blocks a roster-only active player when years of experience are unknown", async () => {
    const rpc = vi.fn();
    const rosterRows: TestRosterRow[] = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ nbaAbbreviation }, index) => ({
        player_id: playerId(index),
        players: { espn_id: index + 1, full_name: `Player ${index}`, years_of_experience: 2 },
        teams: { abbreviation: nbaAbbreviation },
      })
    );
    rosterRows.push({
      player_id: playerId(100),
      players: { espn_id: 9_100, full_name: "Unknown Experience", years_of_experience: null },
      teams: { abbreviation: "LAL" },
    });
    const eq = vi.fn(async () => ({ data: rosterRows, error: null }));

    await expect(
      materializeModernGameContracts({
        gameId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        seasonYear: 2025,
        cache: cacheWithFailure(),
        serviceClient: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc } as never,
        ttlMs: Number.MAX_SAFE_INTEGER,
        fetchTwoWayTracker: async () => ({
          sourceUrl: "https://gleague.nba.com/twowayplayers",
          observedAt: now,
          season: "2025-26",
          rows: [],
        }),
      })
    ).rejects.toMatchObject({
      name: "ContractFallbackCoverageError",
      diagnostics: [
        expect.objectContaining({
          kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
          player: "Unknown Experience",
          reason: "missing-years-of-service",
        }),
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks materialization when any team outcome fails", async () => {
    const rpc = vi.fn();
    await expect(
      materializeModernGameContracts({
        gameId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        seasonYear: 2025,
        cache: cacheWithFailure("LAL"),
        serviceClient: { rpc } as never,
        ttlMs: Number.MAX_SAFE_INTEGER,
      })
    ).rejects.toMatchObject({
      name: "ContractSnapshotAcquisitionError",
      failureKind: CONTRACT_MATERIALIZATION_FAILURE_KIND.ACQUISITION,
      failedTeams: [
        {
          nbaAbbreviation: "LAL",
          sourceTeam: "LAL",
          error: { name: "Error", message: "cache integrity failure" },
        },
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("distinguishes a complete batch with non-durable source IDs", async () => {
    const rpc = vi.fn();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      getCurrent: vi.fn(async ({ team }) => ({ ...cached(team), versionId: null })),
      reserveRevalidation: vi.fn(),
      store: vi.fn(),
    };

    await expect(
      materializeModernGameContracts({
        gameId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        seasonYear: 2025,
        cache,
        serviceClient: { rpc } as never,
        ttlMs: Number.MAX_SAFE_INTEGER,
      })
    ).rejects.toMatchObject({
      name: "ContractSnapshotDurabilityError",
      failureKind: CONTRACT_MATERIALIZATION_FAILURE_KIND.NON_DURABLE_SOURCE_VERSIONS,
      nonDurableTeams: expect.arrayContaining([
        { nbaAbbreviation: "LAL", sourceTeam: "LAL", versionId: null },
      ]),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("times out a hung cold acquisition with a typed failure and no RPC", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn();
    const cache: ContractSnapshotCache<BasketballReferenceContractSnapshot> = {
      getCurrent: vi.fn(
        () =>
          new Promise<CachedContractSnapshot<BasketballReferenceContractSnapshot> | null>(
            () => undefined
          )
      ),
      reserveRevalidation: vi.fn(),
      store: vi.fn(),
    };
    const operation = materializeModernGameContracts({
      gameId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      seasonYear: 2025,
      cache,
      serviceClient: { rpc } as never,
      timeoutMs: 90_000,
    });
    const assertion = expect(operation).rejects.toMatchObject({
      name: "ContractMaterializationTimeoutError",
    });
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
    expect(rpc).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
