import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Contract } from "@/domain/entities/Contract";
import { contractSchema } from "@/domain/entities/Contract";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";

interface QueryContext {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  range?: { from: number; to: number };
}

class QueryBuilder {
  constructor(
    private readonly context: QueryContext,
    private readonly resolve: (context: QueryContext) => {
      data: unknown;
      error: { message: string; code?: string } | null;
    }
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.context.filters.push({ column, value });
    return this;
  }

  in(): this {
    return this;
  }

  order(): this {
    return this;
  }

  range(from: number, to: number): this {
    this.context.range = { from, to };
    return this;
  }

  single(): this {
    return this;
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables
  then<
    TResult1 = { data: unknown; error: { message: string; code?: string } | null },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: { message: string; code?: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve(this.context)).then(onfulfilled, onrejected);
  }
}

const ids = {
  game: "11111111-1111-4111-8111-111111111111",
  player: "22222222-2222-4222-8222-222222222222",
  oldTeam: "33333333-3333-4333-8333-333333333333",
  currentTeam: "44444444-4444-4444-8444-444444444444",
  agreement: "55555555-5555-4555-8555-555555555555",
} as const;

const runtimeRow = {
  id: "66666666-6666-4666-8666-666666666666",
  game_id: ids.game,
  player_id: ids.player,
  origin_kind: "simulated-agreement",
  start_year: 2026,
  end_year: 2028,
  annual_salary: 8_000_000,
  is_player_option: false,
  is_team_option: false,
  is_guaranteed: true,
  created_at: "2026-10-04T00:00:00.000Z",
};

const legacyContractRow = {
  id: ids.agreement,
  game_id: ids.game,
  player_id: ids.player,
  team_id: ids.currentTeam,
  start_year: 2026,
  end_year: 2028,
  salary_y1: 6_000_000,
  salary_y2: 6_000_000,
  salary_y3: 6_000_000,
  salary_y4: null,
  salary_y5: null,
  is_player_option: false,
  is_team_option: false,
  is_guaranteed: true,
  created_at: "2026-10-04T00:00:00.000Z",
  updated_at: "2026-10-04T00:00:00.000Z",
};

interface RepositoryFixture {
  runtimeRows?: unknown[];
  runtimeError?: { message: string; code?: string } | null;
  seasonEraId?: string;
  identityRows?: unknown[];
  agreementRows?: unknown[];
  seasonRows?: unknown[];
  rosterRows?: unknown[];
  legacyRows?: unknown[];
  materializationRows?: unknown[];
  seasonErrorFrom?: number;
}

function createRepository(fixture: RepositoryFixture = {}) {
  const calls: QueryContext[] = [];
  const client = {
    from(table: string) {
      const context = { table, filters: [] };
      calls.push(context);
      return new QueryBuilder(context, ({ table: queriedTable, range }) => {
        if (queriedTable === "games") {
          return {
            data: { season_year: 2026, season_era_id: fixture.seasonEraId ?? "modern" },
            error: null,
          };
        }
        if (queriedTable === "game_contract_identities") {
          return {
            data: fixture.identityRows ?? [
              {
                player_id: ids.player,
                resolution_status: "observed-standard",
                contract_type: "standard",
                provenance_quality: "observed",
                source_method: "basketball-reference-current-salary",
                estimated: false,
                cap_treatment: "standard-cap-and-matching",
                exclusion_evidence: null,
              },
            ],
            error: null,
          };
        }
        if (queriedTable === "game_contract_agreements") {
          return {
            data: fixture.agreementRows ?? [
              {
                id: ids.agreement,
                game_id: ids.game,
                player_id: ids.player,
                team_id: ids.oldTeam,
                start_season_label: null,
                end_season_label: null,
                remaining_guaranteed_amount: null,
                contract_type: "standard",
                provenance_quality: "observed",
                source_method: "basketball-reference-current-salary",
                estimated: false,
                cap_treatment: "standard-cap-and-matching",
              },
            ],
            error: null,
          };
        }
        if (queriedTable === "game_contract_seasons") {
          if (
            fixture.seasonErrorFrom !== undefined &&
            (range?.from ?? 0) >= fixture.seasonErrorFrom
          ) {
            return { data: null, error: { message: "Contract season page unavailable" } };
          }
          const rows = fixture.seasonRows ?? [
            {
              agreement_id: ids.agreement,
              season_label: "2026-27",
              start_year: 2026,
              end_year: 2027,
              salary_amount: 12_000_000,
              option_kind: "none",
              guarantee_kind: "guaranteed",
            },
          ];
          return {
            data: rows.slice(
              range?.from ?? 0,
              (range?.from ?? 0) + Math.min(1000, range ? range.to - range.from + 1 : 1000)
            ),
            error: null,
          };
        }
        if (queriedTable === "game_player_states") {
          return {
            data: fixture.rosterRows ?? [{ player_id: ids.player, team_id: ids.currentTeam }],
            error: null,
          };
        }
        if (queriedTable === "game_runtime_contracts") {
          return { data: fixture.runtimeRows ?? [], error: fixture.runtimeError ?? null };
        }
        if (queriedTable === "contracts") {
          return { data: fixture.legacyRows ?? [], error: null };
        }
        if (queriedTable === "game_contract_materializations") {
          return { data: fixture.materializationRows ?? [], error: null };
        }
        return { data: [], error: null };
      });
    },
  } as unknown as SupabaseClient;
  return { repository: new SupabaseContractRepository(client), calls };
}

