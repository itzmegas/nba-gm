import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../scripts/schema.sql", import.meta.url), "utf8");
const rosterMigration = readFileSync(
  new URL("../../../scripts/migrations/011_current_roster_refresh.sql", import.meta.url),
  "utf8"
);
const espnRosterMigration = readFileSync(
  new URL("../../../scripts/migrations/012_espn_roster_source.sql", import.meta.url),
  "utf8"
);
const contractSnapshotMigration = readFileSync(
  new URL("../../../scripts/migrations/013_contract_source_snapshots.sql", import.meta.url),
  "utf8"
);
const gameContractMigration = readFileSync(
  new URL("../../../scripts/migrations/014_game_contract_snapshots.sql", import.meta.url),
  "utf8"
);
const playerExperienceMigration = readFileSync(
  new URL("../../../scripts/migrations/015_player_years_of_experience.sql", import.meta.url),
  "utf8"
);
const rollbackMigration = readFileSync(
  new URL("../../../scripts/migrations/016_rollback_seed_game_data.sql", import.meta.url),
  "utf8"
);
const contractSnapshotConflictFixMigration = readFileSync(
  new URL(
    "../../../scripts/migrations/017_fix_contract_source_snapshot_conflict.sql",
    import.meta.url
  ),
  "utf8"
);
const estimatedGameContractsMigration = readFileSync(
  new URL(
    "../../../scripts/migrations/018_materialize_estimated_game_contracts.sql",
    import.meta.url
  ),
  "utf8"
);
const optimizedGameContractsMigration = readFileSync(
  new URL(
    "../../../scripts/migrations/019_optimize_game_contract_materialization.sql",
    import.meta.url
  ),
  "utf8"
);

function mirroredSection(source: string, marker: string, nextMarker?: string): string {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const contentStart = start + marker.length;
  const end = nextMarker ? source.indexOf(nextMarker, contentStart) : source.length;
  expect(end).toBeGreaterThan(contentStart);
  return `${source.slice(contentStart, end).trimEnd()}\n`;
}

