export const HOME_COURT_ADVANTAGE = 3;
export const SEASON_START_MONTH = 9;
export const SEASON_END_MONTH = 3;

interface GameScore {
  homeScore: number;
  awayScore: number;
}

// biome-ignore lint/complexity/noStaticOnlyClass: the domain contract intentionally exposes stateless operations.
export class SeasonSimulator {
  static computeSeed(gameId: string, date: string, homeId: string, awayId: string): number {
    const input = `${gameId}:${date}:${homeId}:${awayId}`;
    let hash = 2166136261;

    for (const character of input) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  static simulateGame(homeRating: number, awayRating: number, seed: number): GameScore {
    let state = seed >>> 0;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };

    const homeScore = Math.round(
      105 + (homeRating + HOME_COURT_ADVANTAGE - 75) * 0.55 + (random() - 0.5) * 24
    );
    let awayScore = Math.round(105 + (awayRating - 75) * 0.55 + (random() - 0.5) * 24);

    if (homeScore === awayScore) awayScore -= 1;

    return { homeScore: Math.max(70, homeScore), awayScore: Math.max(70, awayScore) };
  }
}
