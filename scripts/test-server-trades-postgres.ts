import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
if (args[0] !== "--local-only" || args.length > 2 || (args[1] && args[1] !== "--baseline")) {
  throw new Error(
    "Usage: bun run --no-env-file scripts/test-server-trades-postgres.ts --local-only [--baseline]"
  );
}
const image =
  "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24";
const root = new URL("../", import.meta.url);
const dockerArgs = ["--host", "unix:///var/run/docker.sock"];
function docker(args: string[], input?: string) {
  const result = spawnSync("docker", [...dockerArgs, ...args], {
    input,
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || "Local Docker command failed");
  return result.stdout.trim();
}
const container = docker([
  "create",
  "--pull=never",
  "--network=none",
  "--label",
  "purpose=nba-gm-phase2-trades",
  "--tmpfs",
  "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
  "-e",
  "POSTGRES_HOST_AUTH_METHOD=trust",
  image,
]);
if (!/^[a-f0-9]{64}$/.test(container)) throw new Error("Invalid local fixture identity");
const psqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-h",
  "127.0.0.1",
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const sql = (text: string) => docker(psqlArgs, text);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");
const migrations = [
  "20260206190001_initial_schema.sql",
  "20260206190014_enable_rls.sql",
  "20261102170000_reconcile_legacy_through_056.sql",
  "20261104190000_modern_contract_trade_compatibility.sql",
];

try {
  docker(["start", container]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    // The image's temporary init server is socket-only; wait for the final TCP listener.
    const result = spawnSync(
      "docker",
      [...dockerArgs, "exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
      { stdio: "ignore" }
    );
    if (result.status === 0) {
      ready = true;
      break;
    }
    await delay(100);
  }
  if (!ready) throw new Error("Local fixture did not become ready");
  sql(
    source("tests/infrastructure/supabase/freeAgencyWriteIntegrityPostgresBootstrap.sql") +
      "\nCREATE ROLE supabase_admin NOLOGIN; CREATE SCHEMA extensions;\n"
  );
  for (const migration of migrations) sql(source(`supabase/migrations/${migration}`));
  sql(source("tests/infrastructure/supabase/serverTradesFixture.postgres.sql"));
  if (args[1] !== "--baseline")
    sql(source("supabase/migrations/20261110100000_authoritative_trade_boundary.sql"));
  sql(source("tests/infrastructure/supabase/serverTrades.postgres.sql"));
  sql(source("tests/infrastructure/supabase/serverTradesVerifier.postgres.sql"));
  console.log(
    "PASS: active-chain replay, RPC rejection/state hashes, pick transfer and unchanged contracts"
  );

  const call =
    "SELECT public.execute_trade_authoritative('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','" +
    JSON.stringify([
      {
        asset_type: "pick",
        asset_id: "a6000000-0000-4000-8000-000000000001",
        from_team_id: "a1000000-0000-4000-8000-000000000001",
      },
      {
        asset_type: "pick",
        asset_id: "a6000000-0000-4000-8000-000000000002",
        from_team_id: "a1000000-0000-4000-8000-000000000002",
      },
    ]) +
    "'::jsonb);\n";
  const session =
    "SET ROLE authenticated; SET request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001'; SET request.jwt.claim.role='authenticated'; SET statement_timeout='5s';\n";
  function concurrentSql(
    text: string,
    onOutput?: (output: string) => void
  ): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", [...dockerArgs, ...psqlArgs], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        onOutput?.(output);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, output }));
      child.stdin.end(text);
    });
  }
  let contender: Promise<{ code: number | null; output: string }> | undefined;
  const winner = await concurrentSql(
    `${session}BEGIN;\n${call}\\echo TRADE_LOCK_HELD\nSELECT pg_sleep(1); COMMIT;\n`,
    (output) => {
      if (!contender && output.includes("TRADE_LOCK_HELD"))
        contender = concurrentSql(session + call);
    }
  );
  if (!contender) throw new Error("Concurrency barrier was not reached");
  const loser = await contender;
  if (winner.code !== 0 || loser.code === 0 || !loser.output.includes("STALE_ASSET"))
    throw new Error("Concurrent trades did not produce one winner and one stale rejection");
  sql(
    "DO $$ BEGIN IF (SELECT count(*) FROM executed_trades) <> 1 OR (SELECT count(*) FROM trade_asset_snapshots) <> 2 THEN RAISE EXCEPTION 'Concurrency history mismatch'; END IF; END $$;"
  );
  console.log(
    "PASS: concurrent authenticated trades serialize; one transfer and one stale rejection"
  );

  let afterStateChange: Promise<{ code: number | null; output: string }> | undefined;
  const stateWriter = await concurrentSql(
    session +
      "BEGIN; SELECT id FROM games WHERE id='a3000000-0000-4000-8000-000000000001' FOR UPDATE; UPDATE games SET status='archived' WHERE id='a3000000-0000-4000-8000-000000000001';\n\\echo STATE_LOCK_HELD\nSELECT pg_sleep(1); COMMIT;\n",
    (output) => {
      if (!afterStateChange && output.includes("STATE_LOCK_HELD"))
        afterStateChange = concurrentSql(session + call);
    }
  );
  if (!afterStateChange) throw new Error("State-writer barrier was not reached");
  const blockedTrade = await afterStateChange;
  if (
    stateWriter.code !== 0 ||
    blockedTrade.code === 0 ||
    !blockedTrade.output.includes("GAME_NOT_ACTIVE")
  )
    throw new Error("Trade did not revalidate authoritative state after waiting for the game lock");
  console.log("PASS: trade revalidates game state after concurrent game-first writer");
} finally {
  docker(["rm", "--force", container]);
  console.log("Local disposable fixture removed");
}
