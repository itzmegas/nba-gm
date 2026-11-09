import { describe, expect, it, vi } from "vitest";
import {
  createTestFetch,
  readIntegrationConfig,
  TEST_FIXTURE,
  TEST_PROJECT_REF,
} from "@/infrastructure/supabase/integrationSafety";

const url = `https://${TEST_PROJECT_REF}.supabase.co`;
const config = {
  TEST_SUPABASE_URL: url,
  TEST_PUBLISHABLE_KEY: "synthetic-publishable-key",
  TEST_SERVICE_ROLE_KEY: "synthetic-server-key",
};

describe("integration destination safety", () => {
  it("requires the exact approved TEST destination and explicit confirmation", () => {
    expect(readIntegrationConfig(config, TEST_PROJECT_REF).url).toBe(url);
    for (const confirmation of [undefined, "", "another-project"]) {
      expect(() => readIntegrationConfig(config, confirmation)).toThrow();
    }
    for (const destination of [
      "https://another-project.supabase.co",
      `${url}.example.com`,
      `${url}/rest/v1`,
      `${url}?target=other`,
      url.replace("https:", "http:"),
    ]) {
      expect(() =>
        readIntegrationConfig({ ...config, TEST_SUPABASE_URL: destination }, TEST_PROJECT_REF)
      ).toThrow();
    }
  });

  it("does not fall back to application keys and never exposes invalid values", () => {
    expect(() =>
      readIntegrationConfig({ NEXT_PUBLIC_SUPABASE_URL: url }, TEST_PROJECT_REF)
    ).toThrow();
    expect(() =>
      readIntegrationConfig({ ...config, TEST_SERVICE_ROLE_KEY: "" }, TEST_PROJECT_REF)
    ).toThrow("Invalid dedicated TEST configuration");
  });

  it("blocks wrong hosts, RPCs and unscoped deletions before fetch", async () => {
    const request = vi.fn<typeof fetch>();
    const safeFetch = createTestFetch(url, () => {}, request);
    for (const [destination, method] of [
      ["https://another-project.supabase.co/rest/v1/teams", "GET"],
      [`${url}/rest/v1/rpc/execute_trade_transactional`, "POST"],
      [`${url}/rest/v1/teams`, "DELETE"],
      [`${url}/rest/v1/draft_picks`, "DELETE"],
      [`${url}/rest/v1/games`, "DELETE"],
      [`${url}/auth/v1/admin/users/00000000-0000-4000-8000-000000000000`, "DELETE"],
      [`${url}/rest/v1/teams`, "PATCH"],
      [`${url}/rest/v1/draft_picks?original_team_id=eq.${TEST_FIXTURE.teamId}`, "DELETE"],
      [`${url}/rest/v1/teams?id=eq.another-team`, "DELETE"],
      [`${url}/auth/v1/admin/users`, "GET"],
      [`${url.replace("https://", "https://unexpected:secret@")}/rest/v1/teams`, "GET"],
    ]) {
      await expect(safeFetch(destination, { method })).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("allows roster-state deletion only for the confirmed game and both fixture players", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const admin = createTestFetch(
      url,
      () => {},
      request,
      "admin",
      "ae7fc204-f00c-4113-a7c5-438efa3d8ddd"
    );
    const owner = createTestFetch(url, () => {}, request, "owner");
    const states = `${url}/rest/v1/game_player_states`;
    const exact = `${states}?game_id=eq.ae7fc204-f00c-4113-a7c5-438efa3d8ddd&player_id=in.(${TEST_FIXTURE.playerIds.join(",")})`;

    await admin(exact, { method: "DELETE" });
    for (const target of [
      `${states}?game_id=eq.11111111-1111-4111-8111-111111111111&player_id=in.(${TEST_FIXTURE.playerIds.join(",")})`,
      `${states}?game_id=eq.ae7fc204-f00c-4113-a7c5-438efa3d8ddd&player_id=eq.${TEST_FIXTURE.playerIds[0]}`,
      `${states}?game_id=eq.ae7fc204-f00c-4113-a7c5-438efa3d8ddd`,
    ]) {
      await expect(admin(target, { method: "DELETE" })).rejects.toThrow();
    }
    await expect(owner(exact, { method: "DELETE" })).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("allows canonical cleanup only for both fixed fixture rows in the confirmed game", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const safeFetch = createTestFetch(
      url,
      () => {},
      request,
      "admin",
      "ae7fc204-f00c-4113-a7c5-438efa3d8ddd"
    );
    const game = "ae7fc204-f00c-4113-a7c5-438efa3d8ddd";
    const agreements = TEST_FIXTURE.agreementIds.join(",");
    const players = TEST_FIXTURE.playerIds.join(",");
    for (const target of [
      `${url}/rest/v1/game_contract_seasons?game_id=eq.${game}&agreement_id=in.(${agreements})`,
      `${url}/rest/v1/game_contract_agreements?game_id=eq.${game}&id=in.(${agreements})`,
      `${url}/rest/v1/game_contract_identities?game_id=eq.${game}&player_id=in.(${players})`,
    ]) {
      await safeFetch(target, { method: "DELETE" });
    }
    for (const target of [
      `${url}/rest/v1/game_contract_seasons?game_id=eq.${game}&agreement_id=eq.${TEST_FIXTURE.agreementIds[0]}`,
      `${url}/rest/v1/game_contract_agreements?game_id=eq.11111111-1111-4111-8111-111111111111&id=in.(${agreements})`,
      `${url}/rest/v1/game_contract_identities?game_id=eq.${game}&player_id=in.(${players}),00000000-0000-4000-8000-000000000009`,
    ]) {
      await expect(safeFetch(target, { method: "DELETE" })).rejects.toThrow();
    }
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("allows deleting both fixture players together but rejects partial or foreign batches", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const safeFetch = createTestFetch(url, () => {}, request, "admin");
    await safeFetch(`${url}/rest/v1/players?id=in.(${TEST_FIXTURE.playerIds.join(",")})`, {
      method: "DELETE",
    });
    for (const target of [
      `${url}/rest/v1/players?id=in.(${TEST_FIXTURE.playerIds[0]})`,
      `${url}/rest/v1/players?id=in.(${TEST_FIXTURE.playerIds.join(",")},00000000-0000-4000-8000-000000000009)`,
    ]) {
      await expect(safeFetch(target, { method: "DELETE" })).rejects.toThrow();
    }
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("forces redirect rejection and logs only method, path and status", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const reports: string[] = [];
    const safeFetch = createTestFetch(url, (line) => reports.push(line), request);
    await safeFetch(`${url}/rest/v1/teams?id=eq.synthetic`, { redirect: "follow" });
    expect(request).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) })
    );
    expect(reports).toEqual(["HTTP GET /rest/v1/teams 200"]);
    await safeFetch(`${url}/rest/v1/teams?id=eq.${TEST_FIXTURE.teamId}`, { method: "DELETE" });
    await safeFetch(`${url}/auth/v1/admin/users/${TEST_FIXTURE.ownerId}`, { method: "DELETE" });
    await safeFetch(
      `${url}/rest/v1/draft_picks?original_team_id=eq.${TEST_FIXTURE.teamId}&draft_year=gte.2026&draft_year=lte.2032`,
      { method: "DELETE" }
    );
    await safeFetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST" });
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("logs only a validated database error code, never the response message", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { code: "23503", message: "sensitive player and game details" },
          { status: 400 }
        )
      );
    const reports: string[] = [];
    const safeFetch = createTestFetch(url, (line) => reports.push(line), request);
    await safeFetch(`${url}/rest/v1/game_player_states`, {
      method: "POST",
      body: JSON.stringify({
        game_id: "11111111-1111-4111-8111-111111111111",
        player_id: TEST_FIXTURE.playerIds[0],
        team_id: TEST_FIXTURE.teamId,
      }),
    });
    expect(reports).toEqual(["HTTP POST /rest/v1/game_player_states 400", "HTTP error code 23503"]);
    expect(reports.join(" ")).not.toContain("sensitive");
  });

  it("uses table HEAD for PostgREST health and refuses the unnecessary OpenAPI root", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const safeFetch = createTestFetch(url, () => {}, request);
    await safeFetch(`${url}/rest/v1/teams?select=id`, { method: "HEAD" });
    await expect(safeFetch(`${url}/rest/v1/`)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("expanded roster and contract fixture safety", () => {
  const [playerOne, playerTwo] = TEST_FIXTURE.playerIds;
  const [agreementOne, agreementTwo] = TEST_FIXTURE.agreementIds;
  const gameId = "11111111-1111-4111-8111-111111111111";
  const foreignPlayer = "00000000-0000-4000-8000-000000000009";
  const foreignTeam = "00000000-0000-4000-8000-000000000008";
  const foreignAgreement = "00000000-0000-4000-8000-000000000007";

  it("binds cleanup to the current run rather than a historical game", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const bound = createTestFetch(url, () => {}, request, "admin", gameId);
    const unbound = createTestFetch(url, () => {}, request, "admin");
    const target = `${url}/rest/v1/game_player_states?game_id=eq.${gameId}&player_id=in.(${TEST_FIXTURE.playerIds.join(",")})`;
    await bound(target, { method: "DELETE" });
    await expect(unbound(target, { method: "DELETE" })).rejects.toThrow();
    await expect(
      bound(target.replace(gameId, "ae7fc204-f00c-4113-a7c5-438efa3d8ddd"), { method: "DELETE" })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });

  const post = (safeFetch: ReturnType<typeof createTestFetch>, table: string, body: unknown) =>
    safeFetch(`${url}/rest/v1/${table}`, { method: "POST", body: JSON.stringify(body) });

  const validAgreement = (playerId: string, agreementId: string) => ({
    id: agreementId,
    game_id: gameId,
    player_id: playerId,
    team_id: TEST_FIXTURE.teamId,
    contract_type: "standard",
    provenance_quality: "observed",
    source_method: "basketball-reference-current-salary",
    estimated: false,
    cap_treatment: "standard-cap-and-matching",
  });

  it("rejects insert bodies outside the synthetic fixture identities before fetch", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 201 }));
    const admin = createTestFetch(url, () => {}, request);
    const owner = createTestFetch(url, () => {}, request, "owner");
    await post(admin, "teams", { id: TEST_FIXTURE.teamId, nba_id: -900001 });
    await post(admin, "players", { id: playerOne, first_name: "Phase One", is_active: true });
    await post(owner, "games", { user_id: TEST_FIXTURE.ownerId });
    await post(admin, "game_player_states", {
      game_id: gameId,
      player_id: playerTwo,
      team_id: TEST_FIXTURE.teamId,
      morale: 50,
    });
    await post(admin, "game_contract_identities", {
      game_id: gameId,
      player_id: playerOne,
      team_id: TEST_FIXTURE.teamId,
      resolution_status: "observed-standard",
      cap_treatment: "standard-cap-and-matching",
    });
    await post(admin, "game_contract_agreements", validAgreement(playerOne, agreementOne));
    await post(admin, "game_contract_seasons", {
      agreement_id: agreementOne,
      game_id: gameId,
      season_label: "2026-27",
      start_year: 2026,
      end_year: 2027,
      salary_amount: 1_000_000,
      option_kind: "none",
      guarantee_kind: "guaranteed",
    });
    // Route each rejection to the role allowed to write that table so only the
    // body identity, not the route, is what fails.
    for (const [table, body] of [
      ["teams", { id: TEST_FIXTURE.teamId, nba_id: -900002 }],
      ["teams", { id: foreignTeam, nba_id: -900001 }],
      ["players", { id: playerOne, nba_id: 123456 }],
      ["players", { id: playerOne, espn_id: 789 }],
      ["players", { id: foreignPlayer }],
      ["games", { user_id: TEST_FIXTURE.otherId }],
      [
        "game_player_states",
        { game_id: gameId, player_id: foreignPlayer, team_id: TEST_FIXTURE.teamId },
      ],
      ["game_player_states", { game_id: gameId, player_id: playerOne, team_id: foreignTeam }],
      ["game_player_states", { game_id: gameId, player_id: playerOne }],
      ["game_contract_identities", { game_id: gameId, player_id: playerOne, team_id: foreignTeam }],
      ["game_contract_agreements", validAgreement(foreignPlayer, agreementOne)],
      ["game_contract_agreements", validAgreement(playerOne, foreignAgreement)],
      ["game_contract_seasons", { agreement_id: foreignAgreement, game_id: gameId }],
      ["game_contract_seasons", { agreement_id: agreementOne, game_id: "not-a-uuid" }],
      ["game_runtime_contracts", { game_id: gameId, player_id: foreignPlayer }],
    ] as const) {
      const writer = table === "games" ? owner : admin;
      await expect(post(writer, table, body)).rejects.toThrow();
    }
    expect(request).toHaveBeenCalledTimes(7);
  });

  it("splits write routes by session role", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 201 }));
    const admin = createTestFetch(url, () => {}, request, "admin");
    const owner = createTestFetch(url, () => {}, request, "owner");
    const reader = createTestFetch(url, () => {}, request, "reader");
    await post(owner, "games", { user_id: TEST_FIXTURE.ownerId });
    await post(admin, "game_player_states", {
      game_id: gameId,
      player_id: playerOne,
      team_id: TEST_FIXTURE.teamId,
    });
    await post(admin, "teams", { id: TEST_FIXTURE.teamId, nba_id: -900001 });
    await post(admin, "game_contract_agreements", validAgreement(playerOne, agreementTwo));
    await reader(`${url}/auth/v1/token?grant_type=password`, { method: "POST", body: "{}" });
    await expect(
      post(owner, "teams", { id: TEST_FIXTURE.teamId, nba_id: -900001 })
    ).rejects.toThrow();
    await expect(
      post(owner, "game_contract_agreements", validAgreement(playerOne, agreementOne))
    ).rejects.toThrow();
    await expect(
      post(owner, "game_player_states", {
        game_id: gameId,
        player_id: playerOne,
        team_id: TEST_FIXTURE.teamId,
      })
    ).rejects.toThrow();
    await expect(
      post(admin, "game_runtime_contracts", {
        game_id: gameId,
        player_id: playerTwo,
        origin_kind: "simulated-agreement",
        annual_salary: 3_000_000,
      })
    ).rejects.toThrow();
    await expect(post(admin, "games", { user_id: TEST_FIXTURE.ownerId })).rejects.toThrow();
    await expect(post(reader, "games", { user_id: TEST_FIXTURE.ownerId })).rejects.toThrow();
    await expect(
      post(reader, "game_player_states", {
        game_id: gameId,
        player_id: playerOne,
        team_id: TEST_FIXTURE.teamId,
      })
    ).rejects.toThrow();
    await expect(
      owner(`${url}/auth/v1/admin/users/${TEST_FIXTURE.ownerId}`, { method: "DELETE" })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(5);
  });

  it("reads contract evidence relations and scopes player cleanup", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const safeFetch = createTestFetch(url, () => {}, request);
    for (const table of [
      "players",
      "game_player_states",
      "game_contract_identities",
      "game_contract_agreements",
      "game_contract_seasons",
      "game_runtime_contracts",
      "game_active_runtime_contracts",
      "contracts",
    ]) {
      await safeFetch(`${url}/rest/v1/${table}?select=id&game_id=eq.${gameId}`, { method: "GET" });
    }
    await safeFetch(`${url}/rest/v1/players?id=eq.${playerOne}`, { method: "DELETE" });
    await safeFetch(`${url}/rest/v1/players?id=eq.${playerTwo}`, { method: "DELETE" });
    await expect(
      safeFetch(`${url}/rest/v1/players?id=eq.${foreignPlayer}`, { method: "DELETE" })
    ).rejects.toThrow();
    await expect(safeFetch(`${url}/rest/v1/players`, { method: "DELETE" })).rejects.toThrow();
    await expect(
      safeFetch(`${url}/rest/v1/players?id=eq.${playerOne}`, { method: "PATCH" })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(10);
  });
});
