import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const containerId = process.argv[2];
const baselineOnly = process.argv[3] === "--baseline-only";
const schemaOnly = process.argv[3] === "--schema-only";
const database = schemaOnly
  ? "nba_gm_signing_schema_tests"
  : baselineOnly
    ? "nba_gm_signing_red_tests"
    : "nba_gm_signing_transaction_tests";
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
const marker025 = "-- Canonical schema mirror for migration 025. Keep byte-identical below.\n";
const schemaEnd = schema.indexOf(marker025);
if (schemaEnd < 0) throw new Error("Canonical migration 025 baseline marker is missing");
const pre025Schema = schema.slice(0, schemaEnd);
const contextSql = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencySigningContext.postgres.sql"),
  "utf8"
);
const contextMarker = "-- AFTER_MIGRATION_025\n";
const contextPhase = contextSql.indexOf(contextMarker);
if (contextPhase < 0) throw new Error("Context migration phase is missing");
const signingSql = readFileSync(
  resolve(root, "tests/infrastructure/supabase/freeAgencySigning.postgres.sql"),
  "utf8"
);
const signingMarker = "-- AFTER_MIGRATION_026\n";
const signingPhase = signingSql.indexOf(signingMarker);
const beforeRaceMarker = "-- BEFORE_CONCURRENT_SIGNING\n";
const beforeRace = signingSql.indexOf(beforeRaceMarker);
const afterRaceMarker = "-- AFTER_CONCURRENT_SIGNING\n";
const afterRace = signingSql.indexOf(afterRaceMarker);
if (signingPhase < 0 || beforeRace < signingPhase || afterRace < beforeRace) {
  throw new Error("Signing SQL phases are missing or out of order");
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
  "Signing fixture auth bootstrap",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql"),
    "utf8"
  )
);
if (schemaOnly) {
  runSql("Complete canonical schema through migration 026", schema);
  process.exit(0);
}
runSql("Full canonical schema through migration 024", pre025Schema);
runSql("Context fixture pre-025 negative controls", contextSql.slice(0, contextPhase));
runSql(
  "Migration 025 shared authoritative context",
  readFileSync(
    resolve(root, "scripts/migrations/025_free_agency_offer_resolution_state.sql"),
    "utf8"
  )
);
runSql(
  "Context positive/negative assertions",
  contextSql.slice(contextPhase + contextMarker.length)
);
runSql("Pre-026 public writer denial control", signingSql.slice(0, signingPhase));
if (baselineOnly) {
  console.log("Signing baseline control passed before migration 026.");
  process.exit(0);
}
runSql(
  "Migration 026 atomic offer resolution",
  readFileSync(resolve(root, "scripts/migrations/026_resolve_free_agency_offer.sql"), "utf8")
);
runSql(
  "Signing authorization, due-date, eligibility, rollback, cap and roster assertions",
  signingSql.slice(signingPhase + signingMarker.length, beforeRace)
);
runSql(
  "Signing failure atomicity and resolution-time validation",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/freeAgencySigningValidation.postgres.sql"),
    "utf8"
  )
);

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

