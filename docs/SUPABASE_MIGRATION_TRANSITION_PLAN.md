# Courtside Supabase Migration Transition Plan

**Status:** Read-only investigation and proposed plan; not implemented.  
**Safety:** No migration, SQL write, migration-history repair, or production data modification was performed.  
**Remote verification:** Fresh official Supabase MCP access was unavailable during this investigation. Current schema parity is therefore unverified.

> **Subsequent evidence:** [Step 1 — Remote Verification and Migration-History Recovery](SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md) records the later successful MCP inspection, recovered migration SQL, confirmed drift, and remaining proof gaps. It supersedes this document's connection-unavailable status and clarifies the helper-function permission findings; full schema parity and production adoption remain unapproved.

## Recommendation

Keep `scripts/migrations/` unchanged as a legacy archive. Do not replay migrations 001–056 against production. Prefer recovering the exact SQL for the two currently registered migration versions, replaying those locally, then adding one reviewed catch-up baseline for the verified state through legacy migration 056. Register that baseline as applied only after proving the resulting schema is already present remotely and obtaining separate approval.

If the original two migrations cannot be recovered, stop for an explicitly approved controlled rebaseline. Do not invent their contents, create misleading placeholders, or bulk-register the legacy files as applied.

Migration 057 should be the first **new timestamped Supabase CLI migration after adoption**, not a replay or retroactive registration of the legacy migration sequence. Draft scope and preservation rules must first be specified and tested.

## 1. Current state

### Repository findings

Inspection covered all 56 numbered entries. There are **55 SQL files**: `001_schema_expansion.sql` is documentation-only, while `004_deprecate_players_team_id.md` is Markdown.

| Legacy entries | Main area |
|---|---|
| 001–004 | Baseline notes, game seeding/rollback, contract constraints, deprecation |
| 005–008 | Historical roster/contract templates and seed-function revisions |
| 009–012 | Simulation/schedules, era backfill, roster ingestion |
| 013–019 | Contract snapshots, game contract materialization, roster experience |
| 020–031 | Free Agency, offers/signing, AI market, simulation integration |
| 032–043 | Roster strength, imports/releases, ratings, demographics |
| 044–052 | Possession engine, box scores/statistics, postseason |
| 053–056 | Offseason entry/contracts/options and player identifiers |

`scripts/schema.sql` is a cumulative fresh-install/bootstrap schema with later migration mirrors. It is not a replayable migration chain or a schema-only snapshot. It also seeds draft picks and game inventories for existing games (`scripts/schema.sql:828–842`).

Historical migrations contain data operations that are not implied by final DDL parity:

- 007, 009, and 011 include data backfills.
- 012 deletes staging data.
- 030 renames a simulation function.
- 048 backfills fixture-season information.
- 051 updates conference data.

Several existing tests depend on legacy migration paths and byte-identical mirrors. Preserve those paths unchanged during migration-system adoption.

### Tooling findings

- No `supabase/` directory or `config.toml` exists currently.
- The Supabase CLI is not pinned as a project dependency.
- There are no CLI migration deployment scripts.
- Existing CI runs application checks but no migration replay/upgrade checks (`.github/workflows/ci.yml:35–50`).
- Existing isolated PostgreSQL test runners can complement Supabase local development.
- Do not use `scripts/verify-db.ts` for this audit: it uses a service-role key and invokes `seed_game_data`.

Evidence for package tooling: `package.json:5–13,36–47`.

## 2. Remote evidence and drift status

The prior read-only audit at `docs/COURTSIDE_APPLICATION_AUDIT.md:360–383` reported:

- 42 public tables, all with RLS enabled; the table set was reported to match the repository.
- Two registered migration versions: `20260206190001 initial_schema` and `20260206190014 enable_rls`.
- A discrepancy in execute grants for `initialize_game_schedule`, `seed_game_data`, and `seed_game_pick_inventory` versus the repository's intended authenticated-only grants.
- Security/performance advisor observations that require investigation.

This is historical evidence, not a fresh comprehensive comparison. It did **not** establish complete function, trigger, index, constraint, policy, grant, or upgrade-data parity. Fresh official Supabase MCP tools/resources were unavailable in this session.

**Confirmed:** migration-management history does not represent all 56 numbered repository entries.  
**Not confirmed:** that all other deployed schema objects match the repository, or that every historical data migration's postconditions hold.  
**Potential drift to recheck:** the reported helper-function ACL differences.

Do not report “no drift” until current catalog evidence exists.

### Read-only comparison required before adoption

Compare the deployed database with the repository's intended final state, not every superseded historical function definition:

