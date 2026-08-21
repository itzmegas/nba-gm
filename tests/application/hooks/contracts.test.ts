import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";

interface SupabaseQueryContext {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  filters: Array<{ column: string; value: unknown; operator: "eq" | "gte" }>;
  orderBy?: { column: string; ascending?: boolean };
  insertPayload?: unknown;
  updatePayload?: unknown;
  selected: boolean;
  single: boolean;
  deleteCalled: boolean;
}

interface SupabaseQueryResult {
  data: unknown;
  error: { message: string } | null;
}

type QueryResolver = (context: SupabaseQueryContext) => SupabaseQueryResult;

class QueryBuilder {
  constructor(
    private readonly context: SupabaseQueryContext,
    private readonly resolver: QueryResolver
  ) {}

  select(): QueryBuilder {
    this.context.selected = true;
    return this;
  }

  insert(payload: unknown): QueryBuilder {
    this.context.operation = "insert";
    this.context.insertPayload = payload;
    return this;
  }

  update(payload: unknown): QueryBuilder {
    this.context.operation = "update";
    this.context.updatePayload = payload;
    return this;
  }

  delete(): QueryBuilder {
    this.context.operation = "delete";
    this.context.deleteCalled = true;
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder {
    this.context.filters.push({ column, value, operator: "eq" });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder {
    this.context.filters.push({ column, value, operator: "gte" });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    this.context.orderBy = { column, ascending: options?.ascending };
    return this;
  }

  single(): QueryBuilder {
    this.context.single = true;
    return this;
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables
  then<TResult1 = SupabaseQueryResult, TResult2 = never>(
    onfulfilled?: ((value: SupabaseQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolver(this.context)).then(onfulfilled, onrejected);
  }
}

const createSupabaseClientMock = (resolver: QueryResolver) => {
  const calls: SupabaseQueryContext[] = [];

  const client = {
    from: (table: string) => {
      const context: SupabaseQueryContext = {
        table,
        operation: "select",
        filters: [],
        selected: false,
        single: false,
        deleteCalled: false,
      };
      calls.push(context);
      return new QueryBuilder(context, resolver);
    },
  } as unknown as SupabaseClient;

  return { client, calls };
};

const UUIDS = {
  gameId: "16161616-1616-4616-8616-161616161616",
  contractId: "17171717-1717-4717-8717-171717171717",
  playerId: "18181818-1818-4818-8818-181818181818",
  teamId: "19191919-1919-4919-8919-191919191919",
} as const;

const baseContractRow = {
  id: UUIDS.contractId,
  game_id: UUIDS.gameId,
  player_id: UUIDS.playerId,
  team_id: UUIDS.teamId,
  start_year: 2026,
  end_year: 2029,
  salary_y1: 0,
  salary_y2: 1_000_000,
  salary_y3: 2_000_000,
  salary_y4: null,
  salary_y5: null,
  is_player_option: false,
  is_team_option: false,
  is_guaranteed: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
} as const;

describe("Contract hooks repository integration", () => {
  it("passes gameId in getAll query and maps gameId in entity", async () => {
    const mock = createSupabaseClientMock(() => ({ data: [baseContractRow], error: null }));
    const repository = new SupabaseContractRepository(mock.client);

    const result = await repository.getAll(UUIDS.gameId);

    expect(result).toHaveLength(1);
    expect(result[0].gameId).toBe(UUIDS.gameId);
    expect(result[0].salaryY1).toBe(0);
    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
  });

  it("passes gameId in getById, getByPlayerId and getByTeamId queries", async () => {
    const mock = createSupabaseClientMock(() => ({ data: baseContractRow, error: null }));
    const repository = new SupabaseContractRepository(mock.client);

    await repository.getById(UUIDS.gameId, UUIDS.contractId);
    await repository.getByPlayerId(UUIDS.gameId, UUIDS.playerId);

    const secondMock = createSupabaseClientMock(() => ({ data: [baseContractRow], error: null }));
    const secondRepository = new SupabaseContractRepository(secondMock.client);
    await secondRepository.getByTeamId(UUIDS.gameId, UUIDS.teamId);

    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
    expect(mock.calls[1].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
    expect(secondMock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
  });

  it("includes gameId in mapToRow payload for create", async () => {
    const mock = createSupabaseClientMock((context) => {
      if (context.operation === "insert") {
        return { data: baseContractRow, error: null };
      }
      return { data: null, error: null };
    });
    const repository = new SupabaseContractRepository(mock.client);

    await repository.create({
      gameId: UUIDS.gameId,
      playerId: UUIDS.playerId,
      teamId: UUIDS.teamId,
      startYear: 2026,
      endYear: 2029,
      salaryY1: 0,
      salaryY2: undefined,
      salaryY3: undefined,
      salaryY4: undefined,
      salaryY5: undefined,
      isPlayerOption: false,
      isTeamOption: false,
      isGuaranteed: true,
    });

    expect(mock.calls[0].insertPayload).toMatchObject({
      game_id: UUIDS.gameId,
      player_id: UUIDS.playerId,
      team_id: UUIDS.teamId,
      salary_y1: 0,
    });
  });

  it("includes gameId and salaryY1=0 in mapToRow payload for update", async () => {
    const mock = createSupabaseClientMock((context) => {
      if (context.operation === "update") {
        return { data: baseContractRow, error: null };
      }
      return { data: null, error: null };
    });
    const repository = new SupabaseContractRepository(mock.client);

    await repository.update(UUIDS.gameId, UUIDS.contractId, {
      gameId: UUIDS.gameId,
      salaryY1: 0,
    });

    expect(mock.calls[0].updatePayload).toMatchObject({
      game_id: UUIDS.gameId,
      salary_y1: 0,
    });
    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
  });
});
