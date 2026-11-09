import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GAME_STATUS } from "@/domain/entities/Game";
import {
  basketballReferenceContractSnapshotSchema,
  CONTRACT_SOURCE,
} from "@/infrastructure/contracts/basketballReferenceContractSource";
import { NBA_TO_BASKETBALL_REFERENCE_TEAMS } from "@/infrastructure/contracts/basketballReferenceTeamMapping";
import { SupabaseContractSnapshotCache } from "@/infrastructure/contracts/SupabaseContractSnapshotCache";
import { SupabaseGameContractRepository } from "@/infrastructure/contracts/SupabaseGameContractRepository";
import { SupabaseFreeAgencyRepository } from "@/infrastructure/freeAgency/SupabaseFreeAgencyRepository";
import { SupabaseContractRepository } from "@/infrastructure/repositories/SupabaseContractRepository";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import {
  createTestFetch,
  type IntegrationRole,
  TEST_FIXTURE,
  TEST_PROJECT_REF,
} from "@/infrastructure/supabase/integrationSafety";

export const FREE_AGENT_ID = "f3000000-0000-4000-8000-000000000003";
const requestId = "f6000000-0000-4000-8000-000000000001";
const season = "2026-27";
const source = CONTRACT_SOURCE.BASKETBALL_REFERENCE;
const salary = 2_449_421;
export const FREE_AGENCY_TABLES = [
  "contract_source_snapshot_versions",
  "current_contract_source_snapshots",
  "game_contract_materializations",
  "game_contract_provenance",
  "free_agency_availability_enrollments",
  "free_agency_pending_offers",
] as const;
const canonicalChildren = [
  "game_contract_seasons",
  "game_contract_provenance",
  "game_contract_agreements",
  "game_contract_identities",
  "game_contract_materializations",
];

function assert(value: unknown, label: string): asserts value {
  console.log(`${value ? "PASS" : "FAIL"} ${label}`);
  if (!value) throw new Error("Free-agency fixture assertion failed");
}

// Server-only synthetic TEST fixture; never used by application clients.
export class FreeAgencyFixture {
  readonly snapshots;
  private readonly versions: Array<{ id: string; team: string }> = [];
  private playerCreated = false;

  constructor(readonly gameId: string) {
    z.uuid().parse(gameId);
    const observedAt = new Date().toISOString();
    this.snapshots = NBA_TO_BASKETBALL_REFERENCE_TEAMS.map(
      ({ basketballReferenceAbbreviation: team }) => {
        const contracts = (team === "LAL" ? [0, 1] : [2]).map((index) => ({
          playerSlug: `phaseone${team.toLowerCase()}${index}`,
          playerUrl: `https://www.basketball-reference.com/players/p/phaseone${team.toLowerCase()}${index}.html`,
          fullName: `Courtside Phase One Player ${index + 1}`,
          teamAbbreviation: team,
          salaries: [{ season, amount: (index + 1) * 1_000_000, optionKind: "none" }],
          remainingGuaranteedAmount: (index + 1) * 1_000_000,
          contractNotes: [`Synthetic TEST fixture ${gameId}; not provider evidence`],
        }));
        const contentHash = createHash("sha256").update(JSON.stringify(contracts)).digest("hex");
        return {
          identity: { source, team, season },
          snapshot: basketballReferenceContractSnapshotSchema.parse({
            metadata: {
              sourceUrl: `https://www.basketball-reference.com/contracts/${team}.html`,
              observedAt,
              contentHash,
              cacheIdentity: { source, teamAbbreviation: team, season },
            },
            contracts,
            warnings: [],
          }),
        };
      }
    );
  }

  materializationInput() {
    return {
      p_game_id: this.gameId,
      p_user_id: TEST_FIXTURE.ownerId,
      p_source: source,
      p_season: season,
      p_version_ids: this.versions.map(({ id }) => id),
      p_identity_crosswalk: TEST_FIXTURE.playerIds.map((targetPlayerId, index) => ({
        sourcePlayerId: `phaseonelal${index}`,
        targetPlayerId,
        matchMethod: "curated-exception",
        evidence: {
          nbaTeam: "TST",
          sourceTeam: "LAL",
          reason: "Synthetic fixture mapping; no real provider identity",
        },
      })),
      p_contract_classifications: TEST_FIXTURE.playerIds.map((targetPlayerId) => ({
        targetPlayerId,
        resolution: {
          status: "resolved",
          contractType: "standard",
          quality: "observed",
          method: "basketball-reference-current-salary",
          estimated: false,
          capTreatment: "standard-cap-and-matching",
        },
      })),
    };
  }

