import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentRosterRefresh,
  ROSTER_REFRESH_STATUS,
  type RosterEntry,
} from "@/application/roster/currentRosterRefresh";

interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

interface SupabaseQueryContext {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  filters: Array<{ column: string; value: unknown; operator: "eq" }>;
  selectColumns?: string;
  insertPayload?: unknown;
  updatePayload?: unknown;
  rpcName?: string;
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

  select(columns = "*"): QueryBuilder {
    this.context.selectColumns = columns;
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

interface MockClientResult {
  client: SupabaseClient;
  calls: SupabaseQueryContext[];
}

const createMockClient = (resolver: QueryResolver, rpcCalls: RpcCall[]): MockClientResult => {
  const calls: SupabaseQueryContext[] = [];

  const client = {
    from: (table: string) => {
      const context: SupabaseQueryContext = {
        table,
        operation: "select",
        filters: [],
        single: false,
      };
      calls.push(context);
      return new QueryBuilder(context, resolver);
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      return resolver({
        table: "",
        operation: "select",
        filters: [],
        rpcName: name,
        single: false,
      });
    },
  } as unknown as SupabaseClient;

  return { client, calls };
};

const UUIDS = {
  gameId: "11111111-1111-4111-8111-111111111111",
  selectedTeamId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  teamA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  teamB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const TEAMS = [
  { id: UUIDS.teamA, nba_id: 1, abbreviation: "AAA" },
  { id: UUIDS.teamB, nba_id: 2, abbreviation: "BBB" },
] as const;

const PLAYER_A: RosterEntry = {
  provider: "espn",
  sourceId: 101,
  payload: { name: "Player A" },
};

const PLAYER_B: RosterEntry = {
  provider: "espn",
  sourceId: 102,
  payload: { name: "Player B" },
};

interface TestSetup {
  authClient: SupabaseClient;
  serviceClient: SupabaseClient;
  authCalls: SupabaseQueryContext[];
  serviceCalls: SupabaseQueryContext[];
  rpcCalls: RpcCall[];
}

const createTestSetup = (resolver: QueryResolver): TestSetup => {
  const rpcCalls: RpcCall[] = [];
  const authMock = createMockClient(resolver, rpcCalls);
  const serviceMock = createMockClient(resolver, rpcCalls);

  return {
    authClient: authMock.client,
    serviceClient: serviceMock.client,
    authCalls: authMock.calls,
    serviceCalls: serviceMock.calls,
    rpcCalls,
  };
};

const defaultResolver = (): SupabaseQueryResult => ({ data: null, error: null });

const successfulResolver = (context: SupabaseQueryContext): SupabaseQueryResult => {
  if (context.table === "teams" && context.operation === "select") {
    return { data: [...TEAMS], error: null };
  }

  if (context.table === "roster_refresh_runs" && context.operation === "insert" && context.single) {
    return { data: { id: UUIDS.runId, expected_team_count: TEAMS.length }, error: null };
  }

  if (context.table === "roster_refresh_staging" && context.operation === "insert") {
    return { data: null, error: null };
  }

  return { data: null, error: null };
};

describe("currentRosterRefresh", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns failed for malformed gameId without touching Supabase", async () => {
    const setup = createTestSetup(defaultResolver);

    const result = await currentRosterRefresh({
      gameId: "not-a-uuid",
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: () => [PLAYER_A],
    });

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.FAILED);
    expect(result.teamCount).toBe(0);
    expect(result.runId).toBe("");
    expect(setup.authCalls).toHaveLength(0);
    expect(setup.serviceCalls).toHaveLength(0);
    expect(setup.rpcCalls).toHaveLength(0);
  });

