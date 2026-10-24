import { describe, expect, it } from "vitest";
import {
  type QualificationResult,
  type QualificationTeam,
  qualifyPostseason,
} from "@/domain/services/PostseasonQualification";

function team(teamId: string, drawOrder: number, wins = 40, losses = 40): QualificationTeam {
  return { teamId, conference: "East", wins, losses, drawOrder };
}

function win(homeTeamId: string, awayTeamId: string, margin = 1): QualificationResult {
  return { homeTeamId, awayTeamId, homeScore: 100 + margin, awayScore: 100 };
}

const ids = (teams: QualificationTeam[], results: QualificationResult[] = []) =>
  qualifyPostseason(teams, results).map((entry) => entry.teamId);

describe("qualifyPostseason", () => {
  it("uses winning percentage rather than raw wins", () => {
    expect(ids([team("a", 0, 41, 41), team("b", 1, 40, 20)])).toEqual(["b", "a"]);
  });

  it("uses head-to-head before the lottery or point differential", () => {
    expect(
      ids([team("a", 0), team("b", 1), team("c", 2, 10, 70)], [win("b", "a"), win("a", "c", 30)])
    ).toEqual(["b", "a", "c"]);
  });

  it("compares head-to-head percentages with unequal numbers of games", () => {
    expect(
      ids(
        [team("a", 0), team("b", 1), team("c", 2)],
        [win("a", "b"), win("b", "a"), win("b", "c"), win("c", "b"), win("b", "c")]
      )
    ).toEqual(["b", "a", "c"]);
  });

  it("restarts head-to-head after a multi-team tie separates", () => {
    // A and B both go 2-2; C goes 3-1 and D 1-3. B beat A directly.
    const teams = [team("a", 0), team("b", 1), team("c", 2), team("d", 3)];
    expect(
      ids(teams, [
        win("b", "a"),
        win("c", "a"),
        win("a", "d"),
        win("a", "d"),
        win("c", "b"),
        win("c", "b"),
        win("b", "d"),
        win("d", "c"),
      ])
    ).toEqual(["c", "b", "a", "d"]);
  });

  it("uses conference record when head-to-head is tied", () => {
    const teams = [team("a", 0), team("b", 1), team("c", 2, 10, 70)];
    expect(ids(teams, [win("a", "b"), win("b", "a"), win("b", "c")])).toEqual(["b", "a", "c"]);
  });

  it("does not count other conferences toward conference record", () => {
    const teams = [
      team("a", 0),
      team("b", 1),
      team("c", 2, 10, 70),
      { ...team("west", 3), conference: "West" as const },
    ];
    expect(ids(teams, [win("b", "c"), win("west", "a", 40), win("a", "west", 80)])).toEqual([
      "b",
      "a",
      "c",
      "west",
    ]);
  });

  it("uses all regular-season point differential after conference record", () => {
    expect(ids([team("a", 0), team("b", 1)], [win("a", "b"), win("b", "a", 20)])).toEqual([
      "b",
      "a",
    ]);
  });

  it("falls back to the supplied lottery without depending on input order", () => {
    const teams = [team("a", 2), team("b", 0), team("c", 1)];
    expect(ids(teams)).toEqual(["b", "c", "a"]);
    expect(ids([...teams].reverse())).toEqual(["b", "c", "a"]);
  });

  it("treats a team without appearances as having zero winning percentage", () => {
    expect(ids([team("a", 1, 0, 0), team("b", 0, 0, 1)])).toEqual(["b", "a"]);
  });

  it("assigns six playoff places, four play-in places and eliminates the rest per conference", () => {
    const teams = Array.from({ length: 15 }, (_, i) => team(`east-${i}`, i, 60 - i, 20 + i));
    teams.push(
      ...Array.from({ length: 15 }, (_, i) => ({
        ...team(`west-${i}`, 15 + i, 60 - i, 20 + i),
        conference: "West" as const,
      }))
    );
    const qualified = qualifyPostseason(teams, []);
    for (const conference of ["East", "West"]) {
      const entries = qualified.filter((entry) => entry.conference === conference);
      expect(entries.map((entry) => entry.seed)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1)
      );
      expect(entries.filter((entry) => entry.status === "playoffs")).toHaveLength(6);
      expect(entries.filter((entry) => entry.status === "play_in")).toHaveLength(4);
      expect(entries.filter((entry) => entry.status === "eliminated")).toHaveLength(5);
    }
  });

  it("does not mutate standings, results or lottery positions", () => {
    const teams = [team("a", 0), team("b", 1)];
    const results = [win("b", "a")];
    const before = structuredClone({ teams, results });
    qualifyPostseason(teams, results);
    expect({ teams, results }).toEqual(before);
  });

  it("supports an empty competition", () => {
    expect(qualifyPostseason([], [])).toEqual([]);
  });

  it("rejects duplicate team identities or lottery positions", () => {
    expect(() => ids([team("a", 0), team("a", 1)])).toThrow("unique");
    expect(() => ids([team("a", 0), team("b", 0)])).toThrow("unique");
  });

  it("rejects invalid records and lottery numbers instead of creating an unstable order", () => {
    expect(() => ids([team("a", Number.NaN), team("b", 0)])).toThrow("integers");
    expect(() => ids([team("a", 0, -1), team("b", 1)])).toThrow("integers");
    expect(() => ids([team("a", 0, 0.5), team("b", 1)])).toThrow("integers");
  });

  it("rejects tied, self-play and unknown-team results", () => {
    const teams = [team("a", 0), team("b", 1)];
    expect(() => ids(teams, [{ ...win("a", "b"), homeScore: 100 }])).toThrow("completed");
    expect(() => ids(teams, [win("a", "a")])).toThrow("completed");
    expect(() => ids(teams, [win("a", "unknown")])).toThrow("completed");
    expect(() => ids(teams, [{ ...win("a", "b"), homeScore: Number.NaN }])).toThrow("completed");
  });
});
