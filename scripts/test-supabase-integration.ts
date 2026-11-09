import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GAME_STATUS, gameSchema } from "@/domain/entities/Game";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { SupabasePlayerStateRepository } from "@/infrastructure/repositories/SupabasePlayerStateRepository";
import {
  createTestFetch,
  type IntegrationRole,
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
  const clientOptions = (role: IntegrationRole) => ({
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createTestFetch(config.url, console.log, fetch, role) },
  });
  const admin = createClient(config.url, config.serviceRoleKey, clientOptions("admin"));
  const owner = createClient(config.url, config.publishableKey, clientOptions("owner"));
  const other = createClient(config.url, config.publishableKey, clientOptions("reader"));
  const anonymous = createClient(config.url, config.publishableKey, clientOptions("reader"));
  const users: string[] = [];
  let teamCreated = false;
  let playersCreated = false;
  let cleanupFailed = false;
  const userSchema = z.object({
    id: z.uuid(),
    app_metadata: z.object({ courtside_test_fixture: z.literal("phase1-v1") }),
  });
  const tables = [
    "games",
    "teams",
    "draft_picks",
    "game_pick_inventory",
    "players",
    "game_player_states",
    "game_contract_identities",
    "game_contract_agreements",
    "game_contract_seasons",
    "game_runtime_contracts",
  ] as const;
  try {
    const authHealth = await createTestFetch(config.url, console.log)(
      `${config.url}/auth/v1/health`,
      { headers: { apikey: config.publishableKey } }
    );
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

    const insertedPlayers = await admin
      .from("players")
      .insert(
        TEST_FIXTURE.playerIds.map((playerId, index) => ({
          id: playerId,
          first_name: "Phase One",
          last_name: `Player ${index + 1}`,
          full_name: `Courtside Phase One Player ${index + 1}`,
          years_of_experience: 2,
          is_active: true,
        }))
      )
      .select("id");
    check(
      !insertedPlayers.error && insertedPlayers.data?.length === 2,
      "insert two synthetic players without NBA or ESPN identity"
    );
    playersCreated = true;

    const stateRepository = new SupabasePlayerStateRepository(owner);
    const rosterStates = await stateRepository.bulkCreateForGame(
      game.id,
      TEST_FIXTURE.playerIds.map((playerId) => ({
        playerId,
        teamId: TEST_FIXTURE.teamId,
        morale: 50,
        fatigue: 0,
        isActive: true,
        isInjured: false,
      }))
    );
    check(
      rosterStates.length === 2 &&
        rosterStates.every((state) => state.teamId === TEST_FIXTURE.teamId),
      "owner session writes roster states through repository"
    );
    const roster = await stateRepository.getByGameAndTeam(game.id, TEST_FIXTURE.teamId);
    check(
      roster.length === 2 &&
        TEST_FIXTURE.playerIds.every((playerId) =>
          roster.some((state) => state.playerId === playerId)
        ),
      "owner session reads roster through repository"
    );

    const canonicalFixture = TEST_FIXTURE.playerIds.map((playerId, index) => ({
      identity: {
        game_id: game.id,
        player_id: playerId,
        team_id: TEST_FIXTURE.teamId,
        resolution_status: "observed-standard",
        contract_type: "standard",
        provenance_quality: "observed",
        source_method: "basketball-reference-current-salary",
        estimated: false,
        cap_treatment: "standard-cap-and-matching",
      },
      agreement: {
        id: TEST_FIXTURE.agreementIds[index],
        game_id: game.id,
        player_id: playerId,
        team_id: TEST_FIXTURE.teamId,
        start_season_label: "2026-27",
        end_season_label: "2026-27",
        contract_type: "standard",
        provenance_quality: "observed",
        source_method: "basketball-reference-current-salary",
        estimated: false,
        cap_treatment: "standard-cap-and-matching",
      },
      season: {
        agreement_id: TEST_FIXTURE.agreementIds[index],
        game_id: game.id,
        season_label: "2026-27",
        start_year: TEST_FIXTURE.seasonYear,
        end_year: TEST_FIXTURE.seasonYear + 1,
        salary_amount: index === 0 ? 1_000_000 : 2_000_000,
        option_kind: "none",
        guarantee_kind: "guaranteed",
      },
    }));
    for (const { identity, agreement, season } of canonicalFixture) {
      check(
        !(await admin.from("game_contract_identities").insert(identity)).error,
        "insert canonical identity fixture"
      );
      check(
        !(await admin.from("game_contract_agreements").insert(agreement)).error,
        "insert canonical agreement fixture"
      );
      check(
        !(await admin.from("game_contract_seasons").insert(season)).error,
        "insert canonical season fixture"
      );
    }
    const runtimeContract = await admin.from("game_runtime_contracts").insert({
      game_id: game.id,
      player_id: TEST_FIXTURE.playerIds[1],
      origin_kind: "simulated-agreement",
      start_year: TEST_FIXTURE.seasonYear,
      end_year: TEST_FIXTURE.seasonYear + 1,
      annual_salary: 3_000_000,
      is_player_option: false,
      is_team_option: false,
      is_guaranteed: true,
    });
    check(!runtimeContract.error, "insert simulated runtime contract fixture");

    const snapshotAgreements = await admin
      .from("game_contract_agreements")
      .select("*")
      .eq("game_id", game.id)
      .order("id");
    const snapshotSeasons = await admin
      .from("game_contract_seasons")
      .select("*")
      .eq("game_id", game.id)
      .order("id");
    check(
      !snapshotAgreements.error && snapshotAgreements.data?.length === 2,
      "canonical agreement snapshot"
    );
    check(
      !snapshotSeasons.error && snapshotSeasons.data?.length === 2,
      "canonical season snapshot"
    );
    const canonicalSnapshot = JSON.stringify([snapshotAgreements.data, snapshotSeasons.data]);

    const gameContracts = new SupabaseGameContractRepository(owner);
    const effective = await gameContracts.getEffectiveAll(game.id);
    check(effective.length === 2, "effective contract states for both roster players");
    const first = effective.find(({ playerId }) => playerId === TEST_FIXTURE.playerIds[0]);
    const second = effective.find(({ playerId }) => playerId === TEST_FIXTURE.playerIds[1]);
    check(
      first?.canonical?.agreement !== null &&
        first?.canonical?.agreement !== undefined &&
        first.simulated === null &&
        second?.simulated !== null &&
        second?.simulated?.annualSalary === 3_000_000 &&
        second.canonical === null,
      "canonical and runtime evidence split per player"
    );
    check(
      (await gameContracts.getByTeam(game.id, TEST_FIXTURE.teamId)).length === 2,
      "team-scoped effective contract read"
    );
    const contracts = await new SupabaseContractRepository(owner).getAll(game.id);
    const firstContract = contracts.find(({ playerId }) => playerId === TEST_FIXTURE.playerIds[0]);
    const secondContract = contracts.find(({ playerId }) => playerId === TEST_FIXTURE.playerIds[1]);
    check(
      contracts.length === 2 &&
        firstContract?.salaryY1 === 1_000_000 &&
        secondContract?.salaryY1 === 3_000_000,
      "compatibility projection: canonical salary and runtime precedence"
    );

    const agreementsAfter = await admin
      .from("game_contract_agreements")
      .select("*")
      .eq("game_id", game.id)
      .order("id");
    const seasonsAfter = await admin
      .from("game_contract_seasons")
      .select("*")
      .eq("game_id", game.id)
      .order("id");
    check(
      !agreementsAfter.error &&
        !seasonsAfter.error &&
        JSON.stringify([agreementsAfter.data, seasonsAfter.data]) === canonicalSnapshot,
      "canonical fixture rows unchanged by owner reads"
    );
    const legacyContracts = await admin
      .from("contracts")
      .select("id", { head: true, count: "exact" })
      .eq("game_id", game.id);
    check(!legacyContracts.error && legacyContracts.count === 0, "no legacy contracts row created");

    const isolationTables = [
      "game_player_states",
      "game_contract_identities",
      "game_contract_agreements",
      "game_contract_seasons",
      "game_runtime_contracts",
    ] as const;
    for (const [label, client] of [
      ["unrelated session", other],
      ["anonymous", anonymous],
    ] as const) {
      for (const table of isolationTables) {
        const result = await client.from(table).select("id").eq("game_id", game.id);
        check(
          !result.error && (result.data?.length ?? 0) === 0,
          `${label} ${table} read isolation`
        );
      }
    }
    check(
      (
        await new SupabasePlayerStateRepository(other).getByGameAndTeam(
          game.id,
          TEST_FIXTURE.teamId
        )
      ).length === 0,
      "unrelated session roster repository isolation"
    );
    check(
      (await new SupabaseGameContractRepository(other).getByTeam(game.id, TEST_FIXTURE.teamId))
        .length === 0,
      "unrelated session contract repository isolation"
    );
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
    // Players deletion must follow the user/game cascade: canonical contract
    // rows reference players with ON DELETE RESTRICT until the game is gone.
    if ((teamCreated || playersCreated) && !cleanupFailed) {
      if (playersCreated) {
        for (const [index, playerId] of TEST_FIXTURE.playerIds.entries()) {
          const player = await admin.from("players").delete().eq("id", playerId);
          check(!player.error, `delete only run-created synthetic player ${index + 1}`);
        }
      }
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
  for (const [label, id] of [
    ["owner", TEST_FIXTURE.ownerId],
    ["other", TEST_FIXTURE.otherId],
  ] as const) {
    const result = await admin.auth.admin.getUserById(id);
    check(result.error?.status === 404, `${label} fixture account absent after cleanup (404)`);
  }
  console.log(
    "PASS roster and contract HTTP integration; trades/free-agency/simulation/rejected-write rollback UNVERIFIED"
  );
}

main().catch(() => {
  console.error(
    "FAIL integration run; sensitive error details suppressed; do not reset or sweep fixtures"
  );
  process.exitCode = 1;
});
