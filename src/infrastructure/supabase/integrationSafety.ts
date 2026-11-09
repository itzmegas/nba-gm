import { z } from "zod";

export const TEST_PROJECT_REF = "wmtezjoitjmjynyvkyke";
const testUrl = `https://${TEST_PROJECT_REF}.supabase.co`;

export const TEST_FIXTURE = {
  ownerId: "f1000000-0000-4000-8000-000000000001",
  otherId: "f1000000-0000-4000-8000-000000000002",
  teamId: "f2000000-0000-4000-8000-000000000001",
  seasonYear: 2026,
  playerIds: ["f3000000-0000-4000-8000-000000000001", "f3000000-0000-4000-8000-000000000002"],
  agreementIds: ["f4000000-0000-4000-8000-000000000001", "f4000000-0000-4000-8000-000000000002"],
} as const;

export type IntegrationRole = "admin" | "owner" | "reader";

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

const READ_TABLES = [
  "teams",
  "games",
  "draft_picks",
  "game_pick_inventory",
  "players",
  "contracts",
  "game_player_states",
  "game_contract_identities",
  "game_contract_agreements",
  "game_contract_seasons",
  "game_runtime_contracts",
  "game_active_runtime_contracts",
];

// Canonical contract fixtures have no authenticated INSERT policy; only the
// server-side admin session may set them up. Owner writes stay on games/roster.
const INSERT_TABLES_BY_ROLE: Record<IntegrationRole, readonly string[]> = {
  admin: [
    "teams",
    "players",
    "game_contract_identities",
    "game_contract_agreements",
    "game_contract_seasons",
    "game_runtime_contracts",
  ],
  owner: ["games", "game_player_states"],
  reader: [],
};

const isFixturePlayer = (value: unknown) =>
  TEST_FIXTURE.playerIds.some((playerId) => playerId === value);
const isFixtureAgreement = (value: unknown) =>
  TEST_FIXTURE.agreementIds.some((agreementId) => agreementId === value);

// Insert bodies must stay inside the synthetic fixture identities: no real NBA
// or ESPN ids, no foreign players/agreements/teams, and a UUID game reference.
function fixtureBodyViolation(table: string, body: unknown): boolean {
  if (typeof body !== "string") return true;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return true;
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.some((row) => {
    if (typeof row !== "object" || row === null) return true;
    const insert = row as Record<string, unknown>;
    const gameUuid = z.uuid().safeParse(insert.game_id);
    switch (table) {
      case "teams":
        return insert.id !== TEST_FIXTURE.teamId || insert.nba_id !== -900001;
      case "games":
        return insert.user_id !== TEST_FIXTURE.ownerId;
      case "players":
        return (
          !isFixturePlayer(insert.id) ||
          (insert.nba_id ?? null) !== null ||
          (insert.espn_id ?? null) !== null
        );
      case "game_player_states":
      case "game_contract_identities":
        return (
          !isFixturePlayer(insert.player_id) ||
          insert.team_id !== TEST_FIXTURE.teamId ||
          !gameUuid.success
        );
      case "game_contract_agreements":
        return (
          !isFixtureAgreement(insert.id) ||
          !isFixturePlayer(insert.player_id) ||
          insert.team_id !== TEST_FIXTURE.teamId ||
          !gameUuid.success
        );
      case "game_contract_seasons":
        return !isFixtureAgreement(insert.agreement_id) || !gameUuid.success;
      case "game_runtime_contracts":
        return !isFixturePlayer(insert.player_id) || !gameUuid.success;
      default:
        return true;
    }
  });
}

export function createTestFetch(
  url: string,
  report: (line: string) => void,
  request: typeof fetch = fetch,
  role: IntegrationRole = "admin"
) {
  if (url !== testUrl) throw new Error("Unexpected TEST destination");
  return async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const path = target.pathname;
    const table = READ_TABLES.find((name) => path === `/rest/v1/${name}`);
    const userPath = [TEST_FIXTURE.ownerId, TEST_FIXTURE.otherId].some(
      (id) => path === `/auth/v1/admin/users/${id}`
    );
    const read =
      (method === "GET" || method === "HEAD") &&
      (table !== undefined || (method === "GET" && path === "/auth/v1/health"));
    const auth =
      (method === "POST" && path === "/auth/v1/token") ||
      (role === "admin" &&
        ((userPath && ["GET", "DELETE"].includes(method)) ||
          (method === "POST" && path === "/auth/v1/admin/users")));
    const insert =
      method === "POST" &&
      table !== undefined &&
      INSERT_TABLES_BY_ROLE[role].includes(table) &&
      !fixtureBodyViolation(table, init?.body);
    const deleteTeam =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/teams" &&
      target.searchParams.get("id") === `eq.${TEST_FIXTURE.teamId}`;
    const deletePicks =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/draft_picks" &&
      target.searchParams.get("original_team_id") === `eq.${TEST_FIXTURE.teamId}` &&
      target.searchParams.getAll("draft_year").sort().join(",") === "gte.2026,lte.2032";
    const deletePlayer =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/players" &&
      TEST_FIXTURE.playerIds.some((id) => target.searchParams.get("id") === `eq.${id}`);
    if (
      target.origin !== url ||
      target.username ||
      target.password ||
      target.hash ||
      !(read || auth || insert || deleteTeam || deletePicks || deletePlayer)
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
