import { describe, expect, it } from "vitest";
import { reviewedNba2kRatingAliases } from "@/infrastructure/ratings/reviewedNba2kRatingAliases";

describe("reviewed NBA 2K aliases", () => {
  it("binds ten distinct ESPN identities to distinct source slugs", () => {
    expect(reviewedNba2kRatingAliases).toHaveLength(10);
    expect(new Set(reviewedNba2kRatingAliases.map(({ espnId }) => espnId)).size).toBe(10);
    expect(new Set(reviewedNba2kRatingAliases.map(({ sourceSlug }) => sourceSlug)).size).toBe(10);
    for (const alias of reviewedNba2kRatingAliases) {
      expect(Number.isInteger(alias.espnId) && alias.espnId > 0).toBe(true);
      expect(alias.canonicalName.length).toBeGreaterThan(0);
      expect(alias.sourceName.length).toBeGreaterThan(0);
      expect(alias.sourceSlug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("does not invent a stable ESPN identity for Xavier Tillman", () => {
    expect(
      reviewedNba2kRatingAliases.some(({ sourceSlug }) => sourceSlug === "xavier-tillman")
    ).toBe(false);
  });
});
