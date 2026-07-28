import { describe, expect, it } from "vitest";
import { leagueStandingSchema } from "@/domain/entities/LeagueStanding";

describe("leagueStandingSchema", () => {
  it("accepts a non-negative record", () => {
    expect(
      leagueStandingSchema.safeParse({
        gameId: "22222222-2222-4222-8222-222222222222",
        teamId: "33333333-3333-4333-8333-333333333333",
        wins: 3,
        losses: 1,
      }).success
    ).toBe(true);
  });

  it("rejects negative records", () => {
    expect(
      leagueStandingSchema.safeParse({
        gameId: "22222222-2222-4222-8222-222222222222",
        teamId: "33333333-3333-4333-8333-333333333333",
        wins: -1,
        losses: 1,
      }).success
    ).toBe(false);
  });
});
