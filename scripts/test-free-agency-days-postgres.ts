import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
if (!containerId || !/^[a-f0-9]{64}$/u.test(containerId)) {
  throw new Error("Pass the full ID of the isolated fixture created for this run.");
}
const image =
  "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const phases = [
  ["027_free_agency_team_finances.sql", "freeAgencyTeamFinances.postgres.sql"],
  ["028_free_agency_offer_assessment.sql", "freeAgencyOfferAssessment.postgres.sql"],
  ["029_free_agency_daily_market.sql", "freeAgencyDailyMarket.postgres.sql"],
  ["030_free_agency_simulation_day.sql", "freeAgencySimulationDay.postgres.sql"],
  ["031_free_agency_market_read.sql", "freeAgencyMarketRead.postgres.sql"],
] as const;
const schemaOnly = process.argv[3] === "--schema-only";
const database = schemaOnly ? "nba_gm_free_agency_days_schema" : "nba_gm_free_agency_days";
function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", ["--host", "unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    input,
    timeout: 30000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const isolation = docker([
  "inspect",
  "--format",
  '{{.Config.Image}}|{{index .Config.Labels "purpose"}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.Tmpfs}}|{{json .HostConfig.Binds}}',
  containerId,
]);
if (
  isolation !==
  `${image}|nba-gm-free-agency-tests|none|{}|{"/var/lib/postgresql/data":"rw,noexec,nosuid,size=512m"}|null`
) {
  throw new Error("Fixture isolation check failed");
}
docker(["exec", containerId, "createdb", "-U", "postgres", database]);
function sql(label: string, input: string): void {
  docker(
    [
      "exec",
      "-i",
      containerId,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
    ],
    input
  );
  console.log(`${label}: passed`);
}
const file = (path: string) => readFileSync(resolve(root, path), "utf8");
sql(
  "Auth fixture",
  file("tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql")
);
const schema = file("scripts/schema.sql");
if (schemaOnly) {
  sql("Complete canonical schema through 031", schema);
  process.exit(0);
}
sql(
  "Canonical schema through 024",
  schema.slice(0, schema.indexOf("-- Canonical schema mirror for migration 025."))
);
const context = file("tests/infrastructure/supabase/freeAgencySigningContext.postgres.sql");
const marker = "-- AFTER_MIGRATION_025\n";
const phase = context.indexOf(marker);
if (phase < 0) throw new Error("Missing context fixture phase");
sql("Pre-025 payroll negative controls", context.slice(0, phase));
sql("Migration 025", file("scripts/migrations/025_free_agency_offer_resolution_state.sql"));
sql("Shared context fixture", context.slice(phase + marker.length));
sql("Migration 026", file("scripts/migrations/026_resolve_free_agency_offer.sql"));
const assertions = `
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
CREATE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement TEXT, message TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual TEXT;
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = MESSAGE_TEXT; END;
  IF actual IS NULL OR position(message IN actual) = 0 THEN RAISE EXCEPTION 'Expected %, got %', message, actual; END IF;
END $$;
`;
for (const [migration, fixture] of phases) {
  sql(`Migration ${migration}`, file(`scripts/migrations/${migration}`));
  sql(fixture, assertions + file(`tests/infrastructure/supabase/${fixture}`));
}

interface SqlProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}
function startSession(statement: string) {
  const child = spawn("docker", [
    "--host",
    "unix:///var/run/docker.sock",
    "exec",
    "-i",
    containerId,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
  ]);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data: Buffer) => {
    stdout += data.toString();
  });
  child.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });
  const done = new Promise<SqlProcessResult>((resolvePromise, rejectPromise) => {
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
  });
  child.stdin.end(`SET statement_timeout = '15s'; SET lock_timeout = '10s'; ${statement}`);
  return { done, output: () => stdout + stderr };
}
const concurrency = file("tests/infrastructure/supabase/freeAgencyDayConcurrency.postgres.sql");
const concurrencyMarker = "-- AFTER_CONCURRENT_DAYS\n";
const concurrencyPhase = concurrency.indexOf(concurrencyMarker);
if (concurrencyPhase < 0) throw new Error("Missing concurrency fixture boundary");
sql("Day concurrency baseline", assertions + concurrency.slice(0, concurrencyPhase));
const holder = startSession(
  "BEGIN; SELECT id FROM games WHERE id='40000000-0000-4000-8000-000000000002' FOR UPDATE; " +
    "SELECT 'fa-day-holder-ready'; SELECT pg_sleep(3); COMMIT;"
);
const holderDeadline = Date.now() + 5000;
while (!holder.output().includes("fa-day-holder-ready") && Date.now() < holderDeadline) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
}
if (!holder.output().includes("fa-day-holder-ready"))
  throw new Error("Day lock holder did not become ready");
const names = ["fa-day-race-a", "fa-day-race-b"];
const waiters = names.map((name) =>
  startSession(`SET application_name = '${name}'; SET ROLE authenticated;
  SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
  SELECT set_config('request.jwt.claim.role', 'authenticated', false);
  SELECT new_date FROM advance_simulation_day('40000000-0000-4000-8000-000000000002', '2026-10-02');`)
);
const observed = new Set<string>();
const waitDeadline = Date.now() + 5000;
while (observed.size < names.length && Date.now() < waitDeadline) {
  const waiting = docker([
    "exec",
    containerId,
    "psql",
    "-X",
    "-At",
    "-U",
    "postgres",
    "-d",
    database,
    "-c",
    "SELECT application_name FROM pg_stat_activity WHERE application_name IN ('fa-day-race-a','fa-day-race-b') " +
      "AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0",
  ]);
  for (const name of waiting.split("\n")) if (names.includes(name)) observed.add(name);
  if (observed.size < names.length)
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
}
const results = await Promise.all([holder.done, ...waiters.map((waiter) => waiter.done)]);
if (
  observed.size !== 2 ||
  results.some((result) => result.code !== 0) ||
  results.slice(1).some((result) => !result.stdout.includes("2026-10-03"))
) {
  throw new Error(
    `Concurrent day proof failed: waits=${[...observed]}, results=${JSON.stringify(results)}`
  );
}
console.log("Observed two real PostgreSQL game-lock waits for duplicate daily requests");
sql(
  "Concurrent day replay and provenance",
  assertions + concurrency.slice(concurrencyPhase + concurrencyMarker.length)
);
