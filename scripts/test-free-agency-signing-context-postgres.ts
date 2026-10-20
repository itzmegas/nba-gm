import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
const baselineOnly = process.argv[3] === "--baseline-only";
const database = baselineOnly
  ? "nba_gm_signing_context_red_tests"
  : "nba_gm_signing_context_green_tests";
const image =
  "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24";
if (!containerId || !/^[a-f0-9]{64}$/u.test(containerId)) {
  throw new Error("Pass the full ID of the isolated fixture created for this run.");
}

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", ["--host", "unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Docker command failed");
  }
  return result.stdout.trim();
}

const isolation = docker([
  "inspect",
  "--format",
  '{{.Config.Image}}|{{index .Config.Labels "purpose"}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.Tmpfs}}|{{json .HostConfig.Binds}}',
  containerId,
]);
const expectedIsolation = `${image}|nba-gm-free-agency-tests|none|{}|{"/var/lib/postgresql/data":"rw,noexec,nosuid,size=512m"}|null`;
if (isolation !== expectedIsolation)
  throw new Error(`Fixture isolation check failed: ${isolation}`);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(resolve(root, "scripts/schema.sql"), "utf8");
const baselineMarker = "-- End canonical schema mirror for migration 024.\n";
const baselineEnd = schema.indexOf(baselineMarker);
if (baselineEnd < 0) throw new Error("Canonical migration 024 baseline boundary is missing");
const pre025Schema = schema.slice(0, baselineEnd + baselineMarker.length);
const scenarios = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencySigningContext.postgres.sql"),
  "utf8"
);
const phaseMarker = "-- AFTER_MIGRATION_025\n";
const phase = scenarios.indexOf(phaseMarker);
if (phase < 0) throw new Error("Signing-context SQL phase boundary is missing");

docker([
  "exec",
  containerId,
  "psql",
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-c",
  `CREATE DATABASE ${database}`,
]);

function runSql(label: string, sql: string): void {
  const output = docker(
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
    sql
  );
  console.log(`${label}: passed`);
  if (output.length > 0) console.log(output);
}

runSql(
  "Signing context fixture bootstrap",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql"),
    "utf8"
  )
);
runSql("Full canonical schema through migration 024", pre025Schema);
runSql("Functional pre-025 financial-context RED controls", scenarios.slice(0, phase));
if (baselineOnly) {
  console.log(
    "Functional RED observed: unknown salaries accepted and runtime-overlay payroll miscounted"
  );
} else {
  const migration = readFileSync(
    resolve(root, "scripts/migrations/025_free_agency_offer_resolution_state.sql"),
    "utf8"
  );
  runSql("Migration 025 shared signing context and resolution state", migration);
  runSql(
    "Shared financial context, pending replay and terminal replay assertions",
    scenarios.slice(phase + phaseMarker.length)
  );
}
