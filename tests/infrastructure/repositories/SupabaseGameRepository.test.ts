import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { GAME_STATUS } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";

interface SupabaseQueryContext {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  filters: Array<{ column: string; value: unknown; operator: "eq" | "gte" }>;
  orderBy?: { column: string; ascending?: boolean };
  insertPayload?: unknown;
  updatePayload?: unknown;
  selected: boolean;
  single: boolean;
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

  eq(column: string, value: unknown): QueryBuilder {
    this.context.filters.push({ column, value, operator: "eq" });
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
      };
      calls.push(context);
      return new QueryBuilder(context, resolver);
    },
  } as unknown as SupabaseClient;

  return { client, calls };
};

const UUIDS = {
  gameId: "88888888-8888-4888-8888-888888888888",
  userId: "99999999-9999-4999-8999-999999999999",
  teamId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;

const baseGameRow = {
  id: UUIDS.gameId,
  user_id: UUIDS.userId,
  name: "Asociación Test",
  selected_team_id: UUIDS.teamId,
  season_year: 2026,
  simulation_date: "2026-10-01",
  status: GAME_STATUS.ACTIVE,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
} as const;

const createRepository = (
  resolver: (context: SupabaseQueryContext) => { data: unknown; error: { message: string } | null }
) => {
  const mock = createSupabaseClientMock(resolver);
  return {
    repo: new SupabaseGameRepository(mock.client),
    calls: mock.calls,
  };
};

describe("SupabaseGameRepository", () => {
  it("getById returns mapped Game when data exists", async () => {
    const { repo, calls } = createRepository((context) => {
      if (context.table === "games" && context.single) {
        return { data: baseGameRow, error: null };
      }
      return { data: null, error: { message: "Unexpected query" } };
    });

    const result = await repo.getById(UUIDS.gameId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(UUIDS.gameId);
    expect(result?.userId).toBe(UUIDS.userId);
    expect(result?.selectedTeamId).toBe(UUIDS.teamId);
    expect(result?.seasonYear).toBe(2026);
    expect(result?.status).toBe(GAME_STATUS.ACTIVE);
    expect(result?.simulationDate).toBeInstanceOf(Date);
    expect(result?.simulationDate.toISOString().slice(0, 10)).toBe(baseGameRow.simulation_date);

    expect(calls).toHaveLength(1);
    expect(calls[0].filters).toContainEqual({ column: "id", value: UUIDS.gameId, operator: "eq" });
  });

  it("getById returns null when no data", async () => {
    const { repo } = createRepository(() => ({
      data: null,
      error: { message: "No rows" },
    }));

    const result = await repo.getById(UUIDS.gameId);
    expect(result).toBeNull();
  });

  it("getByUserId returns array of mapped Games", async () => {
    const secondRow = {
      ...baseGameRow,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Segunda Asociación",
      status: GAME_STATUS.INITIALIZING,
    };

    const { repo, calls } = createRepository((context) => {
      if (context.table === "games" && context.selected && !context.single) {
        return { data: [baseGameRow, secondRow], error: null };
      }
      return { data: [], error: null };
    });

    const result = await repo.getByUserId(UUIDS.userId);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(baseGameRow.id);
    expect(result[1].status).toBe(GAME_STATUS.INITIALIZING);
    expect(calls[0].orderBy).toEqual({ column: "updated_at", ascending: false });
    expect(calls[0].filters).toContainEqual({
      column: "user_id",
      value: UUIDS.userId,
      operator: "eq",
    });
  });

  it("create inserts and returns mapped Game", async () => {
    const createdRow = {
      ...baseGameRow,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: GAME_STATUS.INITIALIZING,
    };

    const { repo, calls } = createRepository((context) => {
      if (context.operation === "insert") {
        return { data: createdRow, error: null };
      }
      return { data: null, error: null };
    });

    const result = await repo.create({
      userId: UUIDS.userId,
      name: "Nueva Asociación",
      selectedTeamId: UUIDS.teamId,
      seasonYear: 2026,
      simulationDate: new Date("2026-10-01T00:00:00.000Z"),
      status: GAME_STATUS.INITIALIZING,
      deletedAt: undefined,
    });

    expect(result.id).toBe(createdRow.id);
    expect(result.status).toBe(GAME_STATUS.INITIALIZING);
    expect(calls[0].operation).toBe("insert");
    expect(calls[0].insertPayload).toMatchObject({
      user_id: UUIDS.userId,
      name: "Nueva Asociación",
      selected_team_id: UUIDS.teamId,
      season_year: 2026,
      simulation_date: "2026-10-01",
      status: GAME_STATUS.INITIALIZING,
    });
  });

  it("softDelete updates status and deletedAt", async () => {
    const { repo, calls } = createRepository(() => ({ data: null, error: null }));

    await repo.softDelete(UUIDS.gameId);

    expect(calls[0].operation).toBe("update");
    expect(calls[0].filters).toContainEqual({ column: "id", value: UUIDS.gameId, operator: "eq" });
    expect(calls[0].updatePayload).toMatchObject({
      status: GAME_STATUS.DELETED,
    });
    expect((calls[0].updatePayload as { deleted_at?: unknown }).deleted_at).toBeTypeOf("string");
  });
});
