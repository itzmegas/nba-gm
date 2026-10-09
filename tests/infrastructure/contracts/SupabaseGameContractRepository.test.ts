import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";

interface QueryContext {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
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
  team: "33333333-3333-4333-8333-333333333333",
  oldTeam: "44444444-4444-4444-8444-444444444444",
  canonicalAgreement: "55555555-5555-4555-8555-555555555555",
  simulatedAgreement: "66666666-6666-4666-8666-666666666666",
} as const;

function createRepository(runtimeResult?: {
  data: unknown;
  error: { message: string; code?: string } | null;
}) {
  const calls: QueryContext[] = [];
  const client = {
    from(table: string) {
      const context = { table, filters: [] };
      calls.push(context);
      return new QueryBuilder(context, ({ table: selectedTable }) => {
        if (selectedTable === "game_contract_identities") {
          return {
            data: [
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
        if (selectedTable === "game_contract_agreements") {
          return {
            data: [
              {
                id: ids.canonicalAgreement,
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
        if (selectedTable === "game_contract_seasons") {
          return {
            data: [
              {
                agreement_id: ids.canonicalAgreement,
                season_label: "2026-27",
                start_year: 2026,
                end_year: 2027,
                salary_amount: 10_000_000,
                option_kind: "none",
                guarantee_kind: "guaranteed",
              },
            ],
            error: null,
          };
        }
        if (selectedTable === "game_player_states") {
          return { data: [{ player_id: ids.player, team_id: ids.team }], error: null };
        }
        if (selectedTable === "game_runtime_contracts") {
          return runtimeResult ?? { data: [], error: null };
        }
        return { data: [], error: null };
      });
    },
  } as unknown as SupabaseClient;
  return { repository: new SupabaseGameContractRepository(client), calls };
}

const simulatedRow = {
  id: ids.simulatedAgreement,
  game_id: ids.game,
  player_id: ids.player,
  origin_kind: "simulated-agreement",
  start_year: 2026,
  end_year: 2028,
  annual_salary: 8_000_000,
  is_player_option: true,
  is_team_option: false,
  is_guaranteed: true,
  created_at: "2026-10-04T00:00:00.000Z",
};

describe("SupabaseGameContractRepository effective contract reads", () => {
  it("prefers the explicitly simulated agreement once and follows current roster ownership", async () => {
    const { repository, calls } = createRepository({ data: [simulatedRow], error: null });

    const contracts = await repository.getEffectiveAll(ids.game);

    expect(contracts).toEqual([
      {
        playerId: ids.player,
        teamId: ids.team,
        canonical: null,
        simulated: {
          id: ids.simulatedAgreement,
          gameId: ids.game,
          playerId: ids.player,
          origin: "simulated-agreement",
          startYear: 2026,
          endYear: 2028,
          annualSalary: 8_000_000,
          isPlayerOption: true,
          isTeamOption: false,
          isGuaranteed: true,
          createdAt: simulatedRow.created_at,
        },
      },
    ]);
    expect(
      calls
        .filter(({ table }) => table === "game_runtime_contracts")
        .every(({ filters }) =>
          filters.some(({ column, value }) => column === "game_id" && value === ids.game)
        )
    ).toBe(true);
  });

  it.each([
    { code: "42P01", message: 'relation "game_runtime_contracts" does not exist' },
    { code: "PGRST205", message: "Could not find the table game_runtime_contracts" },
    { message: 'relation "game_runtime_contracts" does not exist' },
  ])("propagates a missing runtime relation instead of falling back: $code", async (error) => {
    const { repository } = createRepository({
      data: null,
      error,
    });

    await expect(repository.getEffectiveAll(ids.game)).rejects.toThrow(error.message);
  });

  it("does not convert a transport failure into an empty overlay", async () => {
    const { repository } = createRepository({
      data: null,
      error: { message: "connection reset" },
    });

    await expect(repository.getEffectiveAll(ids.game)).rejects.toThrow("connection reset");
  });

  it("fails closed when a runtime row violates the simulated contract schema", async () => {
    const { repository } = createRepository({
      data: [{ ...simulatedRow, origin_kind: "observed-standard" }],
      error: null,
    });

    await expect(repository.getEffectiveAll(ids.game)).rejects.toThrow();
  });

  it("accepts PostgREST timestamps with an explicit timezone offset", async () => {
    const createdAt = "2026-10-04T00:00:00+00:00";
    const { repository } = createRepository({
      data: [{ ...simulatedRow, created_at: createdAt }],
      error: null,
    });

    const contracts = await repository.getEffectiveAll(ids.game);

    expect(contracts[0]?.simulated?.createdAt).toBe(createdAt);
  });

  it("continues rejecting malformed runtime timestamps", async () => {
    const { repository } = createRepository({
      data: [{ ...simulatedRow, created_at: "2026-10-04 00:00:00" }],
      error: null,
    });

    await expect(repository.getEffectiveAll(ids.game)).rejects.toThrow();
  });

  it("fails closed when the scoped runtime query returns another game's row", async () => {
    const { repository } = createRepository({
      data: [{ ...simulatedRow, game_id: "77777777-7777-4777-8777-777777777777" }],
      error: null,
    });

    await expect(repository.getEffectiveAll(ids.game)).rejects.toThrow(
      "Runtime contract query returned a different game"
    );
  });
});