describe("SupabaseContractRepository effective modern reads", () => {
  it("types and round-trips simulated origin without observed compatibility provenance", () => {
    const parsed = contractSchema.parse({
      id: ids.agreement,
      gameId: ids.game,
      playerId: ids.player,
      teamId: ids.currentTeam,
      startYear: 2026,
      endYear: 2027,
      salaryY1: 8_000_000,
      salaryY2: 8_000_000,
      isPlayerOption: false,
      isTeamOption: false,
      isGuaranteed: true,
      origin: "simulated-agreement",
      createdAt: new Date("2026-10-04T00:00:00.000Z"),
      updatedAt: new Date("2026-10-04T00:00:00.000Z"),
    });
    const typedOrigin: Contract["origin"] = parsed.origin;

    expect(typedOrigin).toBe("simulated-agreement");
    expect(contractSchema.parse(parsed).origin).toBe("simulated-agreement");
    expect(parsed).not.toHaveProperty("compatibilityProjection");
  });

  it("returns observed salary coverage under current game roster ownership", async () => {
    const { repository, calls } = createRepository();

    const contracts = await repository.getByTeamId(ids.game, ids.currentTeam);

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      playerId: ids.player,
      teamId: ids.currentTeam,
      salaryY1: 12_000_000,
      compatibilityProjection: "observed-season-coverage",
    });
    expect(calls.some(({ table }) => table === "game_runtime_contracts")).toBe(true);
  });

  it("does not expose an agreement for its stale imported team after a trade", async () => {
    const { repository } = createRepository();

    const contracts = await repository.getByTeamId(ids.game, ids.oldTeam);

    expect(contracts).toEqual([]);
  });

  it("preserves a team's contracts and payroll beyond the first 1000 league season rows", async () => {
    const players = Array.from({ length: 300 }, (_, index) => {
      const suffix = String(index + 1).padStart(12, "0");
      return {
        playerId: `22222222-2222-4222-8222-${suffix}`,
        agreementId: `55555555-5555-4555-8555-${suffix}`,
        teamId: index < 286 ? ids.oldTeam : ids.currentTeam,
      };
    });
    const fixture: RepositoryFixture = {
      identityRows: players.map(({ playerId }) => ({
        player_id: playerId,
        resolution_status: "observed-standard",
        contract_type: "standard",
        provenance_quality: "observed",
        source_method: "basketball-reference-current-salary",
        estimated: false,
        cap_treatment: "standard-cap-and-matching",
        exclusion_evidence: null,
      })),
      agreementRows: players.map(({ playerId, agreementId, teamId }) => ({
        id: agreementId,
        game_id: ids.game,
        player_id: playerId,
        team_id: teamId,
        start_season_label: null,
        end_season_label: null,
        remaining_guaranteed_amount: null,
        contract_type: "standard",
        provenance_quality: "observed",
        source_method: "basketball-reference-current-salary",
        estimated: false,
        cap_treatment: "standard-cap-and-matching",
      })),
      rosterRows: players.map(({ playerId, teamId }) => ({ player_id: playerId, team_id: teamId })),
      seasonRows: players.flatMap(({ agreementId }) =>
        Array.from({ length: 5 }, (_, offset) => ({
          agreement_id: agreementId,
          season_label: `${2026 + offset}-${27 + offset}`,
          start_year: 2026 + offset,
          end_year: 2027 + offset,
          salary_amount: 12_000_000,
          option_kind: "none",
          guarantee_kind: "guaranteed",
        }))
      ),
    };
    const { repository } = createRepository(fixture);

    const contracts = await repository.getByTeamId(ids.game, ids.currentTeam);

    expect(contracts).toHaveLength(14);
    expect(contracts.reduce((total, contract) => total + contract.salaryY1, 0)).toBe(168_000_000);
    expect(contracts.every(({ endYear }) => endYear === 2030)).toBe(true);

    const failing = createRepository({ ...fixture, seasonErrorFrom: 1000 });
    await expect(failing.repository.getByTeamId(ids.game, ids.currentTeam)).rejects.toThrow(
      "Contract season page unavailable"
    );
  });

  it("projects simulated agreements with explicit simulated origin instead of observed provenance", async () => {
    const { repository } = createRepository({ runtimeRows: [runtimeRow] });

    const contracts = await repository.getByTeamId(ids.game, ids.currentTeam);

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      teamId: ids.currentTeam,
      salaryY1: 8_000_000,
      origin: "simulated-agreement",
    });
    expect(contracts[0]).not.toHaveProperty("compatibilityProjection");
  });

  it("uses the unified simulated result across each modern repository read", async () => {
    const { repository } = createRepository({ runtimeRows: [runtimeRow] });

    const all = await repository.getAll(ids.game);
    const byId = await repository.getById(ids.game, runtimeRow.id);
    const byPlayer = await repository.getByPlayerId(ids.game, ids.player);
    const byTeam = await repository.getByTeamId(ids.game, ids.currentTeam);
    const active = await repository.getActiveContracts(ids.game);
    const expiring = await repository.getExpiringContracts(ids.game, 2028);

    expect(all).toHaveLength(1);
    expect(all[0]).toHaveProperty("origin", "simulated-agreement");
    expect(byId?.id).toBe(runtimeRow.id);
    expect(byPlayer?.id).toBe(runtimeRow.id);
    expect(byTeam[0]?.id).toBe(runtimeRow.id);
    expect(active[0]?.id).toBe(runtimeRow.id);
    expect(expiring[0]?.id).toBe(runtimeRow.id);
  });

  it.each([
    ["getAll", (repository: SupabaseContractRepository) => repository.getAll(ids.game)],
    [
      "getById",
      (repository: SupabaseContractRepository) => repository.getById(ids.game, ids.agreement),
    ],
    [
      "getByPlayerId",
      (repository: SupabaseContractRepository) => repository.getByPlayerId(ids.game, ids.player),
    ],
    [
      "getByTeamId",
      (repository: SupabaseContractRepository) => repository.getByTeamId(ids.game, ids.currentTeam),
    ],
    [
      "getActiveContracts",
      (repository: SupabaseContractRepository) => repository.getActiveContracts(ids.game),
    ],
    [
      "getExpiringContracts",
      (repository: SupabaseContractRepository) => repository.getExpiringContracts(ids.game, 2026),
    ],
  ])("propagates runtime relation errors through %s", async (_method, read) => {
    const { repository } = createRepository({
      runtimeError: {
        code: "PGRST205",
        message: "Could not find the table game_runtime_contracts",
      },
    });

    await expect(read(repository)).rejects.toThrow(
      "Could not find the table game_runtime_contracts"
    );
  });

  it.each([
    "inactive-excluded",
    "unclassified",
  ] as const)("does not fallback to legacy rows for canonical %s identities", async (resolutionStatus) => {
    const canonicalIdentity = {
      player_id: ids.player,
      resolution_status: resolutionStatus,
      contract_type: null,
      provenance_quality: null,
      source_method: null,
      estimated: false,
      cap_treatment:
        resolutionStatus === "inactive-excluded"
          ? "excluded-inactive"
          : "standard-cap-and-matching",
      exclusion_evidence: resolutionStatus === "inactive-excluded" ? { source: "curated" } : null,
    };
    const { repository, calls } = createRepository({
      identityRows: [canonicalIdentity],
      agreementRows: [],
      seasonRows: [],
      legacyRows: [legacyContractRow],
    });

    const contracts = await repository.getAll(ids.game);

    expect(contracts).toEqual([]);
    expect(calls.some(({ table }) => table === "contracts")).toBe(false);
  });

  it("uses legacy contracts for canonical identities genuinely absent in an unmigrated modern save", async () => {
    const { repository } = createRepository({
      identityRows: [],
      agreementRows: [],
      seasonRows: [],
      legacyRows: [legacyContractRow],
    });

    const contracts = await repository.getAll(ids.game);

    expect(contracts).toMatchObject([{ id: ids.agreement, teamId: ids.currentTeam }]);
  });

  it("preserves non-modern legacy reads without requiring current game roster state", async () => {
    const { repository } = createRepository({
      seasonEraId: "lebron",
      identityRows: [],
      agreementRows: [],
      rosterRows: [],
      legacyRows: [legacyContractRow],
    });

    const contracts = await repository.getAll(ids.game);

    expect(contracts).toMatchObject([{ id: ids.agreement, teamId: ids.currentTeam }]);
  });

  it("preserves legacy modern contract reads when the save has no game player-state rows", async () => {
    const { repository } = createRepository({
      identityRows: [],
      agreementRows: [],
      seasonRows: [],
      rosterRows: [],
      legacyRows: [legacyContractRow],
    });

    const contracts = await repository.getAll(ids.game);

    expect(contracts[0]?.teamId).toBe(ids.currentTeam);
  });

  it("returns no legacy contracts for a covered modern save with an empty game roster", async () => {
    const { repository } = createRepository({
      identityRows: [],
      agreementRows: [],
      seasonRows: [],
      rosterRows: [],
      materializationRows: [{ game_id: ids.game }],
      legacyRows: [legacyContractRow],
    });

    const contracts = await repository.getAll(ids.game);

    expect(contracts).toEqual([]);
  });
});
