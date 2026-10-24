import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Docker failed");
  return result.stdout.trim();
}

// No ports, host mounts, credentials, or external network: this runner owns only its new container.
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
  "purpose=nba-gm-possessions-tests",
  "-d",
  "postgres:17-alpine",
]);

function sql(label: string, input: string): void {
  const output = docker(
    ["exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
    input
  );
  console.log(`${label}: passed`);
  if (output) console.log(output);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    // The image briefly starts a temporary server during init; wait for the final PID 1 server.
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
  sql(
    "Authentication fixture",
    `
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
    $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
  `
  );
  const schema = readFileSync(resolve("scripts/schema.sql"), "utf8");
  const baseline = schema.split("-- Canonical schema mirror for migration 047.")[0];
  sql("Canonical schema through 046", baseline);
  sql("Supabase default owner-policy dependency", "GRANT SELECT ON public.games TO authenticated;");
  for (const file of ["possessionEngine", "gameBoxScores", "playerAttributeSimulation"]) {
    const input = readFileSync(
      resolve(`tests/infrastructure/supabase/${file}.postgres.sql`),
      "utf8"
    );
    sql(file, file === "gameBoxScores" ? input.replace(/ROLLBACK;\s*$/, "COMMIT;") : input);
  }
  const calibration = readFileSync(
    resolve("tests/infrastructure/supabase/possessionCalibration.postgres.sql"),
    "utf8"
  );
  const phases = calibration.split("-- AFTER_MIGRATION_047\n");
  if (phases.length !== 2) throw new Error("Missing calibration upgrade test boundary");
  sql("V1 scoring sample and saved history", phases[0]);
  sql(
    "Calibration migration 047",
    readFileSync(resolve("scripts/migrations/047_possession_rotation_calibration.sql"), "utf8")
  );
  sql("V2 calibration and history preservation", phases[1]);
  sql(
    "Concurrent day fixture",
    `
    INSERT INTO public.scheduled_games(id,game_id,game_date,home_team_id,away_team_id) VALUES (
      'a5000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000001',
      '2026-10-04','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
  `
  );
  const exec = promisify(execFile);
  const advance = `SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false);
    SELECT set_config('request.jwt.claim.role','authenticated',false);
    SELECT * FROM public.advance_simulation_day('a3000000-0000-4000-8000-000000000001','2026-10-03');`;
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
  sql(
    "Concurrent retry invariants",
    `DO $$ BEGIN
    ASSERT (SELECT count(*)=2 FROM public.game_box_scores), 'One box score per fixture';
    ASSERT (SELECT simulation_date='2026-10-04' FROM public.games WHERE id='a3000000-0000-4000-8000-000000000001'), 'Date advances once';
    ASSERT (SELECT sum(wins)=2 AND sum(losses)=2 FROM public.league_standings WHERE game_id='a3000000-0000-4000-8000-000000000001'), 'Standings advance once';
    ASSERT (SELECT payload->>'engineVersion'='possessions-v1' FROM public.game_box_scores WHERE scheduled_game_id='a5000000-0000-4000-8000-000000000002'), 'Stored v1 history remains v1';
    ASSERT (SELECT payload->>'engineVersion'='possessions-v2' FROM public.game_box_scores WHERE scheduled_game_id='a5000000-0000-4000-8000-000000000005'), 'Future games use v2';
  END; $$;`
  );
  const statisticsTests = readFileSync(
    resolve("tests/infrastructure/supabase/seasonStatistics.postgres.sql"),
    "utf8"
  );
  sql(
    "Season statistics upgrade, aggregation and owner isolation",
    statisticsTests.replace(
      "\\ir ../../../scripts/migrations/048_player_season_statistics.sql",
      () => readFileSync(resolve("scripts/migrations/048_player_season_statistics.sql"), "utf8")
    )
  );
  console.log("Possession engine and atomic daily integration verified in isolated PostgreSQL.");
} finally {
  docker(["rm", "-f", container]);
}
