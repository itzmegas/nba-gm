import { execFile, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const schema = readFileSync("scripts/schema.sql", "utf8");
const migration = readFileSync("scripts/migrations/054_offseason_contracts.sql", "utf8");
const marker = "-- Canonical schema mirror for migration 054. Keep byte-identical below.\n";
const sections = schema.split(marker);
if (
  sections.length !== 2 ||
  sections[1]?.split("-- End canonical schema mirror for migration 054.\n")[0] !== migration
)
  throw new Error("Migration 054 mirror differs");
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
  "-d",
  "postgres:17-alpine",
]);
const psql = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres"];
const sql = (input: string) => docker(["exec", "-i", container, ...psql], input);
const auth = `SET ROLE authenticated;
 SET request.jwt.claim.sub='c0000000-0000-4000-8000-000000000001';
 SET request.jwt.claim.role='authenticated';`;
const decision = `${auth} SELECT to_jsonb(public.decide_offseason_team_option(
 'c3000000-0000-4000-8000-000000000001',2026,'c2000000-0000-4000-8000-000000000001','exercise'));`;
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    if (
      spawnSync("docker", [
        "exec",
        container,
        "sh",
        "-c",
        "grep -qx postgres /proc/1/comm && pg_isready -U postgres",
      ]).status === 0
    ) {
      ready = true;
      break;
    }
    await setTimeout(100);
  }
  if (!ready) throw new Error("PostgreSQL did not become ready");
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;`);
  sql(sections[0] ?? "");
  sql("GRANT SELECT ON public.games TO authenticated;");
  const fixture = readFileSync(
    "tests/infrastructure/supabase/offseasonEntry.postgres.sql",
    "utf8"
  ).split("-- AFTER_MIGRATION_053\n")[0];
  sql(`${fixture}
    INSERT INTO public.postseason_results SELECT game_id,season_year,id,home_team_id,away_team_id,DATE '2027-06-10' FROM public.postseason_series;
    CREATE TEMP TABLE before_054 AS SELECT public.test_offseason_history() snapshot;
    ${migration}
    DO $$ BEGIN ASSERT public.test_offseason_history()-'game_offseason_contracts'=(SELECT snapshot FROM before_054), 'Installation preserves every original table'; END $$;
    ${readFileSync("tests/infrastructure/supabase/offseasonContracts.postgres.sql", "utf8")}`);
  const history = sql("SELECT public.test_offseason_history();");
  const exec = promisify(execFile);
  const holder = exec(
    "docker",
    [
      "exec",
      container,
      ...psql,
      "-c",
      "BEGIN; SELECT id FROM public.games FOR UPDATE; SELECT pg_sleep(2); COMMIT;",
    ],
    { timeout: 120_000 }
  );
  for (let n = 0; n < 100; n++) {
    if (sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep';") === "1") break;
    await setTimeout(10);
  }
  const requests = [0, 1].map((n) =>
    exec("docker", ["exec", "-e", `PGAPPNAME=option-${n}`, container, ...psql, "-c", decision], {
      timeout: 120_000,
    })
  );
  let waiting = false;
  for (let n = 0; n < 100; n++) {
    if (
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'option-%' AND wait_event_type='Lock';"
      ) === "2"
    ) {
      waiting = true;
      break;
    }
    await setTimeout(10);
  }
  const results = await Promise.all([holder, ...requests]);
  if (!waiting || results[1]?.stdout !== results[2]?.stdout)
    throw new Error("Concurrent retries differ");
  if (sql(decision) !== results[1]?.stdout.trim()) throw new Error("Later retry differs");
  sql(`${auth} SELECT public.test_offseason_error($q$${decision.replace("'exercise'", "'decline'")}$q$,
    'Team option decision is immutable');`);
  if (sql("SELECT public.test_offseason_history();") !== history)
    throw new Error("Original tables changed");
  console.log(
    "Migration mirror, classification, released/re-signed runtime, traded canonical ownership, guards, RLS, immutable retries, rollback, concurrent lock waits and original-table equality passed."
  );
} finally {
  docker(["rm", "-f", container]);
}