describe("contracts database invariants", () => {
  it("serializes one ownership contract per game and player", () => {
    expect(schema).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_game_player_unique\s+ON contracts\(game_id, player_id\)/
    );
  });

  it("creates an immutable game snapshot only during initialization", () => {
    const seedFunction = schema.match(
      /CREATE OR REPLACE FUNCTION seed_game_data[\s\S]*?REVOKE ALL ON FUNCTION seed_game_data/
    )?.[0];

    expect(seedFunction).toContain("g.status = 'initializing'");
    expect(seedFunction?.match(/ON CONFLICT \(game_id, player_id\) DO NOTHING/g)).toHaveLength(4);
    expect(seedFunction).not.toContain("DO UPDATE");
    expect(seedFunction).toContain("v_contract_count <> v_roster_count");
  });

  it("supports draft inventory for every configured historical era", () => {
    expect(schema).toContain(
      "ADD CONSTRAINT draft_picks_draft_year_check CHECK (draft_year >= 1947)"
    );
    expect(schema.indexOf("DROP CONSTRAINT IF EXISTS draft_picks_draft_year_check")).toBeLessThan(
      schema.indexOf("INSERT INTO draft_picks")
    );
  });

  it("persists and backfills the durable game season era", () => {
    expect(schema).toContain("season_era_id TEXT NOT NULL DEFAULT 'modern'");
    expect(rosterMigration).toContain("UPDATE games");
    expect(rosterMigration).toContain("WHEN 2010 THEN 'lebron'");
    expect(rosterMigration).toContain("WHEN 1995 THEN 'jordan'");
    expect(rosterMigration).toContain("ELSE 'modern'");
  });

  it("defines service-role-only roster refresh promotion", () => {
    for (const source of [schema, rosterMigration]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS roster_refresh_staging");
      expect(source).toContain("CREATE TABLE IF NOT EXISTS roster_refresh_runs");
      expect(source).toContain("CREATE OR REPLACE FUNCTION promote_current_roster");
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("ALTER TABLE roster_refresh_staging ENABLE ROW LEVEL SECURITY");
      expect(source).toContain(
        "REVOKE ALL ON TABLE roster_refresh_staging FROM PUBLIC, anon, authenticated"
      );
    }
  });

  it("keeps ESPN identity separate from official NBA identity", () => {
    for (const source of [schema, espnRosterMigration]) {
      expect(source).toContain("espn_id INTEGER UNIQUE");
      expect(source).toContain("player_source_id");
      expect(source).toContain("s.provider = 'espn'");
    }
    expect(espnRosterMigration).toContain("ALTER COLUMN player_source_id SET NOT NULL");
  });

  it("mirrors immutable service-role-only contract snapshot persistence", () => {
    const marker = "-- Canonical schema mirror for migration 013. Keep byte-identical below.\n";
    const nextMarker = "-- End canonical schema mirror for migration 013.\n";
    expect(mirroredSection(schema, marker, nextMarker)).toBe(contractSnapshotMigration);
    for (const source of [schema, contractSnapshotMigration]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS contract_source_snapshot_versions");
      expect(source).toContain("CREATE TABLE IF NOT EXISTS current_contract_source_snapshots");
      expect(source).toContain("UNIQUE (source, team, season, content_hash)");
      expect(source).toContain("ON CONFLICT (source, team, season, content_hash) DO NOTHING");
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("revalidation_revision BIGINT NOT NULL");
      expect(source).toContain(
        "EXCLUDED.revalidation_revision > current_contract_source_snapshots.revalidation_revision"
      );
      expect(source).not.toContain("EXCLUDED.revalidated_at >=");
      expect(source).toContain("ENABLE ROW LEVEL SECURITY");
      expect(source).toContain(
        "REVOKE ALL ON TABLE contract_source_snapshot_versions FROM PUBLIC, anon, authenticated"
      );
      expect(source).toContain("TO service_role");
      expect(source).toContain(
        "REVOKE ALL ON FUNCTION reserve_contract_snapshot_revalidation(TEXT, TEXT, TEXT)"
      );
      expect(source).toContain(
        "GRANT EXECUTE ON FUNCTION reserve_contract_snapshot_revalidation(TEXT, TEXT, TEXT)"
      );
      expect(source).toContain(
        "REVOKE ALL ON SEQUENCE contract_snapshot_revalidation_revision_seq FROM PUBLIC, anon, authenticated"
      );
      expect(source).toContain("TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)");
      expect(source).toContain(
        "REVOKE ALL ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)"
      );
      expect(source).toContain(
        "GRANT EXECUTE ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)"
      );
    }
  });

  it("rejects tied revisions and slower stale writers during pointer promotion", () => {
    for (const source of [schema, contractSnapshotMigration]) {
      const promotion = source.match(
        /INSERT INTO current_contract_source_snapshots[\s\S]*?RETURN QUERY/
      )?.[0];
      expect(promotion).toContain(
        "WHERE EXCLUDED.revalidation_revision > current_contract_source_snapshots.revalidation_revision"
      );
      expect(promotion).not.toContain(">=");
    }
  });

  it("defines lossless immutable game-owned modern contract copies", () => {
    const marker =
      "-- Canonical schema mirror for work unit 5. Keep byte-identical with migration 014 below.\n";
    expect(schema).not.toMatch(/^\\/m);
    const nextMarker = "-- Canonical schema mirror for migration 015. Keep byte-identical below.\n";
    expect(mirroredSection(schema, marker, nextMarker)).toBe(gameContractMigration);
    for (const table of [
      "game_contract_materializations",
      "game_contract_identities",
      "game_contract_agreements",
      "game_contract_seasons",
      "game_contract_provenance",
    ]) {
      expect(gameContractMigration).toContain(`CREATE TABLE ${table}`);
      expect(gameContractMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(gameContractMigration).toContain("salary_amount BIGINT CHECK (salary_amount IS NULL");
    expect(gameContractMigration).toContain("cardinality(source_version_ids) = 30");
    expect(gameContractMigration).toContain("canonical 30-team set");
    expect(gameContractMigration).toContain("Game contract snapshots are immutable");
    expect(gameContractMigration).toContain("status <> 'initializing'");
    expect(gameContractMigration).toContain("season_era_id <> 'modern'");
  });

  it("mirrors player experience migration after game contracts without meta-commands", () => {
    const contractMarker =
      "-- Canonical schema mirror for work unit 5. Keep byte-identical with migration 014 below.\n";
    const marker = "-- Canonical schema mirror for migration 015. Keep byte-identical below.\n";
    const nextMarker = "-- Canonical schema mirror for migration 016. Keep byte-identical below.\n";
    expect(mirroredSection(schema, marker, nextMarker)).toBe(playerExperienceMigration);
    expect(schema.indexOf(contractMarker)).toBeLessThan(schema.indexOf(marker));
    expect(schema).not.toMatch(/^\\/m);
    expect(contractSnapshotMigration).not.toMatch(/^\\/m);
    expect(gameContractMigration).not.toMatch(/^\\/m);
    expect(playerExperienceMigration).not.toMatch(/^\\/m);
  });

  it("mirrors the initializing-game rollback migration in canonical order", () => {
    const marker = "-- Canonical schema mirror for migration 016. Keep byte-identical below.\n";
    const nextMarker = "-- End canonical schema mirror for migration 016.\n";
    expect(mirroredSection(schema, marker, nextMarker)).toBe(rollbackMigration);
    expect(schema.indexOf("-- Canonical schema mirror for migration 015.")).toBeLessThan(
      schema.indexOf(marker)
    );
    expect(rollbackMigration).toContain(
      "CREATE OR REPLACE FUNCTION rollback_seed_game_data(p_game_id UUID)"
    );
    expect(rollbackMigration).toContain("SECURITY DEFINER");
    expect(rollbackMigration).toContain("SET search_path = public");
    expect(rollbackMigration).toContain(
      "REVOKE ALL ON FUNCTION rollback_seed_game_data(UUID) FROM PUBLIC, anon, authenticated"
    );
    expect(rollbackMigration).toContain(
      "GRANT EXECUTE ON FUNCTION rollback_seed_game_data(UUID) TO authenticated"
    );
    expect(rollbackMigration).not.toMatch(/^\\/m);
  });

  it("replaces the contract snapshot cache RPC with unambiguous conflict targets", () => {
    const marker = "-- Canonical schema mirror for migration 017. Keep byte-identical below.\n";
    const nextMarker = "-- End canonical schema mirror for migration 017.\n";
    const canonicalFix = mirroredSection(schema, marker, nextMarker);
    expect(canonicalFix).toBe(contractSnapshotConflictFixMigration);

    for (const source of [contractSnapshotConflictFixMigration, canonicalFix]) {
      expect(source).toContain("CREATE OR REPLACE FUNCTION store_contract_source_snapshot(");
      expect(source).toContain(
        `RETURNS TABLE (
  version_id UUID,
  source TEXT,
  team TEXT,
  season TEXT,
  content_hash TEXT,
  observed_at TIMESTAMPTZ,
  stored_at TIMESTAMPTZ,
  revalidated_at TIMESTAMPTZ,
  payload JSONB
)`
      );
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("IF v_version_id IS NULL THEN");
      expect(source).toContain(
        "ON CONFLICT ON CONSTRAINT contract_source_snapshot_versions_content_unique DO NOTHING"
      );
      expect(source).toContain(
        "ON CONFLICT ON CONSTRAINT current_contract_source_snapshots_pkey DO UPDATE SET"
      );
      expect(source).not.toContain("ON CONFLICT (source, team, season, content_hash)");
      expect(source).not.toContain("ON CONFLICT (source, team, season) DO UPDATE");
      expect(source).toContain("SECURITY DEFINER");
      expect(source).toContain("SET search_path = public");
      expect(source).toContain(
        "REVOKE ALL ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)"
      );
      expect(source).toContain(
        "GRANT EXECUTE ON FUNCTION store_contract_source_snapshot(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, TEXT, JSONB)"
      );
      expect(source).toContain(
        "WHERE EXCLUDED.revalidation_revision > current_contract_source_snapshots.revalidation_revision"
      );
    }
  });

  it("materializes roster-only estimated minimum agreements without fabricated source provenance", () => {
    const marker = "-- Canonical schema mirror for migration 018. Keep byte-identical below.\n";
    const nextMarker = "-- End canonical schema mirror for migration 018.\n";
    const canonicalMigration = mirroredSection(schema, marker, nextMarker);
    expect(canonicalMigration).toBe(estimatedGameContractsMigration);
    expect(schema.indexOf("-- Canonical schema mirror for migration 017.")).toBeLessThan(
      schema.indexOf(marker)
    );

    for (const source of [estimatedGameContractsMigration, canonicalMigration]) {
      expect(source).toContain("CREATE OR REPLACE FUNCTION materialize_game_contract_snapshots(");
      expect(source).toContain("SECURITY DEFINER SET search_path = public");
      expect(source).toContain("auth.role() <> 'service_role'");
      expect(source).toContain("v_game.user_id <> p_user_id");
      expect(source).toContain("v_game.status <> 'initializing'");
      expect(source).toContain("v_game.season_era_id <> 'modern'");
      expect(source).toContain("Exactly 30 distinct source snapshot versions are required");
      expect(source).toContain("already materialized from different source versions");
      expect(source).toContain("Game was already materialized from different source versions");
      expect(source).toContain("Every roster identity must be classified");
      expect(source).toContain("Contract coverage is insufficient; game activation is blocked");
      expect(source).toContain("c.resolution->>'status' = 'resolved'");
      expect(source).toContain("c.resolution->>'contractType' = 'standard'");
      expect(source).toContain("(c.resolution->>'estimated')::BOOLEAN = true");
      expect(source).toContain("COALESCE((x->'resolution'->>'estimated')::BOOLEAN, false) = false");
      expect(source).toContain("(c.resolution->>'salaryAmount')::BIGINT");
      expect(source).toContain("SELECT a.id, p_game_id, p_season, v_game.season_year");
      expect(source.match(/INSERT INTO game_contract_provenance/g)).toHaveLength(1);
      expect(source).toContain("FROM inserted i JOIN matched m USING (player_id)");
      const provenanceInsert = source.match(
        /INSERT INTO game_contract_provenance[\s\S]*?FROM inserted i JOIN matched m USING \(player_id\);/
      )?.[0];
      expect(provenanceInsert).toBeDefined();
      expect(provenanceInsert).not.toContain("source_player_id IS NULL");
      expect(source).toContain(
        "REVOKE ALL ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)"
      );
      expect(source).toContain(
        "GRANT EXECUTE ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)"
      );
      expect(source).toContain("TO service_role");
      expect(source).not.toMatch(/^\\/m);
    }
  });

  it("mirrors and optimizes the complete contract materialization replacement", () => {
    const marker = "-- Canonical schema mirror for migration 019. Keep byte-identical below.\n";
    const nextMarker = "-- End canonical schema mirror for migration 019.\n";
    const canonicalMigration = mirroredSection(schema, marker, nextMarker);
    expect(canonicalMigration).toBe(optimizedGameContractsMigration);
    expect(schema.indexOf("-- Canonical schema mirror for migration 018.")).toBeLessThan(
      schema.indexOf(marker)
    );

    for (const source of [optimizedGameContractsMigration, canonicalMigration]) {
      expect(source).toContain("013 creates the source snapshot tables");
      expect(source).toContain("game contract copy tables");
      expect(source).toContain("018 is not a prerequisite");
      expect(source).toContain("SECURITY DEFINER SET search_path = public");
      expect(source).toContain("auth.role() <> 'service_role'");
      expect(source).toContain("v_game.user_id <> p_user_id");
      expect(source).toContain("v_game.status <> 'initializing'");
      expect(source).toContain("v_game.season_era_id <> 'modern'");
      expect(source).toContain("v_game.deleted_at IS NOT NULL");
      expect(source).toContain("Contract snapshot season does not match game season");
      expect(source).toContain("jsonb_typeof(p_identity_crosswalk) <> 'array'");
      expect(source).toContain("jsonb_typeof(p_contract_classifications) <> 'array'");
      expect(source).toContain("Exactly 30 distinct source snapshot versions are required");
      expect(source).toContain("canonical 30-team set");
      expect(source).toContain("Identity crosswalk source and target identities must be unique");
      expect(source).toContain("Identity crosswalk contains unvalidated records");
      expect(source).toContain("Modern roster must be seeded before contract materialization");
      expect(source).toContain("This sentinel remains the first game-owned write");
      expect(source).toContain("Every roster identity must be classified");
      expect(source).toContain("resolution_status = 'unclassified'");
      expect(source).toContain("Contract coverage is insufficient; game activation is blocked");
      expect(source).toContain("already-materialized");
      expect(source).toContain("Game was already materialized from different source versions");

      expect(source).toContain("classifications AS MATERIALIZED");
      expect(source).toContain("source_contracts AS MATERIALIZED");
      expect(source).toContain("matched AS MATERIALIZED");
      expect(source.match(/jsonb_array_elements\(p_contract_classifications\)/g)).toHaveLength(1);
      expect(source.match(/jsonb_array_elements\(v\.payload->'contracts'\)/g)).toHaveLength(1);
      expect(source).toContain(
        "ON sc.source_snapshot_version_id = m.source_snapshot_version_id\n   AND sc.source_player_id = m.source_player_id"
      );
      expect(source).not.toContain(
        "JOIN contract_source_snapshot_versions v ON v.id = pr.source_snapshot_version_id"
      );
      expect(source).toContain("inserted_observed_agreements AS");
      expect(source).toContain("inserted_estimated_agreements AS");
      expect(source).toContain("COALESCE((c.resolution->>'estimated')::BOOLEAN, false) = false");
      expect(source).toContain("(c.resolution->>'estimated')::BOOLEAN = true");
      expect(source).toContain("contractType' = 'standard'");
      expect(source).toContain("contractType' = 'two-way'");
      expect(source).toContain("status' = 'excluded'");
      expect(source).toContain("RETURNING id, player_id");
      expect(source).toContain("source_snapshot_version_id, observed_at, notes)");
      expect(source).toContain(
        "REVOKE ALL ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)"
      );
      expect(source).toContain(
        "GRANT EXECUTE ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)"
      );
      expect(source).toContain("TO service_role");
      expect(source).not.toMatch(/^\\/m);
    }
  });

  it("keeps observed, estimated, excluded, and idempotent branches disjoint", () => {
    const source = optimizedGameContractsMigration;
    const observedAgreement = source.match(
      /inserted_observed_agreements AS \([\s\S]*?RETURNING id, player_id/
    )?.[0];
    const estimatedAgreement = source.match(
      /inserted_estimated_agreements AS \([\s\S]*?RETURNING id, player_id/
    )?.[0];

    expect(observedAgreement).toContain("estimated')::BOOLEAN, false) = false");
    expect(observedAgreement).toContain("contractType' = 'standard'");
    expect(estimatedAgreement).toContain("status' = 'resolved'");
    expect(estimatedAgreement).toContain("contractType' = 'standard'");
    expect(estimatedAgreement).toContain("estimated')::BOOLEAN = true");
    expect(source).toContain("WHEN c.resolution->>'status' = 'excluded' THEN 'inactive-excluded'");
    expect(source).toContain(
      "WHEN c.resolution->>'contractType' = 'two-way' THEN 'official-two-way'"
    );
    expect(source).toContain("IF v_existing = p_version_ids THEN");
    expect(source).toContain("RETURN jsonb_build_object('status', 'already-materialized'");
  });

  it("limits rollback to owned initializing games and game-scoped state", () => {
    for (const table of [
      "game_contract_provenance",
      "game_contract_seasons",
      "game_contract_identities",
      "game_contract_agreements",
      "game_contract_materializations",
      "contracts",
      "game_player_states",
      "game_pick_inventory",
    ]) {
      expect(rollbackMigration).toContain(`DELETE FROM ${table} WHERE game_id = p_game_id`);
    }
    expect(rollbackMigration).toContain("AND user_id = auth.uid()");
    expect(rollbackMigration).toContain("v_game.status <> 'initializing'");
    expect(rollbackMigration).not.toContain("DELETE FROM players");
    expect(rollbackMigration).not.toContain("DELETE FROM teams");
    expect(rollbackMigration).not.toContain("DELETE FROM roster_refresh_runs");
    expect(rollbackMigration).not.toContain("DELETE FROM roster_refresh_staging");
  });

  it("allows contract-copy deletes only for non-deleted initializing games", () => {
    expect(rollbackMigration).toContain("OLD.game_id");
    expect(rollbackMigration).toContain("IF TG_OP = 'DELETE' THEN");
    expect(rollbackMigration).toContain("RETURN OLD");
    expect(rollbackMigration).toContain("status = 'initializing'");
    expect(rollbackMigration).toContain("deleted_at IS NULL");
    expect(rollbackMigration).not.toContain("DROP FUNCTION rollback_seed_game_data");
  });

  it("enforces same-game ownership and immutable direct DML for every copy table", () => {
    expect(gameContractMigration).toContain("UNIQUE (id, game_id)");
    expect(gameContractMigration).toContain("FOREIGN KEY (agreement_id, game_id)");
    expect(
      gameContractMigration.match(/REFERENCES game_player_states\(game_id, player_id, team_id\)/g)
    ).toHaveLength(2);
    expect(gameContractMigration.match(/BEFORE INSERT OR UPDATE OR DELETE/g)).toHaveLength(5);
    expect(gameContractMigration).toContain(
      "Game contract snapshots may only be inserted while the game is initializing"
    );
    expect(gameContractMigration).toContain(
      "Contract coverage is insufficient; game activation is blocked"
    );
  });

  it("keeps materialization service-only and version-bound", () => {
    expect(gameContractMigration).toContain("auth.role() <> 'service_role'");
    expect(gameContractMigration).toContain(
      "Exactly 30 distinct source snapshot versions are required"
    );
    expect(gameContractMigration).toContain("already materialized from different source versions");
    expect(gameContractMigration).toContain(
      "REVOKE ALL ON FUNCTION materialize_game_contract_snapshots(UUID, UUID, TEXT, TEXT, UUID[], JSONB, JSONB)"
    );
    expect(gameContractMigration).toContain("TO service_role");
  });

  it("does not generate legacy modern salaries and leaves historical templates intact", () => {
    const seed = gameContractMigration.match(
      /CREATE OR REPLACE FUNCTION seed_game_data[\s\S]*?REVOKE ALL ON FUNCTION seed_game_data/
    )?.[0];
    expect(seed).toContain("v_game.season_era_id <> 'modern'");
    expect(seed).toContain("historical_contract_templates");
    expect(seed).toContain("refuses legacy contracts for modern games");
    expect(seed).not.toContain("45000000");
  });
});
