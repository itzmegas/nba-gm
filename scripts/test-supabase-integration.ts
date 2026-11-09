import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GAME_STATUS, gameSchema } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import {
  createTestFetch,
  readIntegrationConfig,
  TEST_FIXTURE,
  TEST_PROJECT_REF,
} from "@/infrastructure/supabase/integrationSafety";

function check(value: unknown, label: string): asserts value {
  console.log(`${value ? "PASS" : "FAIL"} ${label}`);
  if (!value) throw new Error("Integration assertion failed");
}

async function main() {
  if (process.argv[2] !== TEST_PROJECT_REF) {
    console.error("FAIL explicit TEST project confirmation required; dedicated config not read");
    process.exitCode = 1;
    return;
  }
  const config = readIntegrationConfig(
    parseEnv(await readFile(".env.test.local", "utf8")),
    process.argv[2]
  );
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createTestFetch(config.url, console.log) },
  };
  const admin = createClient(config.url, config.serviceRoleKey, options);
  const owner = createClient(config.url, config.publishableKey, options);
  const other = createClient(config.url, config.publishableKey, options);
  const anonymous = createClient(config.url, config.publishableKey, options);
  const users: string[] = [];
  let teamCreated = false;
  let cleanupFailed = false;
  const userSchema = z.object({
    id: z.uuid(),
    app_metadata: z.object({ courtside_test_fixture: z.literal("phase1-v1") }),
  });
  const tables = ["games", "teams", "draft_picks", "game_pick_inventory"] as const;
  try {
    const authHealth = await options.global.fetch(`${config.url}/auth/v1/health`, {
      headers: { apikey: config.publishableKey },
    });
    check(authHealth.status === 200, "Auth health");
    const restHealth = await anonymous.from("teams").select("id", { head: true });
    check(
      !restHealth.error && restHealth.status === 200,
      "PostgREST health through anonymous SDK HEAD"
    );
    for (const table of tables) {
      const result = await admin.from(table).select("id", { head: true, count: "exact" });
      check(!result.error && result.count === 0, `${table} starts empty`);
    }
    for (const id of [TEST_FIXTURE.ownerId, TEST_FIXTURE.otherId]) {
      const result = await admin.auth.admin.getUserById(id);
      check(result.error?.status === 404, "fixture account does not already exist");
    }
    for (const [id, email, client] of [
      [TEST_FIXTURE.ownerId, "courtside-phase1-owner@example.invalid", owner],
      [TEST_FIXTURE.otherId, "courtside-phase1-other@example.invalid", other],
    ] as const) {
      const password = randomBytes(32).toString("base64url");
      const created = await admin.auth.admin.createUser({
        id,
        email,
        password,
        email_confirm: true,
        app_metadata: { courtside_test_fixture: "phase1-v1" },
      });
      check(!created.error, "create synthetic Auth account without sending email");
      check(userSchema.parse(created.data.user).id === id, "synthetic account identity");
      users.push(id);
      const signedIn = await client.auth.signInWithPassword({ email, password });
      check(!signedIn.error && signedIn.data.user?.id === id, "synthetic password sign-in");
    }
    const team = await admin
      .from("teams")
      .insert({
        id: TEST_FIXTURE.teamId,
        nba_id: -900001,
        name: "Synthetic Test Team",
        city: "Fixture City",
        abbreviation: "TST",
      })
      .select("id")
      .single();
    check(!team.error, "insert synthetic team");
    check(
      z.object({ id: z.literal(TEST_FIXTURE.teamId) }).safeParse(team.data).success,
      "team identity"
    );
    teamCreated = true;

    const repository = new SupabaseGameRepository(owner);
    const game = gameSchema.parse(
      await repository.create({
        userId: TEST_FIXTURE.ownerId,
        name: "Courtside Phase 1 Synthetic Game",
        selectedTeamId: TEST_FIXTURE.teamId,
        seasonYear: TEST_FIXTURE.seasonYear,
        seasonEraId: "modern",
        simulationDate: new Date("2026-10-01T00:00:00Z"),
        status: GAME_STATUS.INITIALIZING,
      })
    );
    const persisted = gameSchema.parse(await repository.getById(game.id));
    check(
      persisted.id === game.id && persisted.userId === TEST_FIXTURE.ownerId,
      "repository create/read"
    );
    check(JSON.stringify(persisted) === JSON.stringify(game), "persisted game round-trip");
    check((await repository.getByUserId(TEST_FIXTURE.ownerId)).length === 1, "owner game listing");
    const otherGames = await new SupabaseGameRepository(other).getByUserId(TEST_FIXTURE.ownerId);
    check(otherGames.length === 0, "unrelated session repository read isolation");
    for (const client of [other, anonymous]) {
      const result = await client.from("games").select("id").eq("id", game.id);
      check(!result.error && result.data?.length === 0, "HTTP game read isolation (no denied RPC)");
    }
    const picks = await owner
      .from("game_pick_inventory")
      .select("id", { head: true, count: "exact" })
      .eq("game_id", game.id);
    check(!picks.error && picks.count === 14, "game trigger persisted 14 synthetic picks");
  } finally {
    for (const id of users.reverse()) {
      try {
        const current = await admin.auth.admin.getUserById(id);
        check(
          !current.error && userSchema.parse(current.data.user).id === id,
          "cleanup user ownership"
        );
        const deleted = await admin.auth.admin.deleteUser(id);
        check(!deleted.error, "delete only run-created fixture user (cascades game)");
      } catch {
        cleanupFailed = true;
        console.error("FAIL fixture user cleanup; manual inspection required, no broad retry");
      }
    }
    if (teamCreated && !cleanupFailed) {
      const picks = await admin
        .from("draft_picks")
        .delete()
        .eq("original_team_id", TEST_FIXTURE.teamId)
        .gte("draft_year", 2026)
        .lte("draft_year", 2032);
      check(!picks.error, "delete only synthetic team picks for 2026–2032");
      const team = await admin.from("teams").delete().eq("id", TEST_FIXTURE.teamId);
      check(!team.error, "delete only run-created synthetic team");
    }
    check(!cleanupFailed, "fixture user cleanup complete");
  }
  for (const table of tables) {
    const result = await admin.from(table).select("id", { head: true, count: "exact" });
    check(!result.error && result.count === 0, `${table} empty after fixture cleanup`);
  }
  console.log(
    "PASS initial HTTP integration; roster/contracts/trades/free-agency/simulation UNVERIFIED"
  );
}

main().catch(() => {
  console.error(
    "FAIL integration run; sensitive error details suppressed; do not reset or sweep fixtures"
  );
  process.exitCode = 1;
});
