import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Docker failed");
  return result.stdout.trim();
}

const schema = readFileSync("scripts/schema.sql", "utf8");
const migration = readFileSync("scripts/migrations/053_offseason_entry.sql", "utf8");
const marker = "-- Canonical schema mirror for migration 053. Keep byte-identical below.\n";
const endMarker = "-- End canonical schema mirror for migration 053.\n";
const sections = schema.split(marker);
const mirror = sections[1]?.split(endMarker);
if (sections.length !== 2 || mirror?.length !== 2 || mirror[0] !== migration) {
  throw new Error("Migration 053 canonical mirror is missing, duplicated or not byte-identical");
}
const phases = readFileSync(
  "tests/infrastructure/supabase/offseasonEntry.postgres.sql",
  "utf8"
).split("-- AFTER_MIGRATION_053\n");
if (phases.length !== 2) throw new Error("Missing offseason upgrade boundary");
console.log("Migration 053 canonical mirror: byte-identical.");

// This runner owns only its new container: no ports, host mounts, secrets or external network.
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
  "purpose=nba-gm-offseason-entry-tests",
  "-d",
  "postgres:17-alpine",
]);
const psql = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres"];
function sql(input: string): string {
  return docker(["exec", "-i", container, ...psql], input);
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
  sql(sections[0]);
  sql("GRANT SELECT ON public.games TO authenticated;");
  // One connection keeps temporary before/after snapshots across the migration.
  sql(phases[0] + migration + phases[1]);
  console.log(
    "Installation, championship gate, retry, null/stale year, access control, RLS, rollback, terminal daily advance and full-table history preservation: passed."
  );

  const history = sql("SELECT public.test_offseason_history();");
  const entry = `SET ROLE authenticated;
    SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
    SET request.jwt.claim.role='authenticated';
    SELECT public.enter_offseason('c3000000-0000-4000-8000-000000000001',2026);`;
  const exec = promisify(execFile);
  // Hold the same game-row lock first so both independent requests demonstrably overlap.
  const holder = exec(
    "docker",
    [
      "exec",
      container,
      ...psql,
      "-c",
      `BEGIN; SELECT id FROM public.games FOR UPDATE; SELECT pg_sleep(2); COMMIT;`,
    ],
    { timeout: 120_000 }
  );
  let locked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep';") === "1") {
      locked = true;
      break;
    }
    await setTimeout(10);
  }
  if (!locked) throw new Error("Concurrency fixture did not acquire the game lock");
  const requests = [0, 1].map((n) =>
    exec(
      "docker",
      ["exec", "-e", `PGAPPNAME=offseason-entry-${n}`, container, ...psql, "-c", entry],
      { timeout: 120_000 }
    )
  );
  let waiting = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'offseason-entry-%' AND wait_event_type='Lock';"
      ) === "2"
    ) {
      waiting = true;
      break;
    }
    await setTimeout(10);
  }
  const outcomes = await Promise.allSettled([holder, ...requests]);
  if (!waiting || outcomes.some((result) => result.status !== "fulfilled")) {
    throw new Error(`Concurrent entry failed: overlap=${waiting}, ${JSON.stringify(outcomes)}`);
  }
  const persisted = sql(`SELECT jsonb_build_object('seasonYear',season_year,'enteredAt',entered_at)
    FROM public.game_offseasons;`);
  for (const request of outcomes.slice(1)) {
    if (request.status !== "fulfilled" || request.value.stdout.trim() !== persisted) {
      throw new Error("Concurrent entries did not return the same persisted marker/timestamp");
    }
  }
  if (sql(entry) !== persisted) throw new Error("Later transaction changed the entry timestamp");
  sql(`DO $$ BEGIN
    ASSERT (SELECT count(*)=1 FROM public.game_offseasons), 'Exactly one concurrent marker';
  END $$;
  SET ROLE authenticated;
  SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
  SET request.jwt.claim.role='authenticated';
  SELECT * FROM public.advance_simulation_day('c3000000-0000-4000-8000-000000000001','2027-06-10');`);
  if (sql("SELECT public.test_offseason_history();") !== history) {
    throw new Error("Concurrent entry/replay/daily advance changed existing data");
  }
  console.log(
    "Two observed lock-waiting connections returned one marker/timestamp; later replay and terminal daily advance preserved all existing tables: passed."
  );
} finally {
  docker(["rm", "-f", container]);
}
