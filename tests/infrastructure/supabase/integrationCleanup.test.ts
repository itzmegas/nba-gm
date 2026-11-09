import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  cleanupTestGameRows,
  cleanupTestTrade,
} from "@/infrastructure/supabase/integrationCleanup";
import { createTestFetch, TEST_PROJECT_REF } from "@/infrastructure/supabase/integrationSafety";

const url = `https://${TEST_PROJECT_REF}.supabase.co`;
const gameId = "11111111-1111-4111-8111-111111111111";

describe("fixture cleanup dependency order", () => {
  for (const failAt of [-1, 0, 1, 2, 3]) {
    it(`cleans trade snapshots before history, stopping at ${failAt}`, async () => {
      const tradeId = "f6000000-0000-4000-8000-000000000001";
      const calls: string[] = [];
      const request: typeof fetch = async (input, init) => {
        const target = new URL(String(input));
        calls.push(`${init?.method} ${target.pathname.split("/").at(-1)}`);
        const failed = calls.length - 1 === failAt;
        return new Response(null, {
          status: failed && init?.method === "DELETE" ? 409 : init?.method === "DELETE" ? 204 : 200,
          headers: { "content-range": failed ? "*/1" : "*/0" },
        });
      };
      const client = createClient(url, "synthetic-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: createTestFetch(url, () => {}, request, "admin", gameId, tradeId) },
      });
      if (failAt < 0) await cleanupTestTrade(client, gameId, tradeId);
      else await expect(cleanupTestTrade(client, gameId, tradeId)).rejects.toThrow();
      expect(calls).toEqual(
        [
          "DELETE trade_asset_snapshots",
          "HEAD trade_asset_snapshots",
          "DELETE executed_trades",
          "HEAD executed_trades",
        ].slice(0, failAt < 0 ? 4 : failAt + 1)
      );
    });
  }
  for (const failure of [undefined, "delete", "count", "missing-count", "head-error"] as const) {
    it(`removes children first and stops on ${failure ?? "no failure"}`, async () => {
      const calls: string[] = [];
      const request: typeof fetch = async (input, init) => {
        const target = new URL(String(input));
        calls.push(`${init?.method} ${target.pathname.split("/").at(-1)}`);
        expect(target.searchParams.get("game_id")).toBe(`eq.${gameId}`);
        if (failure === "delete") return Response.json({ code: "23503" }, { status: 409 });
        if (failure === "head-error" && init?.method === "HEAD")
          return new Response(null, { status: 403 });
        return new Response(null, {
          status: init?.method === "DELETE" ? 204 : 200,
          headers:
            failure === "missing-count"
              ? {}
              : { "content-range": failure === "count" ? "*/1" : "*/0" },
        });
      };
      const client = createClient(url, "synthetic-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: createTestFetch(url, () => {}, request, "admin", gameId) },
      });
      if (failure) {
        await expect(cleanupTestGameRows(client, gameId)).rejects.toThrow();
        expect(calls).toHaveLength(failure === "delete" ? 1 : 2);
      } else {
        await cleanupTestGameRows(client, gameId);
        expect(calls).toEqual(
          [
            "game_contract_seasons",
            "game_contract_agreements",
            "game_contract_identities",
            "game_player_states",
          ].flatMap((table) => [`DELETE ${table}`, `HEAD ${table}`])
        );
      }
    });
  }
});
