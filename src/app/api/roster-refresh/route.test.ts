import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  CONTRACT_FALLBACK_DIAGNOSTIC_KIND,
  ContractFallbackCoverageError,
  materializeModernGameContracts,
} from "@/application/contracts/materializeModernGameContracts";
import {
  currentRosterRefresh,
  ROSTER_REFRESH_STATUS,
} from "@/application/roster/currentRosterRefresh";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/serviceRole";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/infrastructure/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/application/roster/currentRosterRefresh", () => ({
  currentRosterRefresh: vi.fn(),
  ROSTER_REFRESH_STATUS: {
    SUCCESS: "success",
    FAILED: "failed",
  },
}));
vi.mock("@/application/contracts/materializeModernGameContracts", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/application/contracts/materializeModernGameContracts")
  >()),
  materializeModernGameContracts: vi.fn(),
}));

const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockCreateServiceRoleClient = createServiceRoleClient as unknown as ReturnType<typeof vi.fn>;
const mockCurrentRosterRefresh = currentRosterRefresh as unknown as ReturnType<typeof vi.fn>;
const mockMaterializeModernGameContracts = materializeModernGameContracts as unknown as ReturnType<
  typeof vi.fn
>;

const USER_ID = "99999999-9999-4999-8999-999999999999";
const GAME_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

function createAuthenticatedClient(options?: {
  game?: { season_year: number; season_era_id: string; status: string; user_id: string };
  rollbackError?: { message: string } | null;
  rollbackReject?: Error;
}) {
  const single = vi.fn().mockResolvedValue({
    data: options?.game ?? {
      season_year: 2025,
      season_era_id: "modern",
      status: "initializing",
      user_id: USER_ID,
    },
    error: null,
  });
  const query = { select: vi.fn(), eq: vi.fn(), single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const rpc = vi.fn(async () => {
    if (options?.rollbackReject) throw options.rollbackReject;
    return { data: null, error: options?.rollbackError ?? null };
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: vi.fn().mockReturnValue(query),
    rpc,
  };
}

function createUnauthenticatedClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "No user" } }),
    },
  };
}

function createRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/roster-refresh", {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCreateServiceRoleClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn() });
  mockCurrentRosterRefresh.mockResolvedValue({
    runId: RUN_ID,
    status: ROSTER_REFRESH_STATUS.SUCCESS,
    teamCount: 30,
  });
  mockMaterializeModernGameContracts.mockResolvedValue(undefined);
});

