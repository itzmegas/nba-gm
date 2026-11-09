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

  it("uses table HEAD for PostgREST health and refuses the unnecessary OpenAPI root", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const safeFetch = createTestFetch(url, () => {}, request);
    await safeFetch(`${url}/rest/v1/teams?select=id`, { method: "HEAD" });
    await expect(safeFetch(`${url}/rest/v1/`)).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
