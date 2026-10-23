import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/player-attributes/bootstrap/route";

const { getUser, from, materialize, createServiceRoleClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  materialize: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("@/infrastructure/supabase/serviceRole", () => ({ createServiceRoleClient }));
vi.mock("@/application/ratings/materializeGamePlayerAttributes", () => ({
  materializeGamePlayerAttributes: materialize,
}));

const gameId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown = { gameId }) =>
  new Request("http://localhost/api/player-attributes/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

function row(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  return chain;
}

describe("player attribute bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    createServiceRoleClient.mockReturnValue({ rpc: vi.fn() });
    materialize.mockResolvedValue({
      status: "materialized",
      playerCount: 546,
      sourceVersionId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("requires an authenticated owner and a modern initializing game", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    from.mockReturnValue(row(null));
    expect((await POST(request())).status).toBe(404);
    from.mockReturnValue(
      row({ id: gameId, status: "active", season_year: 2026, season_era_id: "modern" })
    );
    expect((await POST(request())).status).toBe(409);
    expect(materialize).not.toHaveBeenCalled();
  });

  it("passes the authenticated owner and server service client to the materializer", async () => {
    const owned = row({
      id: gameId,
      status: "initializing",
      season_year: 2026,
      season_era_id: "modern",
    });
    from.mockReturnValue(owned);
    const serviceClient = { rpc: vi.fn() };
    createServiceRoleClient.mockReturnValue(serviceClient);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(owned.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(materialize).toHaveBeenCalledWith({
      gameId,
      ownerId,
      seasonYear: 2026,
      serviceClient,
    });
  });

  it("does not expose provider or database error details", async () => {
    from.mockReturnValue(
      row({ id: gameId, status: "initializing", season_year: 2026, season_era_id: "modern" })
    );
    materialize.mockRejectedValue(new Error("private NBA key and SQL payload"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Player attributes initialization failed" });
    } finally {
      log.mockRestore();
    }
  });
});