| Surface | Compare |
|---|---|
| Tables/columns | Types, defaults, nullability, generated/identity properties |
| Constraints | PK, FK, unique, check, validation and deferrability |
| Indexes | Definition, predicate, expressions, uniqueness, validity |
| Functions | Signature, body, return type, volatility, security mode, configuration/search path |
| Triggers | Definition, enabled state, referenced function |
| RLS | Enabled/forced state; policy roles, commands, permissiveness and expressions |
| Permissions | Schema/table/sequence/function grants, `PUBLIC` access and effective role access |
| Defaults | Owner-specific default privileges |
| Other schema objects | Enums, domains, sequences, views and security options |
| Dependencies | Extensions/versions, customizations in managed schemas |
| Operational objects | Realtime publications, relevant storage policies/buckets and scheduled jobs |

Use read-only catalog inspection such as `pg_get_functiondef`, `pg_get_triggerdef`, `pg_get_constraintdef`, and `pg_get_indexdef`. Compare normalized definitions and effective permissions rather than OIDs or formatting. Review available migration history contents securely; stored SQL can contain sensitive literals.

For historical data transformations, define read-only postcondition checks and classify each as verified, unnecessary for current data, or unverifiable. Do not infer success from table counts or DDL parity. Do not execute application RPCs as part of the audit.

## 3. Baseline and migration-history strategy

### Preferred: preserve history and add a catch-up baseline

1. Recover the original SQL for the two registered versions from a trusted source.
2. Preserve a secure export of their existing history records.
3. Recreate those migrations on a disposable local Supabase instance.
4. Compare that local state with the freshly verified deployed state.
5. Create one reviewed catch-up baseline for accepted schema through legacy 056, including any explicitly approved objects the diff tool misses.
6. Prove the complete local migration chain recreates the agreed schema and permissions.
7. After separate approval, register only that catch-up baseline as already applied remotely, **without executing its DDL on production**.

Registration asserts that the resulting state was verified as already present; it does not claim production historically executed that migration file. Document this distinction. Preserve the existing two rows.

### Fallback if original SQL cannot be recovered

Stop before adoption and request a decision about a controlled full rebaseline. Preserve/export the existing history and build a complete, reviewed baseline. Replacing the historical boundary changes existing history and requires explicit approval. Do not fabricate SQL or use empty placeholders to make the CLI appear synchronized.

### Actual drift

Classify every difference as equivalent representation, intentional deployed customization, repository omission, or unwanted deployed difference. Do not silently overwrite production or bless production as correct. Put approved security/behavior corrections in separate reviewed migrations, not hidden inside baseline registration or Draft work.

## 4. Legacy-file treatment and proposed layout

Keep `scripts/migrations/` and its existing names unchanged. Do not convert all files into CLI timestamps, copy them into active CLI history, or replay them. They contain one-time data transformations and behavior changes that are unsafe to replay indiscriminately.

After adoption, `supabase/migrations/` becomes the deployment authority. Retain `scripts/schema.sql` as a legacy bootstrap/test artifact until its callers/tests are deliberately migrated; eventually generate or check any current-schema snapshot rather than maintaining two independent deployment authorities.

```text
supabase/
  config.toml
  migrations/
    20260206190001_initial_schema.sql       # recovered original
    20260206190014_enable_rls.sql           # recovered original
    <timestamp>_reconcile_legacy_through_056.sql
    <later_timestamp>_057_nba_draft_foundation.sql
  tests/
    database/
  seed.sql                                  # synthetic local/test data only

scripts/
  migrations/                               # unchanged legacy archive
  schema.sql                                # legacy bootstrap/test artifact

docs/database/
  migration-transition.md
  schema-verification.md
  deployment-runbook.md
```

## 5. Local and staging workflow

### Tool setup

Choose and validate an exact CLI release, then pin it:

```bash
bun add --dev --exact supabase@<APPROVED_VERSION>
bunx supabase --version
bunx supabase init
```

Configure compatible Postgres/extensions and local Auth behavior. Keep credentials, linking artifacts, private exports, and production data out of Git.

### Local fresh-install validation

Use a fresh disposable local Supabase instance; let it apply the committed migration chain. Seed synthetic fixtures only.

```bash
bunx supabase start
bunx supabase db lint --local --fail-on error
bunx supabase test db
bun biome check
bun run typecheck
bun run test
bun run build
```

Add database tests as needed and keep running relevant existing isolated PostgreSQL integration runners.

### Populated-upgrade validation

Start from the previous release with representative synthetic fixtures, then apply only pending migrations. Verify preservation of game state/ownership, trades, contracts, offers, schedules, statistics, and offseason records; RLS and cross-user denial; existing RPC compatibility; failure atomicity; and acceptable locking/runtime cost.

Use staging with the exact reviewed migration files intended for production. Any production-derived staging copy requires separate authorization, sanitization, and access controls.

## 6. Controlled adoption and production deployment

The following are **future proposed commands only**. They were not run. Remote operations require explicit authorization for the destination, operation, and credentials.

After recovery and authorization:

```bash
bunx supabase link --project-ref "$APPROVED_PROJECT_REF"
bunx supabase migration list --linked
bunx supabase migration fetch --linked
```

