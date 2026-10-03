import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
const expectedContainerId = "2dccfd47a5949b9675a47184e20d6db66ccaeb40ecd7a65b590f685284ccc0e7";
const database = "nba_gm_fa_tests";

if (containerId !== expectedContainerId) {
  throw new Error("Pass the explicitly authorized free-agency test container id.");
}

function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", ["--host", "unix:///var/run/docker.sock", ...args], {
    encoding: "utf8",
    input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${result.stderr.trim() || result.stdout.trim() || "Docker command failed"}`);
  }
  return result.stdout.trim();
}

const inspection = docker([
  "inspect",
  "--format",
  '{{.Config.Image}}|{{index .Config.Labels "purpose"}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.Tmpfs}}',
  containerId,
]);
const expectedInspection =
  'docker.io/library/postgres:17-alpine|nba-gm-free-agency-tests|none|{}|{"/var/lib/postgresql/data":"rw,noexec,nosuid,size=512m"}';
if (inspection !== expectedInspection) {
  throw new Error(`Test database isolation check failed: ${inspection}`);
}

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
  `DROP DATABASE IF EXISTS ${database}`,
]);
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlFiles = [
  "tests/infrastructure/supabase/freeAgencyPostgresBootstrap.sql",
  "scripts/migrations/020_free_agency_offers.sql",
  "tests/infrastructure/supabase/freeAgencyOffers.postgres.sql",
];
for (const sqlFile of sqlFiles) {
  const source = readFileSync(resolve(root, sqlFile), "utf8");
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
    source
  );
  console.log(`${sqlFile}: executed successfully`);
  if (output.length > 0) console.log(output);
}

console.log("Free-agency pending-offer PostgreSQL transaction invariants passed.");
