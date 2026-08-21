import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";

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
  gameId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  otherGameId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  playerId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  otherPlayerId: "12121212-1212-4212-8212-121212121212",
  teamId: "13131313-1313-4313-8313-131313131313",
} as const;

const baseRow = {
  id: "14141414-1414-4414-8414-141414141414",
  game_id: UUIDS.gameId,
  player_id: UUIDS.playerId,
  team_id: UUIDS.teamId,
  morale: 60,
  fatigue: 30,
  is_active: true,
  is_injured: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
} as const;

describe("SupabasePlayerStateRepository", () => {
  it("getByGameId returns mapped PlayerState array", async () => {
    const mock = createSupabaseClientMock(() => ({ data: [baseRow], error: null }));
    const repo = new SupabasePlayerStateRepository(mock.client);

    const result = await repo.getByGameId(UUIDS.gameId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      gameId: UUIDS.gameId,
      playerId: UUIDS.playerId,
      teamId: UUIDS.teamId,
      morale: 60,
      fatigue: 30,
    });
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
  });

  it("getByGameAndTeam filters by gameId and teamId", async () => {
    const mock = createSupabaseClientMock((context) => {
      const gameFilter = context.filters.find((filter) => filter.column === "game_id")?.value;
      const teamFilter = context.filters.find((filter) => filter.column === "team_id")?.value;
      if (gameFilter === UUIDS.gameId && teamFilter === UUIDS.teamId) {
        return { data: [baseRow], error: null };
      }
      return { data: [], error: null };
    });
    const repo = new SupabasePlayerStateRepository(mock.client);

    const result = await repo.getByGameAndTeam(UUIDS.gameId, UUIDS.teamId);

    expect(result).toHaveLength(1);
    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
    expect(mock.calls[0].filters).toContainEqual({
      column: "team_id",
      value: UUIDS.teamId,
      operator: "eq",
    });
  });

  it("getByGameAndPlayer returns single PlayerState or null", async () => {
    const mock = createSupabaseClientMock((context) => {
      const playerFilter = context.filters.find((filter) => filter.column === "player_id")?.value;

      if (playerFilter === UUIDS.playerId) {
        return { data: baseRow, error: null };
      }
      return { data: null, error: { message: "Not found" } };
    });
    const repo = new SupabasePlayerStateRepository(mock.client);

    const found = await repo.getByGameAndPlayer(UUIDS.gameId, UUIDS.playerId);
    const notFound = await repo.getByGameAndPlayer(UUIDS.gameId, UUIDS.otherPlayerId);

    expect(found?.playerId).toBe(UUIDS.playerId);
    expect(notFound).toBeNull();
  });

  it("bulkCreateForGame inserts multiple and returns mapped array with gameId injected", async () => {
    const insertedRows = [
      baseRow,
      {
        ...baseRow,
        id: "15151515-1515-4515-8515-151515151515",
        player_id: UUIDS.otherPlayerId,
        game_id: UUIDS.gameId,
      },
    ];

    const mock = createSupabaseClientMock((context) => {
      if (context.operation === "insert") {
        return { data: insertedRows, error: null };
      }
      return { data: [], error: null };
    });
    const repo = new SupabasePlayerStateRepository(mock.client);

    const result = await repo.bulkCreateForGame(UUIDS.gameId, [
      {
        playerId: UUIDS.playerId,
        teamId: UUIDS.teamId,
        morale: 60,
        fatigue: 30,
        isActive: true,
        isInjured: false,
      },
      {
        playerId: UUIDS.otherPlayerId,
        teamId: UUIDS.teamId,
        morale: 55,
        fatigue: 35,
        isActive: true,
        isInjured: false,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].gameId).toBe(UUIDS.gameId);
    expect(result[1].playerId).toBe(UUIDS.otherPlayerId);

    const insertPayload = mock.calls[0].insertPayload as Array<Record<string, unknown>>;
    expect(insertPayload[0].game_id).toBe(UUIDS.gameId);
    expect(insertPayload[1].game_id).toBe(UUIDS.gameId);
  });

  it("updateByGameAndPlayer updates and returns mapped result", async () => {
    const updatedRow = {
      ...baseRow,
      fatigue: 80,
      is_injured: true,
    };

    const mock = createSupabaseClientMock((context) => {
      if (context.operation === "update") {
        return { data: updatedRow, error: null };
      }
      return { data: null, error: null };
    });
    const repo = new SupabasePlayerStateRepository(mock.client);

    const result = await repo.updateByGameAndPlayer(UUIDS.gameId, UUIDS.playerId, {
      fatigue: 80,
      isInjured: true,
    });

    expect(result.fatigue).toBe(80);
    expect(result.isInjured).toBe(true);
    expect(mock.calls[0].filters).toContainEqual({
      column: "game_id",
      value: UUIDS.gameId,
      operator: "eq",
    });
    expect(mock.calls[0].filters).toContainEqual({
      column: "player_id",
      value: UUIDS.playerId,
      operator: "eq",
    });
    expect(mock.calls[0].updatePayload).toMatchObject({ fatigue: 80, is_injured: true });
  });
});
