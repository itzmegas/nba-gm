export const POSTSEASON_CONFERENCE = { EAST: "East", WEST: "West" } as const;
export type PostseasonConference =
  (typeof POSTSEASON_CONFERENCE)[keyof typeof POSTSEASON_CONFERENCE];

export const QUALIFICATION_STATUS = {
  PLAYOFFS: "playoffs",
  PLAY_IN: "play_in",
  ELIMINATED: "eliminated",
} as const;
export type QualificationStatus = (typeof QUALIFICATION_STATUS)[keyof typeof QUALIFICATION_STATUS];

export interface QualificationTeam {
  teamId: string;
  conference: PostseasonConference;
  wins: number;
  losses: number;
  drawOrder: number;
}

export interface QualificationResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface QualifiedTeam extends QualificationTeam {
  seed: number;
  status: QualificationStatus;
}

interface RecordMetric {
  wins: number;
  games: number;
  differential: number;
}

function comparePercentage(aWins: number, aGames: number, bWins: number, bGames: number) {
  return bWins * Math.max(1, aGames) - aWins * Math.max(1, bGames);
}

/** Receives only completed regular-season results and a unique, persisted lottery order. */
export function qualifyPostseason(
  teams: readonly QualificationTeam[],
  results: readonly QualificationResult[]
): QualifiedTeam[] {
  const byId = new Map(teams.map((team) => [team.teamId, team]));
  if (
    teams.some(
      (team) =>
        ![team.wins, team.losses, team.drawOrder].every(
          (value) => Number.isSafeInteger(value) && value >= 0
        )
    )
  ) {
    throw new Error("Qualification records and lottery positions must be nonnegative integers.");
  }
  if (
    byId.size !== teams.length ||
    new Set(teams.map((team) => team.drawOrder)).size !== teams.length
  ) {
    throw new Error("Qualification requires unique teams and lottery positions.");
  }
  for (const result of results) {
    if (
      !byId.has(result.homeTeamId) ||
      !byId.has(result.awayTeamId) ||
      result.homeTeamId === result.awayTeamId ||
      result.homeScore === result.awayScore ||
      ![result.homeScore, result.awayScore].every(
        (score) => Number.isSafeInteger(score) && score >= 0
      )
    ) {
      throw new Error("Qualification requires completed results between known teams.");
    }
  }

  function record(team: QualificationTeam, opponents?: ReadonlySet<string>): RecordMetric {
    const metric = { wins: 0, games: 0, differential: 0 };
    for (const result of results) {
      const home = result.homeTeamId === team.teamId;
      if (!home && result.awayTeamId !== team.teamId) continue;
      const opponentId = home ? result.awayTeamId : result.homeTeamId;
      if (opponents && !opponents.has(opponentId)) continue;
      const difference = home
        ? result.homeScore - result.awayScore
        : result.awayScore - result.homeScore;
      metric.games += 1;
      metric.wins += Number(difference > 0);
      metric.differential += difference;
    }
    return metric;
  }

  const allRecords = new Map(teams.map((team) => [team.teamId, record(team)]));
  const conferenceRecords = new Map(
    teams.map((team) => [
      team.teamId,
      record(
        team,
        new Set(teams.filter((other) => other.conference === team.conference).map((t) => t.teamId))
      ),
    ])
  );

  function rank(group: readonly QualificationTeam[], criterion = 0): QualificationTeam[] {
    if (group.length < 2) return [...group];
    const opponents = new Set(group.map((team) => team.teamId));
    const metrics = new Map(group.map((team) => [team.teamId, record(team, opponents)]));
    const compare = (a: QualificationTeam, b: QualificationTeam): number => {
      if (criterion === 0) {
        return comparePercentage(a.wins, a.wins + a.losses, b.wins, b.wins + b.losses);
      }
      if (criterion === 1 || criterion === 2) {
        const records = criterion === 1 ? metrics : conferenceRecords;
        const left = records.get(a.teamId);
        const right = records.get(b.teamId);
        if (!left || !right) throw new Error("Missing qualification record.");
        return comparePercentage(left.wins, left.games, right.wins, right.games);
      }
      if (criterion === 3) {
        return (
          (allRecords.get(b.teamId)?.differential ?? 0) -
          (allRecords.get(a.teamId)?.differential ?? 0)
        );
      }
      return a.drawOrder - b.drawOrder;
    };
    const sorted = [...group].sort(compare);
    const partitions: QualificationTeam[][] = [];
    for (const team of sorted) {
      const previous = partitions.at(-1);
      if (previous && compare(previous[0], team) === 0) previous.push(team);
      else partitions.push([team]);
    }
    if (partitions.length === 1) return rank(group, criterion + 1);
    // Restart head-to-head for each reduced tie, not the original mini-league.
    return partitions.flatMap((partition) => rank(partition, 1));
  }

  return Object.values(POSTSEASON_CONFERENCE).flatMap((conference) =>
    rank(teams.filter((team) => team.conference === conference)).map((team, index) => ({
      ...team,
      seed: index + 1,
      status:
        index < 6
          ? QUALIFICATION_STATUS.PLAYOFFS
          : index < 10
            ? QUALIFICATION_STATUS.PLAY_IN
            : QUALIFICATION_STATUS.ELIMINATED,
    }))
  );
}
