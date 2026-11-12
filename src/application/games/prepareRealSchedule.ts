import { z } from "zod";
import { SCHEDULED_GAME_STATUS } from "@/domain/entities/ScheduledGame";

const instant = z.iso.datetime({ offset: true });
const score = z.number().int().nonnegative().nullable();
const snapshotSchema = z.strictObject({
  version: z.string().trim().min(1),
  seasonYear: z.number().int(),
  cutoffAt: instant,
  observedAt: instant,
  sourceUrl: z.url({ protocol: /^https?$/ }),
  teamIds: z.array(z.uuid()).min(2),
  games: z
    .array(
      z.strictObject({
        sourceGameId: z.string().trim().min(1),
        competitionPhase: z.literal("regular_season"),
        scheduledAt: instant,
        homeTeamId: z.uuid(),
        awayTeamId: z.uuid(),
        completedAt: instant.nullable(),
        homeScore: score,
        awayScore: score,
      })
    )
    .min(1),
});

interface InitialRealGame {
  sourceGameId: string;
  scheduledAt: string;
  homeTeamId: string;
  awayTeamId: string;
  status: (typeof SCHEDULED_GAME_STATUS)[keyof typeof SCHEDULED_GAME_STATUS];
  completedAt?: string;
  homeScore?: number;
  awayScore?: number;
}

/** Projects an admitted normalized snapshot, not a raw feed or proof of league-wide coverage. */
export function prepareRealSchedule(raw: unknown, seasonYear: number, cutoff: Date) {
  const snapshot = snapshotSchema.parse(raw);
  const cutoffTime = cutoff.getTime();
  const observedTime = Date.parse(snapshot.observedAt);
  if (
    !Number.isFinite(cutoffTime) ||
    snapshot.seasonYear !== seasonYear ||
    Date.parse(snapshot.cutoffAt) !== cutoffTime ||
    observedTime < cutoffTime
  ) {
    throw new Error("Real schedule snapshot does not match the requested scenario cutoff");
  }

  const standings = new Map(
    snapshot.teamIds.map((teamId) => [teamId, { teamId, wins: 0, losses: 0 }])
  );
  if (standings.size !== snapshot.teamIds.length)
    throw new Error("Duplicate team in real schedule");
  const seenGames = new Set<string>();
  const games: InitialRealGame[] = [];

  for (const game of snapshot.games) {
    const home = standings.get(game.homeTeamId);
    const away = standings.get(game.awayTeamId);
    if (!home || !away || home === away || seenGames.has(game.sourceGameId)) {
      throw new Error("Duplicate game or invalid teams in real schedule");
    }
    seenGames.add(game.sourceGameId);
    const fixture = {
      sourceGameId: game.sourceGameId,
      scheduledAt: game.scheduledAt,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    };

    if (game.completedAt !== null) {
      const endTime = Date.parse(game.completedAt);
      if (
        game.homeScore === null ||
        game.awayScore === null ||
        game.homeScore === game.awayScore ||
        endTime < Date.parse(game.scheduledAt) ||
        endTime > observedTime
      ) {
        throw new Error("Invalid final result or completion evidence in real schedule");
      }
      if (endTime < cutoffTime) {
        const winner = game.homeScore > game.awayScore ? home : away;
        const loser = winner === home ? away : home;
        winner.wins++;
        loser.losses++;
        games.push({
          ...fixture,
          status: SCHEDULED_GAME_STATUS.COMPLETED,
          completedAt: game.completedAt,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
        });
        continue;
      }
    } else if (game.homeScore !== null || game.awayScore !== null) {
      throw new Error("Final scores require actual completion-time evidence");
    }
    games.push({ ...fixture, status: SCHEDULED_GAME_STATUS.SCHEDULED });
  }

  return {
    snapshotVersion: snapshot.version,
    seasonYear: snapshot.seasonYear,
    cutoffAt: new Date(cutoffTime).toISOString(),
    sourceUrl: snapshot.sourceUrl,
    observedAt: snapshot.observedAt,
    games,
    standings: [...standings.values()],
  };
}
