import { z } from "zod";

export const TEST_PROJECT_REF = "wmtezjoitjmjynyvkyke";
const testUrl = `https://${TEST_PROJECT_REF}.supabase.co`;

export const TEST_FIXTURE = {
  ownerId: "f1000000-0000-4000-8000-000000000001",
  otherId: "f1000000-0000-4000-8000-000000000002",
  teamId: "f2000000-0000-4000-8000-000000000001",
  seasonYear: 2026,
} as const;

const configSchema = z.strictObject({
  TEST_SUPABASE_URL: z.literal(testUrl),
  TEST_PUBLISHABLE_KEY: z.string().min(1),
  TEST_SERVICE_ROLE_KEY: z.string().min(1),
});

export function readIntegrationConfig(input: unknown, confirmation: string | undefined) {
  if (confirmation !== TEST_PROJECT_REF) throw new Error("Explicit TEST confirmation is required");
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid dedicated TEST configuration");
  return {
    url: parsed.data.TEST_SUPABASE_URL,
    publishableKey: parsed.data.TEST_PUBLISHABLE_KEY,
    serviceRoleKey: parsed.data.TEST_SERVICE_ROLE_KEY,
  };
}

export function createTestFetch(
  url: string,
  report: (line: string) => void,
  request: typeof fetch = fetch
) {
  if (url !== testUrl) throw new Error("Unexpected TEST destination");
  return async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const path = target.pathname;
    const userPath = [TEST_FIXTURE.ownerId, TEST_FIXTURE.otherId].some(
      (id) => path === `/auth/v1/admin/users/${id}`
    );
    const tablePath = ["teams", "games", "draft_picks", "game_pick_inventory"].some(
      (table) => path === `/rest/v1/${table}`
    );
    const read =
      (method === "GET" || method === "HEAD") &&
      (tablePath || (method === "GET" && path === "/auth/v1/health"));
    const auth =
      (userPath && ["GET", "DELETE"].includes(method)) ||
      (method === "POST" && ["/auth/v1/admin/users", "/auth/v1/token"].includes(path));
    const insert = method === "POST" && ["/rest/v1/teams", "/rest/v1/games"].includes(path);
    const deleteTeam =
      method === "DELETE" &&
      path === "/rest/v1/teams" &&
      target.searchParams.get("id") === `eq.${TEST_FIXTURE.teamId}`;
    const deletePicks =
      method === "DELETE" &&
      path === "/rest/v1/draft_picks" &&
      target.searchParams.get("original_team_id") === `eq.${TEST_FIXTURE.teamId}` &&
      target.searchParams.getAll("draft_year").sort().join(",") === "gte.2026,lte.2032";
    if (
      target.origin !== url ||
      target.username ||
      target.password ||
      target.hash ||
      !(read || auth || insert || deleteTeam || deletePicks)
    ) {
      throw new Error("Request is outside the authorized TEST fixture scope");
    }
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const response = await request(input, {
      ...init,
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
    report(`HTTP ${method} ${path} ${response.status}`);
    return response;
  };
}