  createFetch(
    url: string,
    report: (line: string) => void,
    request: typeof fetch = fetch,
    role: IntegrationRole = "admin"
  ) {
    if (url !== `https://${TEST_PROJECT_REF}.supabase.co`)
      throw new Error("Unexpected TEST destination");
    const fallback = createTestFetch(url, report, request, role);
    return async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      let body: unknown;
      try {
        body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      } catch {
        throw new Error("Invalid fixture request body");
      }
      const path = target.pathname.replace("/rest/v1/", "");
      const exactQuery = (key: string, value: string) =>
        [...target.searchParams].every(([name]) => name === key || name === "select") &&
        target.searchParams.getAll(key).length === 1 &&
        target.searchParams.get(key) === value;
      const gameQuery = exactQuery("game_id", `eq.${this.gameId}`);
      const gameRow = exactQuery("id", `eq.${this.gameId}`);
      let allowed =
        (method === "GET" || method === "HEAD") &&
        FREE_AGENCY_TABLES.some((table) => table === path);
      if (role === "admin") {
        allowed ||=
          method === "PATCH" &&
          path === "games" &&
          gameRow &&
          isDeepStrictEqual(body, { status: "initializing" });
        allowed ||=
          method === "DELETE" &&
          ((path === "games" && gameRow) || (canonicalChildren.includes(path) && gameQuery));
        allowed ||=
          method === "POST" &&
          path === "players" &&
          isDeepStrictEqual(body, {
            id: FREE_AGENT_ID,
            first_name: "Synthetic",
            last_name: "Free Agent",
            full_name: "Synthetic Free Agent",
            years_of_experience: 2,
            position: "PG",
            is_active: true,
          });
        allowed ||=
          method === "DELETE" &&
          path === "players" &&
          exactQuery("id", `eq.${FREE_AGENT_ID}`) &&
          this.playerCreated;
        if (method === "DELETE" && path === "current_contract_source_snapshots") {
          const version = this.versions.find(
            ({ id }) => target.searchParams.get("version_id") === `eq.${id}`
          );
          allowed ||=
            !!version &&
            target.searchParams.size === 4 &&
            target.searchParams.get("source") === `eq.${source}` &&
            target.searchParams.get("team") === `eq.${version.team}` &&
            target.searchParams.get("season") === `eq.${season}`;
        }
        allowed ||=
          method === "DELETE" &&
          path === "contract_source_snapshot_versions" &&
          this.versions.some(({ id }) => exactQuery("id", `eq.${id}`));
      }
      if (role === "owner")
        allowed ||=
          method === "PATCH" &&
          path === "games" &&
          gameRow &&
          isDeepStrictEqual(body, { status: "active" });
      if (method === "POST" && path.startsWith("rpc/") && target.searchParams.size === 0) {
        const rpc = path.slice(4);
        const row = z.record(z.string(), z.unknown()).safeParse(body);
        if (row.success && role === "admin") {
          const fixture = this.snapshots.find(({ identity }) => identity.team === row.data.p_team);
          if (fixture && rpc === "reserve_contract_snapshot_revalidation")
            allowed ||= isDeepStrictEqual(body, {
              p_source: source,
              p_team: fixture.identity.team,
              p_season: season,
            });
          if (fixture && rpc === "store_contract_source_snapshot")
            allowed ||=
              z.number().int().positive().safe().safeParse(row.data.p_revalidation_revision)
                .success &&
              isDeepStrictEqual(body, {
                p_source: source,
                p_team: fixture.identity.team,
                p_season: season,
                p_source_url: fixture.snapshot.metadata.sourceUrl,
                p_observed_at: fixture.snapshot.metadata.observedAt,
                p_fetched_at: fixture.snapshot.metadata.observedAt,
                p_revalidation_revision: row.data.p_revalidation_revision,
                p_content_hash: fixture.snapshot.metadata.contentHash,
                p_payload: fixture.snapshot,
              });
          if (rpc === "materialize_game_contract_snapshots")
            allowed ||=
              this.versions.length === 30 && isDeepStrictEqual(body, this.materializationInput());
          if (rpc === "enroll_simulated_free_agents")
            allowed ||= isDeepStrictEqual(body, {
              p_game_id: this.gameId,
              p_player_ids: [FREE_AGENT_ID],
            });
        }
        if (role === "owner") {
          if (["get_free_agency_market", "list_pending_free_agency_offers"].includes(rpc))
            allowed ||= isDeepStrictEqual(body, { p_game_id: this.gameId });
          if (rpc === "submit_free_agency_offer")
            allowed ||= isDeepStrictEqual(body, {
              p_game_id: this.gameId,
              p_player_id: FREE_AGENT_ID,
              p_request_id: requestId,
              p_season: season,
              p_annual_salary: salary,
              p_years: 1,
            });
          if (rpc === "advance_simulation_day")
            allowed ||= isDeepStrictEqual(body, {
              p_game_id: this.gameId,
              p_expected_date: "2026-10-01",
            });
        }
      }
      if (!allowed) return fallback(input, init);
      if (target.origin !== url || target.username || target.password || target.hash)
        throw new Error("Unexpected TEST destination");
      const response = await request(input, {
        ...init,
        redirect: "error",
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
          : AbortSignal.timeout(15_000),
      });
      report(`HTTP ${method} ${target.pathname} ${response.status}`);
      return response;
    };
  }

  async materialize(admin: SupabaseClient) {
    const cache = new SupabaseContractSnapshotCache(
      admin,
      basketballReferenceContractSnapshotSchema
    );
    for (const { identity, snapshot } of this.snapshots) {
      assert(
        (await cache.getCurrent(identity)) === null,
        `source ${identity.team} key absent; no overwrite`
      );
      const revision = await cache.reserveRevalidation(identity);
      const stored = await cache.store({
        identity,
        snapshot,
        contentHash: snapshot.metadata.contentHash,
        observedAt: snapshot.metadata.observedAt,
        fetchedAt: snapshot.metadata.observedAt,
        revalidationRevision: revision,
      });
      const id = z.uuid().parse(stored.versionId);
      this.versions.push({ id, team: identity.team });
      assert(
        stored.contentHash === snapshot.metadata.contentHash,
        `source ${identity.team} durable synthetic version`
      );
      const current = await cache.getCurrent(identity);
      assert(
        current?.versionId === id && isDeepStrictEqual(current.snapshot, snapshot),
        `source ${identity.team} repository round-trip`
      );
    }
    const result = await admin.rpc(
      "materialize_game_contract_snapshots",
      this.materializationInput()
    );
    assert(
      !result.error && result.data?.status === "materialized" && result.data?.agreementCount === 2,
      "legitimate 30-source materialization RPC"
    );
    const replay = await admin.rpc(
      "materialize_game_contract_snapshots",
      this.materializationInput()
    );
    assert(
      !replay.error &&
        replay.data?.status === "already-materialized" &&
        replay.data?.agreementCount === 2,
      "materialization replay is idempotent"
    );
  }

  async exercise(admin: SupabaseClient, owner: SupabaseClient, readers: readonly SupabaseClient[]) {
    const player = await admin.from("players").insert({
      id: FREE_AGENT_ID,
      first_name: "Synthetic",
      last_name: "Free Agent",
      full_name: "Synthetic Free Agent",
      years_of_experience: 2,
      position: "PG",
      is_active: true,
    });
    assert(!player.error, "create synthetic free agent without provider ids");
    this.playerCreated = true;
    const enrolled = await admin.rpc("enroll_simulated_free_agents", {
      p_game_id: this.gameId,
      p_player_ids: [FREE_AGENT_ID],
    });
    assert(!enrolled.error && enrolled.data === 1, "legitimate free-agent enrollment RPC");
    const games = new SupabaseGameRepository(owner);
    assert(
      (await games.update(this.gameId, { status: GAME_STATUS.ACTIVE })).status ===
        GAME_STATUS.ACTIVE,
      "owner activates prepared synthetic game"
    );
    const repo = new SupabaseFreeAgencyRepository(owner);
    const market = await repo.getMarket(this.gameId);
    const candidate = market.candidates.find(({ playerId }) => playerId === FREE_AGENT_ID);
    assert(
      market.supported &&
        candidate?.minimumSalary === salary &&
        market.context?.payroll === 3_000_000,
      "owner market has synthetic candidate and materialized payroll"
    );
    const offer = await repo.submitOffer({
      gameId: this.gameId,
      playerId: FREE_AGENT_ID,
      requestId,
      offer: { season, annualSalary: candidate.minimumSalary, years: 1 },
    });
    const pending = await repo.listPendingOffers(this.gameId);
    assert(
      pending.length === 1 &&
        isDeepStrictEqual(pending[0], offer) &&
        offer.dueDate === "2026-10-02",
      "owner offer persisted through repository reread"
    );
    for (const reader of readers) {
      const rows = await reader
        .from("free_agency_pending_offers")
        .select("id")
        .eq("game_id", this.gameId);
      assert(
        (!rows.error && rows.data?.length === 0) || rows.error?.code === "42501",
        "unrelated/anonymous offer table isolation; no denied RPC"
      );
    }
    const advanced = await owner.rpc("advance_simulation_day", {
      p_game_id: this.gameId,
      p_expected_date: "2026-10-01",
    });
    assert(
      !advanced.error &&
        Array.isArray(advanced.data) &&
        advanced.data.some((row) => row.new_date === "2026-10-02"),
      "owner advances simulation through legitimate RPC"
    );
    assert(
      (await games.getById(this.gameId))?.simulationDate.toISOString().slice(0, 10) ===
        "2026-10-02",
      "advanced simulation date persisted"
    );
    const resolved = (await repo.getMarket(this.gameId)).offers.find(({ id }) => id === offer.id);
    assert(
      resolved?.status === "accepted" &&
        resolved.resolvedContractId &&
        (await repo.listPendingOffers(this.gameId)).length === 0,
      "due offer accepted and runtime link persisted"
    );
    const effective = await new SupabaseGameContractRepository(owner).getEffectiveAll(this.gameId);
    const signed = effective.find(({ playerId }) => playerId === FREE_AGENT_ID);
    assert(
      signed?.teamId === TEST_FIXTURE.teamId &&
        signed.canonical === null &&
        signed.simulated?.id === resolved.resolvedContractId &&
        signed.simulated.annualSalary === salary,
      "effective repository selects signed runtime contract"
    );
    const projected = (await new SupabaseContractRepository(owner).getAll(this.gameId)).find(
      ({ playerId }) => playerId === FREE_AGENT_ID
    );
    assert(projected?.salaryY1 === salary, "compatibility repository projects runtime salary");
    for (const reader of readers) {
      const rows = await reader
        .from("game_active_runtime_contracts")
        .select("game_id")
        .eq("game_id", this.gameId);
      assert(
        (!rows.error && rows.data?.length === 0) || rows.error?.code === "42501",
        "signed runtime unrelated/anonymous isolation"
      );
    }
  }

  async cleanupGame(admin: SupabaseClient, owner: SupabaseClient) {
    assert(
      !(await admin.from("games").update({ status: "initializing" }).eq("id", this.gameId)).error,
      "administrative reset of only run-created fixture for teardown"
    );
    for (const table of canonicalChildren) {
      assert(
        !(await admin.from(table).delete().eq("game_id", this.gameId)).error,
        `exact ${table} cleanup before parent deletion`
      );
      const remaining = await admin
        .from(table)
        .select("game_id", { head: true, count: "exact" })
        .eq("game_id", this.gameId);
      assert(!remaining.error && remaining.count === 0, `${table} cleanup verified`);
    }
    assert(
      !(await admin.from("games").delete().eq("id", this.gameId)).error,
      "delete exact game before Auth; accepted runtime cascades"
    );
    const absent = await admin
      .from("games")
      .select("id", { head: true, count: "exact" })
      .eq("id", this.gameId);
    assert(!absent.error && absent.count === 0, "run-created game absent before Auth deletion");
    const runtime = await owner
      .from("game_active_runtime_contracts")
      .select("game_id", { head: true, count: "exact" })
      .eq("game_id", this.gameId);
    assert(
      !runtime.error && runtime.count === 0,
      "owner-visible signed runtime absent after exact game deletion"
    );
    if (this.playerCreated)
      assert(
        !(await admin.from("players").delete().eq("id", FREE_AGENT_ID)).error,
        "delete run-created free agent after game cascade"
      );
    for (const version of this.versions) {
      assert(
        !(
          await admin
            .from("current_contract_source_snapshots")
            .delete()
            .eq("source", source)
            .eq("team", version.team)
            .eq("season", season)
            .eq("version_id", version.id)
        ).error,
        "delete exact run-created source pointer"
      );
      assert(
        !(await admin.from("contract_source_snapshot_versions").delete().eq("id", version.id))
          .error,
        "delete exact run-created source version"
      );
    }
  }
}
