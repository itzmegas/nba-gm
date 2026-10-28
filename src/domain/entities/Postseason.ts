import type { ScheduledGameStatus } from "@/domain/entities/ScheduledGame";

export const POSTSEASON_PHASE = {
  REGULAR_SEASON: "regular_season",
  PLAY_IN: "play_in",
  PLAYOFFS: "playoffs",
  COMPLETE: "complete",
} as const;
export type PostseasonPhase = (typeof POSTSEASON_PHASE)[keyof typeof POSTSEASON_PHASE];
export const POSTSEASON_CONFERENCE = { EAST: "East", WEST: "West", FINALS: "Finals" } as const;
export type PostseasonConference =
  (typeof POSTSEASON_CONFERENCE)[keyof typeof POSTSEASON_CONFERENCE];
export const PLAY_IN_STAGE = {
  SEVEN_EIGHT: "seven_eight",
  NINE_TEN: "nine_ten",
  EIGHTH_SEED: "eighth_seed",
} as const;
export type PlayInStage = (typeof PLAY_IN_STAGE)[keyof typeof PLAY_IN_STAGE];

export interface PostseasonSeed {
  teamId: string;
  conference: Exclude<PostseasonConference, "Finals">;
  seed: number;
}

export interface PlayoffSeries {
  id: string;
  round: number;
  conference: PostseasonConference;
  bracketSlot: number;
  homeTeamId: string;
  awayTeamId: string;
  homeWins: number;
  awayWins: number;
  winnerTeamId: string | null;
}

export interface PostseasonGame {
  id: string;
  seriesId: string | null;
  stage: PlayInStage | null;
  conference: PostseasonConference;
  gameNumber: number | null;
  gameDate: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  status: ScheduledGameStatus;
}

export interface PostseasonState {
  phase: PostseasonPhase;
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  qualification: PostseasonSeed[];
  playoffSeeds: PostseasonSeed[];
  series: PlayoffSeries[];
  games: PostseasonGame[];
}

export function hasPostseasonChampion(state: PostseasonState | undefined): boolean {
  return state?.phase === POSTSEASON_PHASE.COMPLETE && state.championTeamId !== null;
}

export function isPlayoffsReady(state: PostseasonState): boolean {
  return (
    state.phase === POSTSEASON_PHASE.PLAYOFFS &&
    state.playoffSeeds.length === 16 &&
    state.series.length === 0
  );
}

export function isTeamEliminated(state: PostseasonState, teamId: string): boolean {
  if (state.phase === POSTSEASON_PHASE.REGULAR_SEASON || state.championTeamId === teamId)
    return false;
  if (hasPostseasonChampion(state)) return true;
  if (state.qualification.some((seed) => seed.teamId === teamId && seed.seed > 10)) return true;
  if (
    state.series.some(
      (series) =>
        (series.homeTeamId === teamId || series.awayTeamId === teamId) &&
        series.winnerTeamId !== null &&
        series.winnerTeamId !== teamId
    )
  )
    return true;
  return state.games.some(
    (game) =>
      game.status === "completed" &&
      game.stage !== null &&
      game.stage !== PLAY_IN_STAGE.SEVEN_EIGHT &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId) &&
      game.winnerTeamId !== null &&
      game.winnerTeamId !== teamId
  );
}
