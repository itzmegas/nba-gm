import type { PostseasonGame, PostseasonState } from "@/domain/entities/Postseason";
import type { Team } from "@/domain/entities/Team";

export const postseasonId = (id: number) =>
  `a0000000-0000-4000-8000-${String(id).padStart(12, "0")}`;

export function postseasonFixture(overrides: Partial<PostseasonState> = {}): PostseasonState {
  const qualification = (["East", "West"] as const).flatMap((conference, index) =>
    Array.from({ length: 15 }, (_, seed) => ({
      teamId: postseasonId(index * 15 + seed + 1),
      conference,
      seed: seed + 1,
    }))
  );
  return {
    phase: "playoffs",
    championTeamId: null,
    runnerUpTeamId: null,
    qualification,
    playoffSeeds: qualification.filter((seed) => seed.seed <= 8),
    series: [],
    games: [],
    ...overrides,
  };
}

export function postseasonGameFixture(overrides: Partial<PostseasonGame> = {}): PostseasonGame {
  return {
    id: postseasonId(102),
    seriesId: postseasonId(101),
    stage: null,
    conference: "East",
    gameNumber: 1,
    gameDate: "2027-04-22",
    homeTeamId: postseasonId(1),
    awayTeamId: postseasonId(8),
    homeScore: 100,
    awayScore: 90,
    winnerTeamId: postseasonId(1),
    status: "completed",
    ...overrides,
  };
}

export function postseasonTeamsFixture(): Team[] {
  return postseasonFixture().qualification.map((seed) => ({
    id: seed.teamId,
    nbaId: seed.seed,
    name: `${seed.conference} Team ${seed.seed}`,
    city: seed.conference,
    abbreviation: `${seed.conference[0]}${seed.seed}`,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}
