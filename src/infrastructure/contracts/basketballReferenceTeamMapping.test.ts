import { describe, expect, it } from "vitest";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";

describe("NBA to Basketball-Reference team mapping", () => {
  it("contains exactly 30 unique canonical and source teams in deterministic order", () => {
    expect(NBA_TO_BASKETBALL_REFERENCE_TEAMS).toHaveLength(30);
    expect(
      new Set(NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(({ nbaAbbreviation }) => nbaAbbreviation)).size
    ).toBe(30);
    expect(
      new Set(
        NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
          ({ basketballReferenceAbbreviation }) => basketballReferenceAbbreviation
        )
      ).size
    ).toBe(30);
    expect(NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(({ nbaAbbreviation }) => nbaAbbreviation)).toEqual(
      [...NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(({ nbaAbbreviation }) => nbaAbbreviation)].sort()
    );
  });

  it("encodes provider-specific abbreviation differences", () => {
    const mapping = Object.fromEntries(
      NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
        ({ nbaAbbreviation, basketballReferenceAbbreviation }) => [
          nbaAbbreviation,
          basketballReferenceAbbreviation,
        ]
      )
    );
    expect(mapping).toMatchObject({ BKN: "BRK", CHA: "CHO", PHX: "PHO" });
    expect(mapping.LAL).toBe("LAL");
  });
});
