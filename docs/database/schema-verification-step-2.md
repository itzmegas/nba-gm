# Step 2 — local baseline results and drift

**GO for continued local/staging preparation; NO-GO for production baseline adoption.**
The observed-state chain reconstructs locally and matches the captured public
application schema. Production was read-only throughout. Nothing was linked,
pushed, repaired, registered, corrected or seeded remotely.

Evidence date: 2026-11-02. Base commit: `95156fecff4fd447880331fd0c886a2e14324a11`.
Prior evidence: [Step 1](../SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md).
Operational instructions: [deployment runbook](deployment-runbook.md).

## What was prepared

| Deliverable | Location |
|---|---|
| Exact CLI 2.90.0 pin and trusted postinstall | `package.json`, `bun.lock` |
| Dedicated local project, PostgreSQL 17, ports 55320–55322 | `supabase/config.toml` |
| Exact recovered originals (no extra newline) | `supabase/migrations/20260206190001_initial_schema.sql`, `20260206190014_enable_rls.sql` |
| Character/byte counts, MD5, SHA-256, source binding | `supabase/baseline/provenance.json` |
| Observed catch-up candidate through legacy 056 | `supabase/migrations/20261102170000_reconcile_legacy_through_056.sql` |
| Single-statement catalog query and remote/local/canonical snapshots | `supabase/baseline/` |
| Deterministic generation, structural checks, replay checks | `scripts/*supabase-baseline.py` |
| Synthetic-only database tests and upgrade fixtures | `supabase/tests/database/`, `supabase/baseline/upgrade-*.sql` |
| Separate, inactive correction proposals | `supabase/proposals/` |

The official MCP URL matched authorized project `yyxqyziilzgnoztfcjgj`.
Registry payloads were retrieved again through official MCP, not reconstructed
from descriptions. MD5 fingerprints still match Step 1:
`6a2530ad179d27216644f6741e9c6680` and `f4046c2b4391216ba4b1152b2fbd7535`.
Stored SQL identity is not proof that every historical manual migration ran.

`scripts/schema.sql` and all legacy migration files remain byte-identical;
SHA-256 verification was performed. Existing application source and legacy tests
were not edited. The pre-existing untracked reports remain user-owned.

## Definition-level parity

`catalog.sql` obtains each complete comparison snapshot in one SQL statement/MVCC
snapshot. It selects metadata and registry SQL only, never application records.
Remote and local captures are different instants: this is not a production freeze.

| Captured surface | Fresh local result |
|---|---|
| 42 tables, one view, one sequence; 367 table columns | Match, including ordered columns, types, complete defaults, nullability, collation and identity/generated flags |
| 272 constraints | Exact name/definition/validation match, including FK actions and deferrability represented by catalog DDL |
| 109 indexes | Exact definitions, predicates, uniqueness, validity/readiness and ownership classification match |
| 55 application functions | Complete `pg_get_functiondef`, owner and explicit ACLs match, not just body hashes |
| 10 non-internal triggers | Exact definition and enabled mode match |
| 47 policies and table RLS/force state | Match |
| Object ACLs, public schema ACL | Match, including role/grantor/grant-option distinctions |
| 96 owner-specific default-ACL entries | Match for `postgres` and `supabase_admin` |
| Enum labels, sequence parameters, view options | Match; sequence counter values deliberately not copied |
| Realtime publication | Matching `supabase_realtime`, no published tables |
| PostgreSQL | 17.6 remotely and locally |

Only ACL order is normalized; SQL strings and column order remain exact. Extension
owned objects are excluded from application inventories, not falsely counted as
application functions. Local `pg_net 0.20.0` is an explicitly reported environment
addition; all six deployed extensions and versions are present locally. Thus this
is public-application parity, **not an identical whole-platform installation**.

The catch-up contains schema/permission DDL and exact final function definitions,
not top-level legacy data backfills or destructive cleanup. Function bodies retain
their existing gameplay DML, but migration replay does not invoke those RPCs.
All runtime reference-data seeding remains separate from baseline application.

Managed-owner defaults require special care: local `postgres` cannot alter
`supabase_admin` defaults. An initial local attempt correctly refused and rolled
back. Those defaults already match exactly and are retained as platform
prerequisites. `managed-owner-defaults.sql` is observed evidence, not an active
migration or an instruction to escalate privileges. The active migration explicitly
reproduces the `postgres` defaults and per-object ACLs.

## Actual state versus canonical/future intent

The untouched canonical schema was applied in a separate disposable local database
with synthetic Auth stubs and the same `postgres` application-role defaults.
This distinguishes real differences from bare-PostgreSQL permission artifacts.
The generated `canonical-drift.json` retains the raw comparison.

