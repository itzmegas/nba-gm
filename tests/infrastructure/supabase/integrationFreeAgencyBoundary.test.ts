import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  FREE_AGENCY_TABLES,
  FreeAgencyFixture,
} from "@/infrastructure/supabase/integrationFreeAgency";
import { TEST_PROJECT_REF } from "@/infrastructure/supabase/integrationSafety";

const url = `https://${TEST_PROJECT_REF}.supabase.co`;
const gameId = "ae7fc204-f00c-4113-a7c5-438efa3d8ddd";

for (const role of ["admin", "owner", "reader"] as const) {
  for (const table of FREE_AGENCY_TABLES) {
    for (const method of ["DELETE", "PATCH", "POST"]) {
      it(`rejects ${role} Request ${method} ${table} without mutation`, async () => {
        const state = { rows: ["unrelated"] };
        const hash = () => createHash("sha256").update(JSON.stringify(state)).digest("hex");
        const before = hash();
        const request = vi.fn<typeof fetch>(async () => {
          state.rows.length = 0;
          return new Response(null, { status: 204 });
        });
        const guarded = new FreeAgencyFixture(gameId).createFetch(url, () => {}, request, role);
        await expect(guarded(new Request(`${url}/rest/v1/${table}`, { method }))).rejects.toThrow(
          "Request is outside the authorized TEST fixture scope"
        );
        expect(request).not.toHaveBeenCalled();
        expect(hash()).toBe(before);
      });
    }
  }
}

it("preserves the baseline unknown-option diagnostic", () => {
  const result = spawnSync(
    "bun",
    ["run", "--no-env-file", "scripts/test-supabase-integration.ts", TEST_PROJECT_REF, "--unknown"],
    { encoding: "utf8" }
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(
    `FAIL usage: bun run --no-env-file scripts/test-supabase-integration.ts ${TEST_PROJECT_REF} [--trades]; dedicated config not read\n`
  );
});