  it("returns failed for malformed selectedTeamId without touching Supabase", async () => {
    const setup = createTestSetup(defaultResolver);

    const result = await currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: "not-a-uuid",
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: () => [PLAYER_A],
    });

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.FAILED);
    expect(result.teamCount).toBe(0);
    expect(setup.authCalls).toHaveLength(0);
    expect(setup.serviceCalls).toHaveLength(0);
    expect(setup.rpcCalls).toHaveLength(0);
  });

  it("returns failed when promotion rejects an incomplete roster and falls back to seed", async () => {
    let stagedTeamIds: string[] = [];

    const setup = createTestSetup((context) => {
      if (context.table === "teams" && context.operation === "select") {
        return { data: [...TEAMS], error: null };
      }

      if (
        context.table === "roster_refresh_runs" &&
        context.operation === "insert" &&
        context.single
      ) {
        return { data: { id: UUIDS.runId, expected_team_count: TEAMS.length }, error: null };
      }

      if (context.table === "roster_refresh_staging" && context.operation === "insert") {
        const payload = context.insertPayload as Array<{ team_id: string }> | undefined;
        stagedTeamIds = [...new Set(payload?.map((row) => row.team_id) ?? [])];
        return { data: null, error: null };
      }

      if (context.rpcName === "promote_current_roster" && stagedTeamIds.length < TEAMS.length) {
        return { data: null, error: { message: "Incomplete roster" } };
      }

      return { data: null, error: null };
    });

    const result = await currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: (team) => {
        return team.nbaId === TEAMS[0].nba_id ? [PLAYER_A] : [];
      },
    });

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.FAILED);
    expect(result.teamCount).toBe(TEAMS.length);
    expect(result.runId).toBe(UUIDS.runId);
    expect(stagedTeamIds).toHaveLength(1);
    expect(
      setup.rpcCalls.some(
        (call) => call.name === "promote_current_roster" && call.params.p_run_id === UUIDS.runId
      )
    ).toBe(true);
    expect(setup.rpcCalls.some((call) => call.name === "seed_game_data")).toBe(true);
  });

  it("returns failed and does not promote when a team fetch fails", async () => {
    const setup = createTestSetup(successfulResolver);

    const result = await currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: (team) => {
        if (team.nbaId === TEAMS[0].nba_id) {
          return [PLAYER_A];
        }
        throw new Error("Network error");
      },
      maxRetries: 0,
    });

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.FAILED);
    expect(result.teamCount).toBe(TEAMS.length);
    expect(result.runId).toBe(UUIDS.runId);
    expect(setup.rpcCalls.some((call) => call.name === "promote_current_roster")).toBe(false);
    expect(setup.rpcCalls.some((call) => call.name === "seed_game_data")).toBe(true);
  });

  it("retries team fetch up to maxRetries before failing", async () => {
    const singleTeamResolver = (context: SupabaseQueryContext): SupabaseQueryResult => {
      if (context.table === "teams" && context.operation === "select") {
        return { data: [{ id: UUIDS.teamA, nba_id: 1, abbreviation: "AAA" }], error: null };
      }

      if (
        context.table === "roster_refresh_runs" &&
        context.operation === "insert" &&
        context.single
      ) {
        return { data: { id: UUIDS.runId, expected_team_count: 1 }, error: null };
      }

      if (context.table === "roster_refresh_staging" && context.operation === "insert") {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    };

    const setup = createTestSetup(singleTeamResolver);
    const fetcher = vi.fn<(teamAbbreviation: string) => RosterEntry[]>();
    fetcher
      .mockRejectedValueOnce(new Error("Attempt 1"))
      .mockRejectedValueOnce(new Error("Attempt 2"))
      .mockResolvedValueOnce([PLAYER_A]);

    await currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: (team) => fetcher(team.abbreviation),
      maxRetries: 2,
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("returns success when all teams refresh and promote", async () => {
    const setup = createTestSetup(successfulResolver);

    const result = await currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: () => [PLAYER_A, PLAYER_B],
    });

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.SUCCESS);
    expect(result.teamCount).toBe(TEAMS.length);
    expect(result.runId).toBe(UUIDS.runId);
    expect(
      setup.rpcCalls.some(
        (call) => call.name === "promote_current_roster" && call.params.p_run_id === UUIDS.runId
      )
    ).toBe(true);
    expect(
      setup.rpcCalls.some(
        (call) =>
          call.name === "seed_game_data" &&
          call.params.p_game_id === UUIDS.gameId &&
          call.params.p_team_id === UUIDS.selectedTeamId
      )
    ).toBe(true);
  });

  it("respects the overall timeout bound", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const setup = createTestSetup((context) => {
      if (context.table === "teams" && context.operation === "select") {
        return { data: [...TEAMS], error: null };
      }

      if (
        context.table === "roster_refresh_runs" &&
        context.operation === "insert" &&
        context.single
      ) {
        return { data: { id: UUIDS.runId, expected_team_count: TEAMS.length }, error: null };
      }

      return { data: null, error: null };
    });

    const promise = currentRosterRefresh({
      gameId: UUIDS.gameId,
      selectedTeamId: UUIDS.selectedTeamId,
      authenticatedClient: setup.authClient,
      serviceClient: setup.serviceClient,
      fetchTeamRoster: () =>
        new Promise<RosterEntry[]>((resolve) => {
          setTimeout(() => resolve([PLAYER_A]), 200);
        }),
      overallTimeoutMs: 50,
    });

    vi.advanceTimersByTime(250);
    const result = await promise;

    expect(result.status).toBe(ROSTER_REFRESH_STATUS.FAILED);
    expect(result.error).toContain("timed out");

    vi.useRealTimers();
  });
});
