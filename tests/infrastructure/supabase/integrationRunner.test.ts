import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TEST_PROJECT_REF } from "@/infrastructure/supabase/integrationSafety";

describe("integration runner refusal boundary", () => {
  for (const args of [[], ["another-project"]]) {
    it(`preserves the confirmation diagnostic for ${args.join(" ") || "missing argument"}`, () => {
      const result = spawnSync(
        "bun",
        ["run", "--no-env-file", "scripts/test-supabase-integration.ts", ...args],
        { encoding: "utf8" }
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "FAIL explicit TEST project confirmation required; dedicated config not read\n"
      );
    });
  }
  it("rejects unknown arguments before reading dedicated credentials", () => {
    const result = spawnSync(
      "bun",
      [
        "run",
        "--no-env-file",
        "scripts/test-supabase-integration.ts",
        TEST_PROJECT_REF,
        "--unknown",
      ],
      { encoding: "utf8" }
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("FAIL usage:");
    expect(result.stderr).toContain("dedicated config not read");
  });
});
