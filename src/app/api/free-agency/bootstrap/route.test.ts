import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/free-agency/bootstrap/route";

const { getUser, from, rpc, source } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  source: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("@/infrastructure/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ rpc }),
}));
vi.mock("@/infrastructure/freeAgency/nbaFreeAgentSource", () => ({
  fetchNbaFreeAgentTracker: source,
}));
const gameId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const request = (body: unknown = { gameId }) =>
  new Request("http://localhost/api/free-agency/bootstrap", {
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
const game = { id: gameId, status: "active", season_year: 2026, season_era_id: "modern" };

describe("initial market import boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    from.mockReset();
    source.mockResolvedValue({ seasonYear: 2026, players: [] });
    rpc.mockResolvedValue({ data: { enrolled_count: 3, skipped_count: 1 }, error: null });
  });

  it("imports an owned save through the server writer", async () => {
    const owned = row(game);
    from.mockReturnValueOnce(owned).mockReturnValueOnce(row(null));
    expect((await POST(request())).status).toBe(200);
    expect(owned.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(rpc).toHaveBeenCalledWith("import_initial_free_agents", {
      p_game_id: gameId,
      p_owner_id: ownerId,
      p_snapshot: await source.mock.results[0].value,
    });
  });

  it("returns the persisted import without fetching NBA or writing again", async () => {
    from
      .mockReturnValueOnce(row(game))
      .mockReturnValueOnce(row({ enrolled_count: 3, skipped_count: 1 }));
    const response = await POST(request());
    expect(await response.json()).toEqual({ enrolled_count: 3, skipped_count: 1 });
    expect(source).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects foreign and initializing saves before any provider access", async () => {
    from
      .mockReturnValueOnce(row(null))
      .mockReturnValueOnce(row({ ...game, status: "initializing" }));
    expect((await POST(request())).status).toBe(404);
    expect((await POST(request())).status).toBe(409);
    expect(source).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires authentication and a valid ID", async () => {
    expect((await POST(request({ gameId: "invalid" }))).status).toBe(400);
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("fails explicitly when import history cannot be read", async () => {
    from
      .mockReturnValueOnce(row(game))
      .mockReturnValueOnce(row(null, { message: "missing migration" }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(502);
      expect(source).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
