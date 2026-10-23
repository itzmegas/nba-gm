import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
const expectedId = "8e53ae3e3837c893523abab3aa3f262770e574ab1c6eaae0568e941592aa7d1b";
if (containerId !== expectedId) {
  throw new Error("Pass the explicitly authorized player-attributes test container id.");
}

const dockerPrefix = ["--host", "unix:///var/run/docker.sock"];
function docker(args: string[], input?: string): string {
  const result = spawnSync("docker", [...dockerPrefix, ...args], { encoding: "utf8", input });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Docker command failed");
  }
  return result.stdout.trim();
}

const inspection = docker([
  "inspect",
  "--format",
  '{{.Config.Image}}|{{index .Config.Labels "purpose"}}|{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.Tmpfs}}|{{json .HostConfig.Binds}}',
  containerId,
]);
const expectedInspection =
  'postgres:17-alpine|nba-gm-attributes-tests|none|{}|{"/var/lib/postgresql/data":"rw,noexec,nosuid,size=256m"}|null';
if (inspection !== expectedInspection) {
  throw new Error(`Isolated PostgreSQL fixture check failed: ${inspection}`);
}

const database = `player_attrs_${randomUUID().replaceAll("-", "")}`;
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
function runSql(label: string, sql: string): void {
  const result = docker(
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
  if (result.length > 0) console.log(result);
}

runSql(
  "Supabase authentication fixture",
  `CREATE EXTENSION IF NOT EXISTS pgcrypto;
   DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   ALTER ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth;
   CREATE TABLE auth.users(id UUID PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
     SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
   $$;
   CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
     SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
   $$;
   GRANT USAGE ON SCHEMA auth TO authenticated;`
);
runSql(
  "Canonical schema and migrations 037-042",
  readFileSync(resolve(root, "scripts/schema.sql"), "utf8")
);
runSql(
  "Owned modern game fixtures",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/playerAttributesFullBootstrap.postgres.sql"),
    "utf8"
  )
);

for (const [label, path] of [
  [
    "Shared source cache RLS/lease/version tests",
    "tests/infrastructure/supabase/playerRatingCache.postgres.sql",
  ],
  [
    "Career attribute constraints and RLS tests",
    "tests/infrastructure/supabase/gamePlayerAttributes.postgres.sql",
  ],
  [
    "Transactional materialization RPC tests",
    "tests/infrastructure/supabase/gamePlayerAttributesMaterialize.postgres.sql",
  ],
  [
    "Initializing free-agent bootstrap tests",
    "tests/infrastructure/supabase/initializingFreeAgentBootstrap.postgres.sql",
  ],
  [
    "Initialization rollback tests",
    "tests/infrastructure/supabase/gameAttributeRollback.postgres.sql",
  ],
  [
    "Daily SQL attribute strength and legacy compatibility",
    "tests/infrastructure/supabase/playerAttributeSimulation.postgres.sql",
  ],
] as const) {
  runSql(label, readFileSync(resolve(root, path), "utf8"));
}

async function verifyConcurrentRefreshLease(): Promise<void> {
  const psql = [
    ...dockerPrefix,
    "exec",
    "-i",
    containerId,
    "psql",
    "-X",
    "-q",
    "-t",
    "-A",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    database,
  ];
  const owner = spawn("docker", psql, { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  let errors = "";
  let competitor: Promise<string> | undefined;
  owner.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    if (!competitor && output.split("\n").some((line) => line.trimStart().startsWith("{"))) {
      competitor = new Promise((resolve, reject) => {
        const child = spawn("docker", psql, { stdio: ["pipe", "pipe", "pipe"] });
        let result = "";
        let error = "";
        child.stdout.on("data", (data: Buffer) => {
          result += data.toString();
        });
        child.stderr.on("data", (data: Buffer) => {
          error += data.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve(result) : reject(new Error(error))));
        child.stdin.end(
          "SET ROLE service_role; SELECT public.acquire_player_rating_refresh('2K27'); RESET ROLE;"
        );
      });
    }
  });
  owner.stderr.on("data", (chunk: Buffer) => {
    errors += chunk.toString();
  });
  const completed = new Promise<void>((resolve, reject) => {
    owner.on("error", reject);
    owner.on("close", (code) => (code === 0 ? resolve() : reject(new Error(errors))));
  });
  owner.stdin.end(
    "BEGIN; SET LOCAL ROLE service_role; SELECT public.acquire_player_rating_refresh('2K27'); SELECT pg_sleep(1); COMMIT; RESET ROLE;"
  );
  await completed;
  if (!competitor) throw new Error("Concurrent cache reader did not start");
  const parse = (text: string) =>
    JSON.parse(text.split("\n").find((line) => line.trimStart().startsWith("{")) ?? "null");
  const first = parse(output);
  const second = parse(await competitor);
  if (!first?.lease_id || second?.lease_id !== null || second?.refresh_in_progress !== true) {
    throw new Error(
      `Concurrent refresh lease invariant failed: ${JSON.stringify({ first, second })}`
    );
  }
  console.log("Concurrent refresh coordination: passed (one lease owner).");
}

await verifyConcurrentRefreshLease();
console.log(`Player-attributes PostgreSQL suite passed in isolated database ${database}.`);
