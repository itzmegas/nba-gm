import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import { z } from "zod";
import {
  type QualificationResult,
  type QualificationTeam,
  qualifyPostseason,
} from "@/domain/services/PostseasonQualification";

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Docker failed");
  return result.stdout.trim();
}

// This runner owns only a fresh container: no ports, mounts, secrets or external network.
const container = docker([
  "run",
  "--rm",
  "--pull=never",
  "--network",
  "none",
  "--tmpfs",
  "/var/lib/postgresql/data:rw,noexec,nosuid,size=256m",
  "-e",
  "POSTGRES_HOST_AUTH_METHOD=trust",
  "--label",
  "purpose=nba-gm-postseason-tests",
  "-d",
  "postgres:17-alpine",
]);
function sql(input: string): string {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
    ],
    input
  );
}
function literal(value: unknown): string {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = spawnSync("docker", [
      "exec",
      container,
      "sh",
      "-c",
      "grep -qx postgres /proc/1/comm && pg_isready -U postgres",
    ]);
    if (result.status === 0) {
      ready = true;
      break;
    }
    await setTimeout(100);
  }
  if (!ready) throw new Error("Isolated PostgreSQL did not become ready");
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;`);
  const schema = readFileSync("scripts/schema.sql", "utf8");
  sql(schema.split("-- Canonical schema mirror for migration 049.")[0]);
  sql("GRANT SELECT ON public.games TO authenticated;");
  const phases = readFileSync(
    "tests/infrastructure/supabase/postseasonQualification.postgres.sql",
    "utf8"
  ).split("-- AFTER_MIGRATION_049\n");
  if (phases.length !== 2) throw new Error("Missing qualification upgrade test boundary");
  // One connection preserves temporary upgrade/history snapshots.
  sql(
    phases[0] +
      readFileSync("scripts/migrations/049_postseason_qualification.sql", "utf8") +
      phases[1]
  );
  console.log("Upgrade, daily closure, retry, history, RLS and rollback assertions passed.");

  const advance = `SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',false);
    SELECT set_config('request.jwt.claim.role','authenticated',false);
    SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000003','2027-03-01');`;
  const exec = promisify(execFile);
  await Promise.all(
    [0, 1].map(() =>
      exec(
        "docker",
        [
          "exec",
          container,
          "psql",
          "-X",
          "-q",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-c",
          advance,
        ],
        { timeout: 120_000 }
      )
    )
  );
  sql(`DO $$ BEGIN
    ASSERT (SELECT count(*)=90 FROM public.postseason_qualifications), 'One snapshot per career';
    ASSERT (SELECT sum(wins)=30 AND sum(losses)=30 FROM public.league_standings
      WHERE game_id='b3000000-0000-4000-8000-000000000003'), 'Concurrent day counts once';
    ASSERT (SELECT simulation_date='2027-03-02' FROM public.games
      WHERE id='b3000000-0000-4000-8000-000000000003'), 'Concurrent clock advances once';
  END $$;`);
  console.log("Concurrent final-day retry assertions passed.");

  // Same inputs drive both implementations; random fixtures cover ties and uneven schedules.
  for (let sample = 0; sample < 50; sample++) {
    const teams: QualificationTeam[] = Array.from({ length: 30 }, (_, i) => ({
      teamId: String(i),
      conference: i < 15 ? "East" : "West",
      wins: 0,
      losses: 0,
      drawOrder: (i + sample) % 30,
    }));
    const results: QualificationResult[] = [];
    let state = sample + 1;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    // The last case ties all 30 records after the existing 58-game/team format.
    for (let game = 0; game < (sample === 49 ? 870 : sample * 3); game++) {
      const home = teams[sample === 49 ? game % 30 : random() % 30];
      const away =
        teams[
          (Number(home.teamId) + 1 + (sample === 49 ? Math.floor(game / 30) : random() % 29)) % 30
        ];
      const homeScore = sample === 49 ? 100 : 90 + (random() % 30);
      const awayScore =
        sample === 49 ? 90 : homeScore + (random() % 2 === 0 ? 1 : -1) * (1 + (random() % 20));
      results.push({ homeTeamId: home.teamId, awayTeamId: away.teamId, homeScore, awayScore });
      (homeScore > awayScore ? home : away).wins++;
      (homeScore > awayScore ? away : home).losses++;
    }
    const enriched = teams.map((team) => {
      let conferenceWins = 0,
        conferenceGames = 0,
        differential = 0;
      for (const result of results) {
        const home = result.homeTeamId === team.teamId;
        if (!home && result.awayTeamId !== team.teamId) continue;
        const opponent = teams[Number(home ? result.awayTeamId : result.homeTeamId)];
        const margin = (home ? 1 : -1) * (result.homeScore - result.awayScore);
        differential += margin;
        if (opponent.conference === team.conference) {
          conferenceGames++;
          conferenceWins += Number(margin > 0);
        }
      }
      return { ...team, conferenceWins, conferenceGames, differential };
    });
    const appearances = results.flatMap((result) => [
      {
        teamId: result.homeTeamId,
        opponentId: result.awayTeamId,
        won: result.homeScore > result.awayScore,
      },
      {
        teamId: result.awayTeamId,
        opponentId: result.homeTeamId,
        won: result.awayScore > result.homeScore,
      },
    ]);
    const actual =
      sql(`SELECT public.rank_postseason_group(${literal(enriched.filter((t) => t.conference === "East"))},${literal(appearances)})
      || public.rank_postseason_group(${literal(enriched.filter((t) => t.conference === "West"))},${literal(appearances)});`);
    const expected = qualifyPostseason(teams, results).map((t) => t.teamId);
    const parsed = z.array(z.object({ teamId: z.string() })).parse(JSON.parse(actual));
    if (JSON.stringify(parsed.map((t) => t.teamId)) !== JSON.stringify(expected)) {
      throw new Error(`Domain/SQL qualification parity failed for sample ${sample}`);
    }
  }
  console.log("50 deterministic 30-team domain/SQL parity scenarios passed.");

  const snapshot = z
    .object({
      teams: z.array(
        z.object({
          teamId: z.uuid(),
          conference: z.enum(["East", "West"]),
          wins: z.number().int(),
          losses: z.number().int(),
          drawOrder: z.number().int(),
          seed: z.number().int(),
        })
      ),
      results: z.array(
        z.object({
          homeTeamId: z.uuid(),
          awayTeamId: z.uuid(),
          homeScore: z.number().int(),
          awayScore: z.number().int(),
        })
      ),
    })
    .parse(
      JSON.parse(
        sql(`SELECT jsonb_build_object('teams',
    (SELECT jsonb_agg(jsonb_build_object('teamId',team_id,'conference',conference,'wins',wins,
      'losses',losses,'drawOrder',draw_order,'seed',seed)) FROM public.postseason_qualifications
      WHERE game_id='b3000000-0000-4000-8000-000000000003'), 'results',
    (SELECT jsonb_agg(jsonb_build_object('homeTeamId',home_team_id,'awayTeamId',away_team_id,
      'homeScore',home_score,'awayScore',away_score)) FROM public.scheduled_games
      WHERE game_id='b3000000-0000-4000-8000-000000000003' AND competition_phase='regular_season'));`)
      )
    );
  for (const expected of qualifyPostseason(snapshot.teams, snapshot.results)) {
    if (snapshot.teams.find((t) => t.teamId === expected.teamId)?.seed !== expected.seed) {
      throw new Error("Frozen database qualification disagrees with domain service");
    }
  }
  console.log("Full daily snapshot agrees with domain qualification.");

  const historyQuery = `SELECT md5(jsonb_build_object(
    'fixtures',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.scheduled_games f WHERE f.competition_phase='regular_season'),
    'payloads',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.scheduled_game_id) FROM public.game_box_scores b JOIN public.scheduled_games f
      ON f.id=b.scheduled_game_id WHERE f.competition_phase='regular_season'),
    'standings',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.game_id,s.team_id) FROM public.league_standings s),
    'qualification',(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.game_id,q.team_id) FROM public.postseason_qualifications q)
    )::TEXT);`;
  const historyBefore = sql(historyQuery);
  const playIn = readFileSync(
    "tests/infrastructure/supabase/playInTournament.postgres.sql",
    "utf8"
  ).split("-- AFTER_CONCURRENT_PLAY_IN\n");
  if (playIn.length !== 2) throw new Error("Missing play-in concurrency boundary");
  sql(readFileSync("scripts/migrations/050_play_in_tournament.sql", "utf8") + playIn[0]);
  const playInAdvance = `SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',false);
    SELECT set_config('request.jwt.claim.role','authenticated',false);
    SELECT * FROM public.advance_simulation_day('b3000000-0000-4000-8000-000000000002','2027-04-16');`;
  await Promise.all(
    [0, 1].map(() =>
      exec(
        "docker",
        [
          "exec",
          container,
          "psql",
          "-X",
          "-q",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-c",
          playInAdvance,
        ],
        { timeout: 120_000 }
      )
    )
  );
  sql(playIn[1]);
  if (sql(historyQuery) !== historyBefore)
    throw new Error("Play-in changed regular-season history or standings");
  console.log(
    "Play-in progression, modern v2 box scores, legacy fallback, concurrency, rollback, isolation and unchanged regular history passed."
  );
  const repair = readFileSync("scripts/migrations/051_missing_team_conferences.sql", "utf8");
  sql(
    readFileSync(
      "tests/infrastructure/supabase/missingTeamConferences.postgres.sql",
      "utf8"
    ).replaceAll("\\ir ../../../scripts/migrations/051_missing_team_conferences.sql", () => repair)
  );
  console.log(
    "Missing-conference blocker reproduced and repaired without replaying history; idempotency and unknown-team protection passed."
  );

  const playoffHistoryBefore = sql(historyQuery);
  const playoffs = readFileSync(
    "tests/infrastructure/supabase/playoffSeries.postgres.sql",
    "utf8"
  ).split("-- AFTER_MIGRATION_052\n");
  if (playoffs.length !== 2) throw new Error("Missing playoff migration test boundary");
  // Keep upgrade/setup assertions separate from scenarios that require completed champions.
  const journeys = playoffs[1].split("-- AFTER_PLAYOFF_JOURNEYS\n");
  if (journeys.length !== 2) throw new Error("Missing playoff journey test boundary");
  const edges = journeys[0].split("-- PLAYOFF_EDGE_CASES\n");
  if (edges.length !== 2) throw new Error("Missing playoff edge test boundary");
  const setup = edges[1].split("-- PLAYOFF_JOURNEY_SETUP\n");
  if (setup.length !== 2) throw new Error("Missing playoff setup test boundary");
  sql(
    playoffs[0] +
      readFileSync("scripts/migrations/052_playoff_series.sql", "utf8") +
      edges[0] +
      setup[1]
  );
  const failures = new Map([
    ["Injected playoff link failure", "test_fail_playoff_link ON public.postseason_series_games"],
    ["Injected playoff round failure", "test_fail_playoff_round ON public.postseason_series"],
    ["Injected playoff result failure", "test_fail_playoff_result ON public.postseason_results"],
  ]);
  const verifiedFailures = new Set<string>();
  let concurrentClinchDays = 0;
  let concurrentRoundDays = 0;
  for (const career of [1, 2]) {
    const gameId = `b3000000-0000-4000-8000-${String(career).padStart(12, "0")}`;
    const ownerId = `b0000000-0000-4000-8000-${String(career).padStart(12, "0")}`;
    let complete = false;
    for (let day = 0; day < 70; day++) {
      const before = z
        .object({
          date: z.string(),
          winners: z.number(),
          rounds: z.number(),
          complete: z.boolean(),
        })
        .parse(JSON.parse(sql(`SELECT public.test_playoff_progress('${gameId}');`)));
      if (before.complete) {
        complete = true;
        break;
      }
      const statement = `SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub','${ownerId}',false);
        SELECT set_config('request.jwt.claim.role','authenticated',false);
        SELECT * FROM public.advance_simulation_day('${gameId}','${before.date}');`;
      const snapshotBefore = sql(`SELECT md5(public.test_playoff_snapshot('${gameId}')::TEXT);`);
      // Independent connections race the same expected day, including all decisive days.
      for (;;) {
        const attempts = await Promise.allSettled(
          [0, 1].map(() =>
            exec(
              "docker",
              [
                "exec",
                container,
                "psql",
                "-X",
                "-q",
                "-v",
                "ON_ERROR_STOP=1",
                "-U",
                "postgres",
                "-c",
                statement,
              ],
              { timeout: 120_000 }
            )
          )
        );
        const rejected = attempts.filter((attempt) => attempt.status === "rejected");
        if (rejected.length === 0) break;
        const injected = [...failures].find(([message]) =>
          rejected.every((attempt) => String(attempt.reason).includes(message))
        );
        if (rejected.length !== 2 || !injected || verifiedFailures.has(injected[0])) {
          throw new Error(
            `Unexpected playoff advancement failure: ${rejected.map((r) => String(r.reason)).join("\n")}`
          );
        }
        if (
          sql(`SELECT md5(public.test_playoff_snapshot('${gameId}')::TEXT);`) !== snapshotBefore
        ) {
          throw new Error(`${injected[0]} did not roll back the entire day`);
        }
        verifiedFailures.add(injected[0]);
        sql(`DROP TRIGGER ${injected[1]};`);
      }
      sql(`SELECT public.test_assert_playoff_progress('${gameId}','${before.date}'::DATE + 1);`);
      const after = z
        .object({ winners: z.number(), rounds: z.number() })
        .parse(JSON.parse(sql(`SELECT public.test_playoff_progress('${gameId}');`)));
      if (after.winners > before.winners) concurrentClinchDays++;
      if (after.rounds > before.rounds) concurrentRoundDays++;
      const snapshotAfter = sql(`SELECT md5(public.test_playoff_snapshot('${gameId}')::TEXT);`);
      sql(statement);
      if (sql(`SELECT md5(public.test_playoff_snapshot('${gameId}')::TEXT);`) !== snapshotAfter) {
        throw new Error("Stale playoff retry changed persisted state");
      }
    }
    if (!complete) throw new Error(`Playoffs did not complete within 70 days: ${gameId}`);
  }
  if (verifiedFailures.size !== 3 || concurrentClinchDays < 2 || concurrentRoundDays < 6) {
    throw new Error("Missing playoff rollback, concurrent clinch or round-transition evidence");
  }
  sql(journeys[1] + setup[0]);
  if (sql(historyQuery) !== playoffHistoryBefore) {
    throw new Error("Playoffs changed regular-season history, standings or qualification");
  }
  console.log(
    `Playoffs passed: modern v2 and legacy champions, ${concurrentClinchDays} concurrent clinch days, ${concurrentRoundDays} concurrent round transitions, three full-state rollbacks, frozen history, bracket, Finals tiebreaks, statistics and access control.`
  );
} finally {
  docker(["rm", "-f", container]);
}
