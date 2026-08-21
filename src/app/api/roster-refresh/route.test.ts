import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockCreateServiceRoleClient = createServiceRoleClient as unknown as ReturnType<typeof vi.fn>;
const mockCurrentRosterRefresh = currentRosterRefresh as unknown as ReturnType<typeof vi.fn>;

const USER_ID = "99999999-9999-4999-8999-999999999999";
const GAME_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

function createAuthenticatedClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
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
