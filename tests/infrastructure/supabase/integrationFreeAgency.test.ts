import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { FREE_AGENT_ID, FreeAgencyFixture } from "@/infrastructure/supabase/integrationFreeAgency";
import { TEST_FIXTURE, TEST_PROJECT_REF } from "@/infrastructure/supabase/integrationSafety";

const url = `https://${TEST_PROJECT_REF}.supabase.co`;
const gameId = "ae7fc204-f00c-4113-a7c5-438efa3d8ddd";

describe("free-agency fixture boundary", () => {
  it("tears down canonical children before the exact game and stops dependent deletes on failure", async () => {
    for (const fail of [false, true]) {
      const paths: string[] = [];
      const request = vi.fn<typeof fetch>(async (input, init) => {
        const target = new URL(String(input));
        paths.push(`${init?.method} ${target.pathname}`);
        if (fail && target.pathname.endsWith("/game_contract_provenance"))
          return new Response(JSON.stringify({ message: "synthetic failure" }), { status: 400 });
        return init?.method === "HEAD"
          ? new Response(null, { headers: { "content-range": "*/0" } })
          : new Response(null, { status: 204 });
      });
      const fixture = new FreeAgencyFixture(gameId);
      const client = createClient(url, "synthetic-key", {
        auth: { persistSession: false },
        global: { fetch: fixture.createFetch(url, () => {}, request, "admin") },
      });
      if (fail) {
        await expect(fixture.cleanupGame(client, client)).rejects.toThrow();
        expect(paths.some((path) => path === "DELETE /rest/v1/games")).toBe(false);
      } else {
        await fixture.cleanupGame(client, client);
        expect(paths.filter((path) => path.startsWith("DELETE"))).toEqual([
          "DELETE /rest/v1/game_contract_seasons",
          "DELETE /rest/v1/game_contract_provenance",
          "DELETE /rest/v1/game_contract_agreements",
          "DELETE /rest/v1/game_contract_identities",
          "DELETE /rest/v1/game_contract_materializations",
          "DELETE /rest/v1/games",
        ]);
        expect(paths[0]).toBe("PATCH /rest/v1/games");
      }
    }
  });
  it("builds 30 synthetic source payloads without real provider player identities", () => {
    const fixture = new FreeAgencyFixture(gameId);
    expect(fixture.snapshots).toHaveLength(30);
    expect(new Set(fixture.snapshots.map(({ identity }) => identity.team)).size).toBe(30);
    expect(fixture.snapshots.flatMap(({ snapshot }) => snapshot.contracts)).toHaveLength(31);
    expect(
      fixture.materializationInput().p_identity_crosswalk.map((row) => row.targetPlayerId)
    ).toEqual([...TEST_FIXTURE.playerIds]);
  });

  it("allows only owner-bound offer/advance and rejects internal resolvers and runtime writes", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const fixture = new FreeAgencyFixture(gameId);
    const owner = fixture.createFetch(url, () => {}, request, "owner");
    const body = { p_game_id: gameId, p_expected_date: "2026-10-01" };
    await owner(`${url}/rest/v1/rpc/advance_simulation_day`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    for (const role of ["admin", "reader"] as const) {
      await expect(
        fixture.createFetch(
          url,
          () => {},
          request,
          role
        )(`${url}/rest/v1/rpc/advance_simulation_day`, {
          method: "POST",
          body: JSON.stringify(body),
        })
      ).rejects.toThrow();
    }
    for (const [path, payload] of [
      ["rpc/advance_simulation_day", { ...body, p_game_id: TEST_FIXTURE.ownerId }],
      ["rpc/advance_simulation_day", { ...body, p_expected_date: "2026-10-02" }],
      ["rpc/resolve_due_free_agency_offers", { p_game_id: gameId }],
      ["game_runtime_contracts", { game_id: gameId, player_id: FREE_AGENT_ID }],
    ] as const) {
      await expect(
        owner(`${url}/rest/v1/${path}`, { method: "POST", body: JSON.stringify(payload) })
      ).rejects.toThrow();
    }
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("limits administrative status reset and child/game deletes to the run-created game", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const fixture = new FreeAgencyFixture(gameId);
    const admin = fixture.createFetch(url, () => {}, request, "admin");
    await admin(`${url}/rest/v1/games?id=eq.${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "initializing" }),
    });
    await admin(`${url}/rest/v1/game_contract_materializations?game_id=eq.${gameId}`, {
      method: "DELETE",
    });
    for (const destination of [
      `${url}/rest/v1/games`,
      `${url}/rest/v1/games?id=eq.${TEST_FIXTURE.ownerId}`,
      `${url}/rest/v1/games?id=eq.${gameId}&or=(id.not.is.null)`,
      `${url}/rest/v1/game_contract_materializations`,
    ]) {
      await expect(admin(destination, { method: "DELETE" })).rejects.toThrow();
    }
    await expect(
      fixture.createFetch(
        url,
        () => {},
        request,
        "owner"
      )(`${url}/rest/v1/games?id=eq.${gameId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "initializing" }),
      })
    ).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
