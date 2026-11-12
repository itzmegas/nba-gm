import { describe, expect, it } from "vitest";
import { prepareRealSchedule } from "@/application/games/prepareRealSchedule";

const home = "11111111-1111-4111-8111-111111111111";
const away = "22222222-2222-4222-8222-222222222222";
const idle = "33333333-3333-4333-8333-333333333333";
const cutoff = new Date("2026-11-12T05:00:00Z");

function snapshot() {
  return {
    version: "test-fixture-v1",
    seasonYear: 2026,
    cutoffAt: cutoff.toISOString(),
    observedAt: "2026-11-12T12:00:00Z",
    sourceUrl: "https://example.com/normalized-test-fixture",
    teamIds: [home, away, idle],
    games: [
      {
        sourceGameId: "source-game-1",
        competitionPhase: "regular_season",
        scheduledAt: "2026-11-12T00:00:00Z",
        homeTeamId: home,
        awayTeamId: away,
        completedAt: "2026-11-12T03:00:00Z" as string | null,
        homeScore: 110 as number | null,
        awayScore: 100 as number | null,
      },
    ],
  };
}

describe("real schedule initialization projection", () => {
  it("derives standings from the same completed games and keeps idle teams at zero", () => {
    const input = snapshot();
    const before = JSON.stringify(input);
    const prepared = prepareRealSchedule(input, 2026, cutoff);
    expect(prepared.snapshotVersion).toBe(input.version);
    expect(prepared.games[0]).toMatchObject({
      sourceGameId: "source-game-1",
      status: "completed",
      homeScore: 110,
      awayScore: 100,
    });
    expect(prepared.standings).toEqual([
      { teamId: home, wins: 1, losses: 0 },
      { teamId: away, wins: 0, losses: 1 },
      { teamId: idle, wins: 0, losses: 0 },
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    "2026-11-12T05:00:00Z",
    "2026-11-12T05:01:00Z",
  ])("does not leak results for a game finishing at or after the cutoff: %s", (completedAt) => {
    const input = snapshot();
    input.games[0].completedAt = completedAt;
    const prepared = prepareRealSchedule(input, 2026, cutoff);
    expect(prepared.games[0].status).toBe("scheduled");
    expect(prepared.games[0]).not.toHaveProperty("homeScore");
    expect(prepared.games[0]).not.toHaveProperty("awayScore");
    expect(prepared.games[0]).not.toHaveProperty("completedAt");
    expect(prepared.standings.every((row) => row.wins === 0 && row.losses === 0)).toBe(true);
  });

  it("imports future fixtures without results", () => {
    const input = snapshot();
    Object.assign(input.games[0], {
      scheduledAt: "2026-11-13T00:00:00Z",
      completedAt: null,
      homeScore: null,
      awayScore: null,
    });
    expect(prepareRealSchedule(input, 2026, cutoff).games[0]).toEqual({
      sourceGameId: "source-game-1",
      scheduledAt: "2026-11-13T00:00:00Z",
      homeTeamId: home,
      awayTeamId: away,
      status: "scheduled",
    });
  });

  it("rejects final scores without completion-time evidence and leaves the input unchanged", () => {
    const input = snapshot();
    input.games[0].completedAt = null;
    const before = JSON.stringify(input);
    expect(() => prepareRealSchedule(input, 2026, cutoff)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    [2025, cutoff],
    [2026, new Date("2026-11-11T05:00:00Z")],
    [2026, new Date(Number.NaN)],
  ])("rejects a different requested season or cutoff", (seasonYear, requestedCutoff) => {
    expect(() => prepareRealSchedule(snapshot(), seasonYear, requestedCutoff)).toThrow();
  });

  it.each([
    (input: ReturnType<typeof snapshot>) => {
      input.games.push({ ...input.games[0] });
    },
    (input: ReturnType<typeof snapshot>) => {
      input.teamIds.push(home);
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].awayTeamId = home;
    },
    (input: ReturnType<typeof snapshot>) => {
      input.teamIds = [home, idle];
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].awayScore = 110;
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].homeScore = null;
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].completedAt = "2026-11-11T23:00:00Z";
    },
    (input: ReturnType<typeof snapshot>) => {
      input.observedAt = "2026-11-12T02:00:00Z";
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].scheduledAt = "invalid-date";
    },
    (input: ReturnType<typeof snapshot>) => {
      input.games[0].competitionPhase = "cup_final";
    },
  ])("rejects inconsistent or non-regular-season input %#", (invalidate) => {
    const input = snapshot();
    invalidate(input);
    const before = JSON.stringify(input);
    expect(() => prepareRealSchedule(input, 2026, cutoff)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
});
