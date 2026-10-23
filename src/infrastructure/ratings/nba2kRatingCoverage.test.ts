import { describe, expect, it } from "vitest";
import {
  getNba2kRatingCoverage,
  RATING_COVERAGE_STATUS,
} from "@/infrastructure/ratings/nba2kRatingCoverage";
import type { fetchNba2kRatings } from "@/infrastructure/ratings/nba2kRatingsSource";

type Snapshot = Awaited<ReturnType<typeof fetchNba2kRatings>>;

const attributes = {
  closeShot: 70,
  midRangeShot: 70,
  threePointShot: 70,
  freeThrow: 70,
  drawFoul: 70,
  ballHandle: 70,
  passAccuracy: 70,
  interiorDefense: 70,
  perimeterDefense: 70,
  steal: 70,
  block: 70,
  offensiveRebound: 70,
  defensiveRebound: 70,
  stamina: 70,
};
const playerId = "00000000-0000-4000-8000-000000000001";
const otherPlayerId = "00000000-0000-4000-8000-000000000002";
const roster = {
  seasonYear: 2026,
  seasonEraId: "modern",
  players: [{ playerId, fullName: "Test Player" }],
};
const snapshot: Snapshot = {
  source: "nba2kapi",
  sourceUrl: "https://api.nba2kapi.com/api/public/players",
  gameVersion: "2K27",
  observedAt: "2026-10-22T00:00:00.000Z",
  contentHash: "a".repeat(64),
  requestCount: 1,
  excludedPlayers: [],
  players: [
    {
      slug: "test-player",
      name: "Test Player",
      team: "Test Team",
      teamType: "curr",
      gameVersion: "2K27",
      lastUpdated: "2026-10-17T00:00:00.000Z",
      overall: 70,
      attributes,
    },
  ],
};

describe("getNba2kRatingCoverage", () => {
  it("reports a unique name as a candidate, never a verified identity", () => {
    const result = getNba2kRatingCoverage(snapshot, roster);
    expect(result).toMatchObject({
      candidateCount: 1,
      unresolvedCount: 0,
      identityVerified: false,
    });
    expect(result.players[0]).toMatchObject({ status: RATING_COVERAGE_STATUS.CANDIDATE });
  });

  it("reuses accent and case normalization while preserving suffix identity", () => {
    const source = { ...snapshot, players: [{ ...snapshot.players[0], name: "Tést Player Jr." }] };
    const target = { ...roster, players: [{ playerId, fullName: "TEST PLAYER JR" }] };
    expect(getNba2kRatingCoverage(source, target).candidateCount).toBe(1);
    expect(getNba2kRatingCoverage(source, roster).players[0].status).toBe(
      RATING_COVERAGE_STATUS.MISSING
    );
  });

  it("does not fuzzy-match absent players", () => {
    const result = getNba2kRatingCoverage(snapshot, {
      ...roster,
      players: [{ playerId, fullName: "Test Playe" }],
    });
    expect(result.players[0]).toMatchObject({
      status: RATING_COVERAGE_STATUS.MISSING,
      sourceSlugs: [],
    });
    expect(result.unresolvedCount).toBe(1);
  });

  it("reports incomplete attributes separately from missing identities", () => {
    const result = getNba2kRatingCoverage(
      {
        ...snapshot,
        players: [],
        excludedPlayers: [
          { slug: "test-player", name: "Test Player", invalidAttributes: ["stamina"] },
        ],
      },
      roster
    );
    expect(result.players[0].status).toBe(RATING_COVERAGE_STATUS.INCOMPLETE);
  });

  it("does not choose between duplicate source names", () => {
    const result = getNba2kRatingCoverage(
      {
        ...snapshot,
        players: [...snapshot.players, { ...snapshot.players[0], slug: "other" }],
      },
      roster
    );
    expect(result.players[0].status).toBe(RATING_COVERAGE_STATUS.AMBIGUOUS);
  });

  it("does not assign one source identity to multiple roster players", () => {
    const result = getNba2kRatingCoverage(snapshot, {
      ...roster,
      players: [...roster.players, { playerId: otherPlayerId, fullName: "Test Player" }],
    });
    expect(result.candidateCount).toBe(0);
    expect(result.players.every(({ status }) => status === RATING_COVERAGE_STATUS.AMBIGUOUS)).toBe(
      true
    );
  });

  it.each([
    { ...roster, seasonYear: 1995 },
    { ...roster, seasonEraId: "jordan" },
    { ...roster, players: [] },
    { ...roster, players: [{ playerId: "bad-id", fullName: "Test Player" }] },
    { ...roster, players: [...roster.players, ...roster.players] },
  ])("rejects unsupported eras and invalid roster inputs", (input) => {
    expect(() => getNba2kRatingCoverage(snapshot, input)).toThrow();
  });
});