Inspect fetched files. Fetching cannot recover migration SQL that was never stored; missing originals block the preferred path.

For a schema-only review artifact:

```bash
bunx supabase db dump \
  --linked \
  --schema public \
  --file "$PRIVATE_REVIEW_DIR/public-schema.sql"
```

Supplement the dump with catalog evidence. A public-schema dump does not cover every managed-schema customization, role, effective permission, or operational object. Avoid `db pull` during read-only investigation: it can update remote migration history.

After recovering the two original migrations, use an isolated adoption workspace to generate a catch-up candidate:

```bash
bunx supabase start
bunx supabase db diff \
  --linked \
  --schema public \
  -f reconcile_legacy_through_056
```

Review every generated statement and explicitly cover ACLs, default privileges, managed-schema customizations, publications, and objects the selected diff engine cannot represent. Apply the candidate locally only, then prove fresh replay, catalog parity, permission parity, and separation of reference-data seeding from game data.

Only after proof, backup readiness, a final drift check, and separate approval:

```bash
# FUTURE METADATA WRITE: registers the verified baseline; does not execute its DDL.
bunx supabase migration repair "$BASELINE_VERSION" \
  --status applied \
  --linked

bunx supabase migration list --linked
bunx supabase db push --linked --dry-run
```

The dry run must propose no migration execution at this adoption boundary. Supabase migration listing compares versions/timestamps; it is not semantic proof of schema parity.

For every later production release:

1. Require successful fresh-install and populated-upgrade CI.
2. Deploy the exact reviewed SQL to staging and verify behavior, catalog results, and data preservation.
3. Obtain production approval and confirm backup/restore readiness.
4. Verify production identity, migration history, and drift.
5. Review the pending list with `bunx supabase db push --linked --dry-run`.
6. Apply only the approved files through one serialized deployment job:

   ```bash
   # FUTURE PRODUCTION WRITE — approval required.
   bunx supabase db push --linked
   ```

7. Verify history, schema, permissions, and approved read-only health checks.

Do not add `--include-all`, `--include-seed`, or `--include-roles` to bypass a discrepancy. Investigate it.

## 7. Data preservation and rollback

| Risk | Control |
|---|---|
| Legacy replay repeats backfills/deletions | Archive legacy files; never deploy them again |
| Baseline omits grants or objects | Catalog/effective-access checks and replay validation |
| Registration falsely asserts parity | Evidence-backed approval before metadata repair |
| Migration blocks gameplay | Staging rehearsal and bounded lock/statement timeouts |
| Schema rollback destroys new data | Prefer additive changes and forward fixes |
| Restore loses activity since backup | Document recovery point, downtime, and reconciliation procedure |

For baseline adoption, rollback concerns the new history record, not application tables; preserve original records and repair only the exact adoption entry if separately approved. For later migrations, favor expand/contract changes compatible with the previous app. Migration-history repair is bookkeeping, not schema rollback. Do not blindly drop newly populated tables; prefer reviewed compensating migrations. Restore from backup only when its data-loss implications are understood.

A schema dump is **not** a game-data backup. Verify backup/PITR availability and rehearse restoration into an isolated destination before adoption.

## 8. Prerequisites before migration 057

- [ ] Fresh official-MCP catalog and permission comparison completed.
- [ ] Drift explicitly resolved or documented and accepted.
- [ ] Original two migrations recovered, or fallback rebaseline explicitly approved.
- [ ] Baseline replay and populated-state validation passed.
- [ ] Production adoption history verified without replaying existing DDL.
- [ ] CLI/configuration pinned and committed.
- [ ] Local/staging/production isolation and deployment ownership established.
- [ ] Backup restoration rehearsed.
- [ ] Migration CI and deployment runbook available.
- [ ] Draft-foundation scope and preservation invariants agreed.

Existing Draft rules are documented in `docs/NBA_BUSINESS_RULES.md:395–444, 666–674`; first produce a bounded foundation specification. Then generate the new timestamped migration:

```bash
bunx supabase migration new 057_nba_draft_foundation
```

Use the generated timestamp as the migration identity and retain `057` as the legacy feature-sequence label. Write explicit SQL, or generate a diff only from disposable local changes, then review every statement. Test Draft ownership, existing traded-pick preservation, referential integrity, RLS, failure atomicity, and compatibility with existing offseason/game state. Applied migration files are immutable; corrections get new timestamps.

## 9. Official references

- [Supabase CLI migration list](https://supabase.com/docs/reference/cli/supabase-migration-list)
- [Supabase CLI schema dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase CLI schema diff](https://supabase.com/docs/reference/cli/supabase-db-diff)
- [Supabase CLI migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)

## Verification boundary

Repository inspection and official CLI documentation informed this proposal. No SQL, migration, database-object, production-data, or migration-history writes were performed. No fresh remote schema comparison or tests were run. **Production schema parity remains unverified; baseline adoption must wait for that proof.**