describe("POST /api/roster-refresh", () => {
  it("returns 401 when the caller is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(createUnauthenticatedClient());

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockCurrentRosterRefresh).not.toHaveBeenCalled();
  });

  it("returns 200 and the refresh result on success", async () => {
    mockCreateClient.mockResolvedValue(createAuthenticatedClient());

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { runId: string; status: string; teamCount: number };

    expect(response.status).toBe(200);
    expect(body.runId).toBe(RUN_ID);
    expect(body.status).toBe(ROSTER_REFRESH_STATUS.SUCCESS);
    expect(body.teamCount).toBe(30);
    expect(mockMaterializeModernGameContracts).toHaveBeenCalledOnce();
    expect(mockMaterializeModernGameContracts).toHaveBeenCalledWith(
      expect.objectContaining({ allowUnmatchedRosterExperienceFallback: true })
    );
  });

  it("returns 400 for an invalid request body", async () => {
    mockCreateClient.mockResolvedValue(createAuthenticatedClient());

    const response = await POST(
      createRequest("POST", { gameId: "invalid", selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request body");
    expect(mockCurrentRosterRefresh).not.toHaveBeenCalled();
  });

  it("returns 500 with a sanitized message when refresh fails", async () => {
    mockCreateClient.mockResolvedValue(createAuthenticatedClient());
    mockCurrentRosterRefresh.mockResolvedValue({
      runId: RUN_ID,
      status: ROSTER_REFRESH_STATUS.FAILED,
      teamCount: 30,
      error: "Detailed internal failure that must not leak",
    });

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { error: string; runId: string; teamCount: number };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Roster refresh failed");
    expect(body.error).not.toContain("Detailed internal failure");
    expect(body.runId).toBe(RUN_ID);
    expect(body.teamCount).toBe(30);
  });

  it("returns 500 with a sanitized message when refresh throws", async () => {
    mockCreateClient.mockResolvedValue(createAuthenticatedClient());
    mockCurrentRosterRefresh.mockRejectedValue(new Error("Unexpected explosion"));

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("Unexpected explosion");
  });

  it.each([
    ["materialization failure", new Error("provider payload leaked")],
    ["materialization timeout", new Error("Contract materialization exceeded 120000ms")],
  ])("rolls back game-scoped seed data after %s", async (_label, failure) => {
    const client = createAuthenticatedClient();
    mockCreateClient.mockResolvedValue(client);
    mockMaterializeModernGameContracts.mockRejectedValue(failure);

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
    expect(client.rpc).toHaveBeenCalledWith("rollback_seed_game_data", { p_game_id: GAME_ID });
  });

  it("logs actionable sanitized materialization diagnostics without exposing them in the response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = createAuthenticatedClient();
    mockCreateClient.mockResolvedValue(client);
    const failure = new Error(
      'Complete 30-team contract snapshot acquisition failed: {"failedTeams":[{"nbaAbbreviation":"LAL","sourceTeam":"LAL","error":{"name":"ContractSnapshotSourceUnavailableError","message":"BRef request timed out"}}]}'
    );
    failure.name = "ContractSnapshotAcquisitionError";
    mockMaterializeModernGameContracts.mockRejectedValue(failure);

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"sourceTeam":"LAL"'));
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"message":"BRef request timed out"')
    );
    consoleError.mockRestore();
  });

  it("logs bounded fallback coverage diagnostics while keeping the response exactly generic", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = createAuthenticatedClient();
    mockCreateClient.mockResolvedValue(client);
    const failure = new ContractFallbackCoverageError("2026-27", [
      {
        kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.UNRESOLVED_IDENTITY,
        player: "Unresolved source player",
        team: "LAL",
        reason: "no-exact-provider-record",
      },
      {
        kind: CONTRACT_FALLBACK_DIAGNOSTIC_KIND.BLOCKED_FALLBACK,
        player: "Unresolved Active Player",
        team: "LAL",
        reason: "missing-years-of-service",
      },
    ]);
    mockMaterializeModernGameContracts.mockRejectedValue(failure);

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "unresolved-identity player=Unresolved source player team=LAL reason=no-exact-provider-record"
      )
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "blocked-fallback player=Unresolved Active Player team=LAL reason=missing-years-of-service"
      )
    );
    const loggedMessage = String(consoleError.mock.calls[0]?.[0]);
    expect(loggedMessage).not.toContain('{"');
    expect(loggedMessage).not.toContain('"unresolved"');
    consoleError.mockRestore();
  });

  it("summarizes a Zod boundary failure in logs while keeping the response generic", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = createAuthenticatedClient();
    mockCreateClient.mockResolvedValue(client);
    const parsed = z.object({ providerPayload: z.object({ contract: z.string() }) }).safeParse({
      providerPayload: "raw provider body",
    });
    if (parsed.success) throw new Error("Expected the diagnostic fixture to fail validation");
    mockMaterializeModernGameContracts.mockRejectedValue(parsed.error);

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("code=invalid_type"));
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("raw provider body"));
    consoleError.mockRestore();
  });

  it("keeps the primary error response when rollback fails and logs both failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = createAuthenticatedClient({ rollbackError: { message: "database detail" } });
    mockCreateClient.mockResolvedValue(client);
    mockMaterializeModernGameContracts.mockRejectedValue(new Error("primary detail"));

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(consoleError).toHaveBeenCalledWith(
      "[roster-refresh] contract materialization failed: primary detail"
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[roster-refresh] game rollback failed: database detail"
    );
    consoleError.mockRestore();
  });

  it("does not roll back before game-scoped mutation succeeds", async () => {
    const client = createAuthenticatedClient();
    mockCreateClient.mockResolvedValue(client);
    mockCurrentRosterRefresh.mockRejectedValue(new Error("pre-mutation failure"));

    await POST(createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID }));

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not roll back or materialize historical games", async () => {
    const client = createAuthenticatedClient({
      game: {
        season_year: 1995,
        season_era_id: "jordan",
        status: "initializing",
        user_id: USER_ID,
      },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await POST(
      createRequest("POST", { gameId: GAME_ID, selectedTeamId: TEAM_ID })
    );

    expect(response.status).toBe(409);
    expect(mockMaterializeModernGameContracts).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("non-POST /api/roster-refresh", () => {
  it.each([
    ["GET", GET],
    ["PUT", PUT],
    ["DELETE", DELETE],
    ["PATCH", PATCH],
  ] as const)("returns 405 for %s", async (_method, handler) => {
    const response = await handler();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(405);
    expect(body.error).toBe("Method not allowed");
  });
});

describe("client bundle security", () => {
  it("does not include SUPABASE_SERVICE_ROLE_KEY in the browser Supabase client", () => {
    const clientSource = readFileSync(
      new URL("../../../infrastructure/supabase/client.ts", import.meta.url),
      "utf8"
    );
    const envSource = readFileSync(
      new URL("../../../infrastructure/supabase/env.ts", import.meta.url),
      "utf8"
    );

    expect(clientSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(envSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
