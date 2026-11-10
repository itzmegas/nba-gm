import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/games/[gameId]/trades/route";

const client = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({ createClient: async () => client }));
const gameId = "a0000000-0000-4000-8000-000000000001";
const teamAId = "a1000000-0000-4000-8000-000000000001";
const teamBId = "a1000000-0000-4000-8000-000000000002";
const body = {
  teamAId,
  teamBId,
  assets: [
    { assetType: "pick", assetId: teamAId, fromTeamId: teamAId },
    { assetType: "pick", assetId: teamBId, fromTeamId: teamBId },
  ],
};
const context = { params: Promise.resolve({ gameId }) };
function request(value: unknown = body, origin = "http://localhost") {
  return new Request(`http://localhost/api/games/${gameId}/trades`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(value),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: teamAId } }, error: null });
  client.rpc.mockResolvedValue({ data: gameId, error: null });
});

it("authenticates and calls the transaction once without payload identity or a history read", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, tradeId: gameId });
  expect(client.auth.getUser).toHaveBeenCalledOnce();
  expect(client.rpc).toHaveBeenCalledExactlyOnceWith("execute_trade_authoritative", {
    p_game_id: gameId,
    p_team_a_id: teamAId,
    p_team_b_id: teamBId,
    p_assets: body.assets.map(({ assetType, assetId, fromTeamId }) => ({
      asset_type: assetType,
      asset_id: assetId,
      from_team_id: fromTeamId,
    })),
  });
});

it("rejects missing authentication before any transaction", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await POST(request(), context);
  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe("UNAUTHORIZED");
  expect(client.rpc).not.toHaveBeenCalled();
});

it("does not trust a returned user when session verification reports an error", async () => {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: teamAId } },
    error: { message: "expired" },
  });
  const response = await POST(request(), context);
  expect(response.status).toBe(401);
  expect(client.rpc).not.toHaveBeenCalled();
});

it.each([
  [],
  [body.assets[0]],
  [...body.assets, body.assets[0]],
  Array.from({ length: 101 }, (_, index) => ({
    ...body.assets[index % 2],
    assetId: `a6000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  })),
])("rejects boundary asset lists without mutation", async (assets) => {
  const response = await POST(request({ ...body, assets }), context);
  expect(response.status).toBe(400);
  expect(client.rpc).not.toHaveBeenCalled();
});

it("rejects cross-origin requests and forged identity without mutation", async () => {
  expect((await POST(request(body, "https://attacker.invalid"), context)).status).toBe(403);
  expect((await POST(request({ ...body, userId: teamAId }), context)).status).toBe(400);
  expect(client.rpc).not.toHaveBeenCalled();
});

it("rejects invalid JSON", async () => {
  const response = await POST(
    new Request("http://localhost", { method: "POST", body: "{" }),
    context
  );
  expect(response.status).toBe(400);
  expect(client.rpc).not.toHaveBeenCalled();
});

it.each([
  ["P2003", "GAME_NOT_FOUND", 404],
  ["P2004", "GAME_NOT_ACTIVE", 409],
  ["P2006", "STALE_ASSET", 409],
  ["P2007", "HARD_CAP_UNKNOWN", 422],
  ["42501", "TRADE_UNAVAILABLE", 503],
  ["PGRST202", "TRADE_UNAVAILABLE", 503],
  ["P2001", "INVALID_REQUEST", 400],
  ["P2002", "UNAUTHORIZED", 401],
  ["P2005", "INVALID_TEAMS", 422],
  ["unknown", "TRADE_FAILED", 500],
])("maps %s without leaking database diagnostics", async (code, expected, status) => {
  client.rpc.mockResolvedValue({ data: null, error: { code, message: "private database detail" } });
  const response = await POST(request(), context);
  expect(response.status).toBe(status);
  const result = await response.json();
  expect(result.code).toBe(expected);
  expect(JSON.stringify(result)).not.toContain("private database detail");
  expect(client.rpc).toHaveBeenCalledOnce();
});