| Difference | Baseline disposition | Future correction |
|---|---|---|
| Three retained public-read policies | Preserve all three; inherited from recovered RLS migration | Inactive proposal 057 removes them, subject to approval |
| Anonymous helper EXECUTE | Preserve explicit deployed grants | Proposal 057 revokes `anon` explicitly; PUBLIC-only revocation is insufficient |
| Nullable `contracts.game_id` | Preserve nullable deployed state | Proposal 058 refuses NULL rows, then sets NOT NULL; approval and lock rehearsal required |
| `idx_scheduled_games_team` | Preserve exact deployed legacy index | No removal proposed |
| Owner-specific broad defaults | Preserve and verify actual defaults | Global hardening is a separate access-contract decision, not silently proposed here |
| Schedule uniqueness name | Preserve `scheduled_games_unique_matchup`; canonical uses auto-generated name | Same UNIQUE definition/index columns; no rename needed for parity |
| Column order in players/contracts/games/roster_refresh_staging | Preserve deployed order exactly | No reorder proposed; named-column application access remains unchanged |

All canonical constraint definitions match after accounting for that one equivalent
constraint name; all canonical index definitions match after that name and the
retained extra index. All 55 complete function definitions **and ACLs** match under
the inspected Supabase defaults. These grants are under-specified by canonical SQL,
not evidence that its functions were skipped.

The permissive contracts policy still defeats owner-only SELECT isolation. Local
synthetic anonymous SELECT confirms the deployed policy behavior, not its safety.
It is deliberately **not fixed inside a baseline that might be marked applied**.

## Observed checks

| Check | Result |
|---|---|
| Exact originals + generator/comparator regression checks | PASS, four Python tests |
| Fresh `db reset --local --no-seed` | PASS, all three versions |
| Original-boundary populated upgrade via `migration up --local` | PASS, every original value preserved for synthetic team/player/contract |
| Repeated no-pending `migration up --local` | PASS, unchanged rows |
| Fresh catalog comparison | PASS for captured application surfaces; pg_net environment difference reported |
| `supabase test db` | PASS, 12 pgTAP tests; transaction rolled back |
| `supabase db lint --local --fail-on error` | Exit 0, warnings remain (shadowed/unused variables and volatility observations in unchanged functions) |
| `bun run typecheck` | PASS |
| Legacy 053, 054, 055 isolated PostgreSQL runners | PASS, including snapshots, access guards and concurrency checks |
| `bun biome check` | Initial new JSON formatting issues fixed; one unrelated `.engram/manifest.json` formatting error remains |
| `bun run test` | 138 files / 1,104 tests passed; four ignored documentation `.cjs` files fail collection with “No test suite found” |
| Build / HTTP / browser / Auth-service tests | Not run; no application code changed, database-only rehearsal |
| Independent high-risk verification | PASS for local preparation; schema/proposals/preservation verified and network blocker resolved in scoped recheck |

Startup initially timed out while pulling images; startup success alone left no
migration history. A successful explicit local reset subsequently initialized and
replayed the chain. Early candidate replays exposed dependency-order and managed
privilege errors; they were corrected locally before the successful final replay.
The default binding selected the wrong `gen_random_uuid` implementation in an early
candidate; the parity checker failed, and corrected search-path ordering restored
exact default-expression parity. No such experiment ran remotely.

The final local database is on a dedicated loopback-binding Docker bridge,
`127.0.0.1:55322`. The application environment was not changed. Native review is
clone-locally disabled and was not enabled; independent functional verification
remains required regardless of that switch.

Independent verification found that CLI resets silently discarded that network
and exposed the database on wildcard interfaces. The validator now passes the
network explicitly on every invocation and checks effective loopback binding
before mutation, after each reset and at completion. A dedicated regression probe
repeats the full reset sequence. Independent scoped recheck passed: both resets and
final inspection retain exactly `127.0.0.1:55322`.

The verifier reproduced the same Biome and four documentation-collection failures
against the baseline with identical inputs; these are pre-existing advisories,
not introduced regressions. `.engram/manifest.json` is tracked at baseline.

## Remaining proof and adoption blockers

- Independent verification passed after one bounded correction; repository-wide
  checks still report the baseline-identical advisory failures listed above.
- Synthetic upgrade coverage is deliberately bounded to original tables; full
  populated gameplay/staging compatibility, restore readiness, locking and rollout
  rehearsal are still required before production adoption.
- Historical backfill/data-postcondition success remains unproven; DDL parity does
  not establish it. No real user data was copied or read for this phase.
- Additional read-only inventory found zero public partitioned/materialized/foreign
  relations, domains, explicit column ACLs, Auth/Storage policies, storage buckets
  and pg_cron extensions. Managed Auth/Storage/Realtime schema internals, custom
  dependencies and operational platform configuration are not exhaustively matched.
- Security-policy/grant corrections need an explicit product/security decision and
  separate deployment authorization. This baseline reproduces an unsafe contract
  read policy; it does not endorse it.
- Refresh remote evidence immediately before any adoption, verify backups/PITR and
  restore rehearsal, and obtain separate approval for exact metadata registration.

**Production recommendation: NO-GO.** Local reconstruction is demonstrated; complete
operational parity, adoption readiness and authorization are not. Do not register
the baseline or deploy either proposal from this preparation session.
