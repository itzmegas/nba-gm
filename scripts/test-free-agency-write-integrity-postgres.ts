import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
const database = "nba_gm_write_integrity_tests";
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
const marker022 = "-- Canonical schema mirror for migration 022. Keep byte-identical below.\n";
const before022 = schema.indexOf(marker022);
if (before022 < 0) throw new Error("Canonical migration 022 marker is missing");
const pre022Schema = schema.slice(0, before022);
const ownershipSql = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencyContractOwnership.postgres.sql"),
  "utf8"
);
const ownershipMarker = "-- AFTER_MIGRATION_022\n";
const ownershipSplit = ownershipSql.indexOf(ownershipMarker);
if (ownershipSplit < 0) throw new Error("Ownership proof migration boundary is missing");
const writeSql = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencyWriteIntegrity.postgres.sql"),
  "utf8"
);
const writeMarker = "-- AFTER_MIGRATION_023\n";
const writeSplit = writeSql.indexOf(writeMarker);
if (writeSplit < 0) throw new Error("Write-integrity proof migration boundary is missing");
const tradeSql = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencyTradeSerialization.postgres.sql"),
  "utf8"
);
const migrations = [
  ["022 contract ownership", "scripts/migrations/022_free_agency_contract_ownership.sql"],
  ["023 direct-write integrity", "scripts/migrations/023_free_agency_write_integrity.sql"],
  ["024 trade serialization", "scripts/migrations/024_free_agency_trade_serialization.sql"],
] as const;

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
  "Fixture bootstrap",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql"),
    "utf8"
  )
);
runSql("Full canonical schema through migration 021", pre022Schema);
runSql("Ownership pre-migration FK negative control", ownershipSql.slice(0, ownershipSplit));
runSql("Migration 022 contract ownership", readFileSync(resolve(root, migrations[0][1]), "utf8"));
runSql(
  "Ownership post-migration restricted-FK proof",
  ownershipSql.slice(ownershipSplit + ownershipMarker.length)
);
runSql("Direct-write pre-migration negative control", writeSql.slice(0, writeSplit));
runSql(
  "Migration 023 direct-write integrity",
  readFileSync(resolve(root, migrations[1][1]), "utf8")
);
runSql(
  "Direct-write guards, owner isolation, and lifecycle proof",
  writeSql.slice(writeSplit + writeMarker.length)
);
runSql(
  "Migration 024 game-first trade serialization",
  readFileSync(resolve(root, migrations[2][1]), "utf8")
);
runSql("Trade snapshots and bidirectional ownership proof", tradeSql);

const blocker = spawn(
  "docker",
  [
    "--host",
    "unix:///var/run/docker.sock",
    "exec",
    "-i",
    containerId,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    database,
  ],
  { stdio: ["pipe", "pipe", "pipe"] }
);
let blockerOutput = "";
let blockerError = "";
blocker.stdout.on("data", (chunk: Buffer) => {
  blockerOutput += chunk.toString();
});
blocker.stderr.on("data", (chunk: Buffer) => {
  blockerError += chunk.toString();
});
const blockerDone = new Promise<void>((resolvePromise, rejectPromise) => {
  blocker.on("error", rejectPromise);
  blocker.on("close", (code) => {
    if (code === 0) resolvePromise();
    else rejectPromise(new Error(blockerError || `Game-row lock holder exited ${code}`));
  });
});
blocker.stdin.end(
  "BEGIN; SELECT id FROM games WHERE id = '40000000-0000-4000-8000-000000000001' FOR UPDATE; " +
    "SELECT 'trade-serialization-lock-held'; SELECT pg_sleep(3); COMMIT;\n"
);
const holderDeadline = Date.now() + 5000;
while (!blockerOutput.includes("trade-serialization-lock-held") && Date.now() < holderDeadline) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
}
if (!blockerOutput.includes("trade-serialization-lock-held")) {
  throw new Error(`Lock holder did not acquire the game row: ${blockerError}`);
}

const waiter = spawn(
  "docker",
  [
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
  ],
  { stdio: ["pipe", "pipe", "pipe"] }
);
let waiterError = "";
waiter.stderr.on("data", (chunk: Buffer) => {
  waiterError += chunk.toString();
});
const waiterDone = new Promise<number>((resolvePromise, rejectPromise) => {
  waiter.on("error", rejectPromise);
  waiter.on("close", (code) => resolvePromise(code ?? -1));
});
waiter.stdin.end(
  "SET ROLE authenticated; " +
    "SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false); " +
    "SELECT set_config('request.jwt.claim.role', 'authenticated', false); " +
    "/* free-agency-trade-lock-probe */ SELECT public.execute_trade_transactional(" +
    "'40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', " +
    "'20000000-0000-4000-8000-000000000002', '[]'::jsonb);\n"
);

let observedLockWait = false;
const waitDeadline = Date.now() + 5000;
while (!observedLockWait && Date.now() < waitDeadline) {
  observedLockWait =
    docker([
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
      "SELECT wait_event_type FROM pg_stat_activity WHERE query LIKE '%free-agency-trade-lock-probe%' AND wait_event_type = 'Lock'",
    ]) === "Lock";
  if (!observedLockWait) await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
}
const waiterCode = await waiterDone;
await blockerDone;
if (
  !observedLockWait ||
  waiterCode === 0 ||
  !waiterError.includes("A trade requires assets from both teams")
) {
  throw new Error(
    `Trade lock-wait proof failed (observed=${observedLockWait}, exit=${waiterCode}): ${waiterError}`
  );
}
console.log("PostgreSQL Lock wait observed on game row before trade validation");
