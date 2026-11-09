import { z } from "zod";

export const TEST_PROJECT_REF = "wmtezjoitjmjynyvkyke";
const testUrl = `https://${TEST_PROJECT_REF}.supabase.co`;

export const TEST_FIXTURE = {
  ownerId: "f1000000-0000-4000-8000-000000000001",
  otherId: "f1000000-0000-4000-8000-000000000002",
  teamId: "f2000000-0000-4000-8000-000000000001",
  otherTeamId: "f2000000-0000-4000-8000-000000000002",
  absentPickId: "f5000000-0000-4000-8000-000000000001",
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
  "executed_trades",
  "trade_asset_snapshots",
  "contract_source_snapshot_versions",
  "current_contract_source_snapshots",
  "game_contract_materializations",
  "game_contract_provenance",
  "free_agency_availability_enrollments",
  "free_agency_pending_offers",
];

// Canonical contract fixtures have no authenticated INSERT policy; only the
// server-side admin session may set them up. Owner writes stay on games/roster.
const INSERT_TABLES_BY_ROLE: Record<IntegrationRole, readonly string[]> = {
  admin: [
    "teams",
    "players",
    "game_player_states",
    "game_contract_identities",
    "game_contract_agreements",
    "game_contract_seasons",
  ],
  owner: ["games"],
  reader: [],
};

const isFixturePlayer = (value: unknown) =>
  TEST_FIXTURE.playerIds.some((playerId) => playerId === value);
const isFixtureAgreement = (value: unknown) =>
  TEST_FIXTURE.agreementIds.some((agreementId) => agreementId === value);
const isFixtureTeam = (value: unknown) =>
  value === TEST_FIXTURE.teamId || value === TEST_FIXTURE.otherTeamId;

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
        return !(
          (insert.id === TEST_FIXTURE.teamId && insert.nba_id === -900001) ||
          (insert.id === TEST_FIXTURE.otherTeamId && insert.nba_id === -900002)
        );
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
          !isFixturePlayer(insert.player_id) || !isFixtureTeam(insert.team_id) || !gameUuid.success
        );
      case "game_contract_agreements":
        return (
          !isFixtureAgreement(insert.id) ||
          !isFixturePlayer(insert.player_id) ||
          !isFixtureTeam(insert.team_id) ||
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
  role: IntegrationRole = "admin",
  cleanupGameId?: string,
  cleanupTradeId?: string
) {
  if (url !== testUrl) throw new Error("Unexpected TEST destination");
  if (cleanupGameId !== undefined && !z.uuid().safeParse(cleanupGameId).success) {
    throw new Error("Invalid cleanup game binding");
  }
  if (
    cleanupTradeId !== undefined &&
    (!cleanupGameId || !z.uuid().safeParse(cleanupTradeId).success)
  ) {
    throw new Error("Invalid cleanup trade binding");
  }
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
    let trade = false;
    if (
      role === "owner" &&
      cleanupGameId &&
      method === "POST" &&
      path === "/rest/v1/rpc/execute_trade_transactional" &&
      typeof init?.body === "string"
    ) {
      try {
        const parsed = z
          .strictObject({
            p_game_id: z.literal(cleanupGameId),
            p_team_a_id: z.literal(TEST_FIXTURE.teamId),
            p_team_b_id: z.literal(TEST_FIXTURE.otherTeamId),
            p_assets: z
              .array(
                z.strictObject({
                  asset_type: z.enum(["player", "pick"]),
                  asset_id: z.uuid(),
                  from_team_id: z.enum([TEST_FIXTURE.teamId, TEST_FIXTURE.otherTeamId]),
                })
              )
              .length(2),
          })
          .parse(JSON.parse(init.body));
        trade =
          parsed.p_assets.every((asset) =>
            asset.asset_type === "player"
              ? isFixturePlayer(asset.asset_id)
              : asset.asset_id === TEST_FIXTURE.absentPickId
          ) &&
          new Set(parsed.p_assets.map((asset) => asset.from_team_id)).size === 2 &&
          new Set(parsed.p_assets.map((asset) => asset.asset_id)).size === 2;
      } catch {
        trade = false;
      }
    }
    const deleteTeam =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/teams" &&
      [TEST_FIXTURE.teamId, TEST_FIXTURE.otherTeamId].some(
        (id) => target.searchParams.get("id") === `eq.${id}`
      );
    const deletePicks =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/draft_picks" &&
      [TEST_FIXTURE.teamId, TEST_FIXTURE.otherTeamId].some(
        (id) => target.searchParams.get("original_team_id") === `eq.${id}`
      ) &&
      target.searchParams.getAll("draft_year").sort().join(",") === "gte.2026,lte.2032";
    const deletePlayer =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/players" &&
      (TEST_FIXTURE.playerIds.some((id) => target.searchParams.get("id") === `eq.${id}`) ||
        target.searchParams.get("id") === `in.(${TEST_FIXTURE.playerIds.join(",")})`);
    const deleteRosterStates =
      role === "admin" &&
      method === "DELETE" &&
      path === "/rest/v1/game_player_states" &&
      cleanupGameId !== undefined &&
      target.searchParams.get("game_id") === `eq.${cleanupGameId}` &&
      target.searchParams.get("player_id") === `in.(${TEST_FIXTURE.playerIds.join(",")})`;
    const deleteCanonicalRows =
      role === "admin" &&
      method === "DELETE" &&
      cleanupGameId !== undefined &&
      target.searchParams.get("game_id") === `eq.${cleanupGameId}` &&
      ((path === "/rest/v1/game_contract_seasons" &&
        target.searchParams.get("agreement_id") ===
          `in.(${TEST_FIXTURE.agreementIds.join(",")})`) ||
        (path === "/rest/v1/game_contract_agreements" &&
          target.searchParams.get("id") === `in.(${TEST_FIXTURE.agreementIds.join(",")})`) ||
        (path === "/rest/v1/game_contract_identities" &&
          target.searchParams.get("player_id") === `in.(${TEST_FIXTURE.playerIds.join(",")})`));
    const deleteTrade =
      role === "admin" &&
      method === "DELETE" &&
      cleanupTradeId !== undefined &&
      ((path === "/rest/v1/trade_asset_snapshots" &&
        target.searchParams.get("executed_trade_id") === `eq.${cleanupTradeId}`) ||
        (path === "/rest/v1/executed_trades" &&
          target.searchParams.get("id") === `eq.${cleanupTradeId}` &&
          target.searchParams.get("game_id") === `eq.${cleanupGameId}`));
    if (
      target.origin !== url ||
      target.username ||
      target.password ||
      target.hash ||
      !(
        read ||
        auth ||
        insert ||
        trade ||
        deleteTrade ||
        deleteTeam ||
        deletePicks ||
        deletePlayer ||
        deleteRosterStates ||
        deleteCanonicalRows
      )
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
    if (!response.ok) {
      const payload: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      const code =
        typeof payload === "object" && payload !== null && "code" in payload
          ? (payload as { code?: unknown }).code
          : undefined;
      if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)) {
        report(`HTTP error code ${code}`);
      }
    }
    return response;
  };
}