function startPsql(sql: string): { done: Promise<ProcessResult>; getOutput: () => string } {
  const child = spawn(
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
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const done = new Promise<ProcessResult>((resolvePromise, rejectPromise) => {
    child.on("error", rejectPromise);
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
  });
  child.stdin.end(sql);
  return { done, getOutput: () => stdout + stderr };
}

async function waitForMarker(process: { getOutput: () => string }, marker: string): Promise<void> {
  const deadline = Date.now() + 6000;
  while (!process.getOutput().includes(marker) && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  if (!process.getOutput().includes(marker)) throw new Error(`Lock holder did not reach ${marker}`);
}

async function waitForLock(tokens: readonly string[]): Promise<void> {
  const deadline = Date.now() + 8000;
  const observed = new Set<string>();
  while (observed.size !== tokens.length && Date.now() < deadline) {
    for (const token of tokens) {
      if (observed.has(token)) continue;
      const count = docker([
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
        `SELECT count(*) FROM pg_stat_activity WHERE query LIKE '%${token}%' AND wait_event_type = 'Lock'`,
      ]);
      if (Number(count) > 0) observed.add(token);
    }
    if (observed.size !== tokens.length)
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  if (observed.size !== tokens.length) {
    throw new Error(
      `Did not observe PostgreSQL Lock waits for every signer: ${[...observed].join(",")}`
    );
  }
}

function resolverSql(offerId: string, token: string): string {
  return (
    "SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false); " +
    "SELECT set_config('request.jwt.claim.role', 'authenticated', false); " +
    `/* ${token} */ SELECT r.status || '|' || COALESCE(r.resolved_contract_id::text, '') ` +
    "FROM public.resolve_free_agency_offer(" +
    `'40000000-0000-4000-8000-000000000002', '${offerId}') AS r;\n`
  );
}

const capTradeHolder = startPsql(
  "BEGIN; SET ROLE authenticated; " +
    "SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false); " +
    "SELECT set_config('request.jwt.claim.role', 'authenticated', false); " +
    "SELECT public.execute_trade_transactional(" +
    "'40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', " +
    "'20000000-0000-4000-8000-000000000002', " +
    '\'[{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000003","from_team_id":"20000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000018","from_team_id":"20000000-0000-4000-8000-000000000002"}]\'::jsonb); ' +
    "SELECT 'signing-cap-trade-lock-held'; SELECT pg_sleep(3); COMMIT;\n"
);
await waitForMarker(capTradeHolder, "signing-cap-trade-lock-held");
const capTokens = ["signing-cap-wait-004", "signing-cap-wait-005"];
const capWaiters = [
  startPsql(resolverSql("60000000-0000-4000-8000-000000000004", capTokens[0])),
  startPsql(resolverSql("60000000-0000-4000-8000-000000000005", capTokens[1])),
];
await waitForLock(capTokens);
const capResults = await Promise.all(capWaiters.map(({ done }) => done));
const capTradeResult = await capTradeHolder.done;
if (capTradeResult.code !== 0)
  throw new Error(`Cap-changing trade failed: ${capTradeResult.stderr}`);
if (
  capResults.some(({ code, stderr }) => code === 0 || !stderr.includes("Offer exceeds cap room"))
) {
  throw new Error(
    `A signer failed to revalidate finances after its game-lock wait: ${JSON.stringify(capResults)}`
  );
}
console.log("Trade interleave proof: both waiting signers rejected the post-trade over-cap offer");
runSql(
  "Post-trade signing rollback assertions",
  `SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
   DO $$ BEGIN
     IF (SELECT payroll FROM public.get_free_agency_financial_context('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000005')) <> 171000000 THEN
       RAISE EXCEPTION 'Trade payroll change was not reflected by the private context';
     END IF;
     IF (SELECT count(*) FROM free_agency_pending_offers WHERE game_id='40000000-0000-4000-8000-000000000002' AND player_id='30000000-0000-4000-8000-000000000005' AND status='pending') <> 3
       OR EXISTS (SELECT 1 FROM game_runtime_contracts WHERE game_id='40000000-0000-4000-8000-000000000002' AND player_id='30000000-0000-4000-8000-000000000005')
       OR (SELECT team_id FROM game_player_states WHERE game_id='40000000-0000-4000-8000-000000000002' AND player_id='30000000-0000-4000-8000-000000000005') IS NOT NULL THEN
       RAISE EXCEPTION 'Cap-failed signing partially changed offer, contract or roster state';
     END IF;
   END $$;`
);
runSql(
  "Reverse the cap-changing fixture trade",
  "SET ROLE authenticated; " +
    "SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false); " +
    "SELECT set_config('request.jwt.claim.role', 'authenticated', false); " +
    "SELECT public.execute_trade_transactional(" +
    "'40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', " +
    "'20000000-0000-4000-8000-000000000002', " +
    '\'[{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000018","from_team_id":"20000000-0000-4000-8000-000000000001"},{"asset_type":"player","asset_id":"30000000-0000-4000-8000-000000000003","from_team_id":"20000000-0000-4000-8000-000000000002"}]\'::jsonb); RESET ROLE;'
);
runSql(
  "Pre-signing full snapshot baseline after trade reversion",
  signingSql.slice(beforeRace + beforeRaceMarker.length, afterRace)
);

const raceHolder = startPsql(
  "BEGIN; SELECT id FROM games WHERE id='40000000-0000-4000-8000-000000000002' FOR UPDATE; " +
    "SELECT 'signing-race-game-lock-held'; SELECT pg_sleep(3); COMMIT;\n"
);
await waitForMarker(raceHolder, "signing-race-game-lock-held");
const raceTokens = ["signing-race-004", "signing-race-005"];
const raceWaiters = [
  startPsql(resolverSql("60000000-0000-4000-8000-000000000004", raceTokens[0])),
  startPsql(resolverSql("60000000-0000-4000-8000-000000000005", raceTokens[1])),
];
await waitForLock(raceTokens);
const raceResults = await Promise.all(raceWaiters.map(({ done }) => done));
const raceLockResult = await raceHolder.done;
if (raceLockResult.code !== 0)
  throw new Error(`Signing race lock holder failed: ${raceLockResult.stderr}`);
const raceStatuses = raceResults.map(({ code, stdout }) => {
  if (code !== 0) throw new Error(`Concurrent resolution failed: ${stdout}`);
  const match = stdout.match(/\b(accepted|rejected)\|([a-f0-9-]*)(?=\s|$)/iu);
  if (!match) throw new Error(`Missing persisted signing result: ${stdout}`);
  return match[1];
});
if (
  raceStatuses.filter((status) => status === "accepted").length !== 1 ||
  raceStatuses.filter((status) => status === "rejected").length !== 1
) {
  throw new Error(
    `Expected one concurrent accepted and one rejected offer, got ${raceStatuses.join(",")}`
  );
}
console.log(
  "Concurrent signing proof: two PostgreSQL Lock waits, one accepted offer and one persisted rejection"
);
runSql(
  "Atomic replay, snapshots and runtime-only trade assertions",
  signingSql.slice(afterRace + afterRaceMarker.length)
);
runSql(
  "Exact terminal replay after trade and immutable agreement checks",
  readFileSync(
    resolve(root, "tests/infrastructure/supabase/freeAgencySigningReplay.postgres.sql"),
    "utf8"
  )
);
