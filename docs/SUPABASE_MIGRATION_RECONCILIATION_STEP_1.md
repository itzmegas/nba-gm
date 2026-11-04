# Supabase Migration Reconciliation — Step 1 Evidence Report

**Decision:** GO for separately authorized, isolated local baseline preparation. NO-GO for declaring complete schema parity, registering a baseline, or changing production.  
**Scope:** Remote verification and migration-history recovery only; no implementation.  
**Evidence date:** 2026-11-02. Repository commit inspected: `95156fe`.

This report supplements the [migration transition plan](SUPABASE_MIGRATION_TRANSITION_PLAN.md). The official Supabase MCP became available after that plan was written. The two registered SQL payloads are recoverable, but meaningful differences and incomplete definition-level comparisons remain. No repository files were changed during the remote investigation; this report and the plan cross-reference were added afterward at the user's request.

## 1. Connection and target

- Official Supabase MCP was available and responded successfully.
- Target project reference: `yyxqyziilzgnoztfcjgj`.
- The target matched the application's active `NEXT_PUBLIC_SUPABASE_URL`.
- PostgreSQL version: **17.6**.
- No credentials or row-level application records were retrieved.

Remote access used metadata tools and read-only catalog queries. The only application-data query returned aggregate contract counts. No gameplay RPCs were called.

## 2. Migration-history recovery

Both registered migration rows contained non-empty SQL. Their complete stored SQL payloads were retrieved without saving migration files or editing history.

| Version | Name | SQL characters | Recorded contents |
|---|---|---:|---|
| `20260206190001` | `initial_schema` | 1,845 | Creates `teams`, `players`, `contracts`, and three indexes |
| `20260206190014` | `enable_rls` | 657 | Enables RLS on those tables and creates three public-read policies |

Each row has one stored array payload containing multiple SQL statements. Neither contains rollback SQL.

| Payload | MD5 fingerprint |
|---|---|
| `initial_schema` | `6a2530ad179d27216644f6741e9c6680` |
| `enable_rls` | `f4046c2b4391216ba4b1152b2fbd7535` |

These fingerprints identify the retrieved registry payloads; they are not cryptographic provenance guarantees. Recovery establishes what the registry stores, not that all historical manual changes were recorded or that original human-authored files are byte-identical.

**Conclusion:** The SQL-recovery prerequisite for the preferred baseline strategy is satisfied. Replay has not been attempted.

## 3. Comparison coverage

| Surface | Evidence and result |
|---|---|
| Tables | All **42 table names** match the canonical schema |
| Columns | **367 columns** compared for names, types, nullability, and default presence; one mismatch |
| Identity/generated columns | None found remotely |
| Function signatures/bodies | All **55 signatures and body hashes match** final source definitions, accounting for function renames |
| Function configuration | All functions inventoried; complete header/configuration parity not exhaustively established |
| Triggers | All **10 application triggers** compared semantically and match |
| Constraints | **272**, none unvalidated; 12 definitions compared and match |
| Indexes | **109**, all valid and ready; 13 representative definitions match, plus the legacy index described below |
| RLS state | Enabled on all **42 tables**; none forced |
| Policies | **47 live policies versus 44 canonical definitions**; three retained legacy policies identified |
| Grants | Effective access inspected across **43 relations**, **55 functions**, and the public sequence |
| Default privileges | Inspected; broad Supabase defaults are not explicitly specified by repository SQL |
| Other objects | Enum labels, sequence parameters, and the security-invoker view match inspected source |

### Method and proof limits

Function bodies were extracted from canonical source, tracking `ALTER FUNCTION ... RENAME` history, and compared using body hashes after trimming surrounding whitespace only. Internal whitespace and literals were preserved. All 55 signatures matched.

Column fingerprints compare names, types, nullability, and default presence. They do not establish column-order parity or complete default-expression equivalence. All 367 expected columns were represented; fingerprints matched for 41 tables, with `contracts` differing because of `game_id` nullability. A separate detailed comparison of the three initial tables isolated that mismatch.

Default expressions were inventoried, but their complete per-column mapping remains unverified. Complete definition-level equivalence is also unproven for remaining constraints, indexes, policy definitions, and function-header attributes. Catalog queries were separate read snapshots, not a frozen database-wide comparison transaction.

**Do not interpret matching inventories or function bodies as complete schema parity.**

## 4. Confirmed meaningful differences

### A. Retained public-read policies defeat contract SELECT ownership isolation

The deployed database retains:

```text
Allow public read access to contracts
Allow public read access to players
Allow public read access to teams
```

All three are `PERMISSIVE`, apply to `SELECT` for `anon` and `authenticated`, and use `USING (true)`. Effective anonymous SELECT privileges were confirmed on all three tables.

The canonical schema instead defines authenticated-only team/player reads and owner-scoped contract reads (`scripts/schema.sql:470–542`). Because permissive policies combine with OR semantics, the unrestricted contracts policy defeats the newer owner-scoped SELECT restriction at the database-policy level.

No anonymous HTTP request or user-record retrieval was performed. This conclusion comes from the combined catalog ACLs and policy definitions, not an end-to-end access test.

**Provenance:** The recovered `enable_rls` payload creates these exact policies. Canonical SQL does not drop their legacy names, so they can survive subsequent manual updates. They are canonical-vs-live differences with known legacy provenance, not unexplained out-of-band additions.

**Required disposition:** Explicitly decide the intended read-access contract and authorize any correction separately. Do not silently absorb this difference as harmless parity.

### B. `contracts.game_id` is nullable remotely

| Evidence | Requirement/state |
|---|---|
| `scripts/schema.sql:47–50` | `NOT NULL` |
| `scripts/migrations/003_enforce_game_id_not_null.sql:29–30` | Explicitly sets `NOT NULL` |
| Live catalog | Nullable |

Aggregate verification returned:

```text
Total contracts:             13,625
Contracts with NULL game_id:      0
```

This is structural drift. The absence of current NULL values is useful for planning, but does not prove migration 003 ran or authorize changing the constraint. The cause of the mismatch was not established.

### C. Canonical schema omits a legacy index

`idx_scheduled_games_team` exists remotely and is defined in `scripts/migrations/009_season_simulation.sql:29`, but is absent from `scripts/schema.sql`.

This is a canonical-schema omission relative to repository history, not an unexplained remote index. Preserve it deliberately in baseline preparation rather than automatically treating it as an object to remove.

## 5. SECURITY DEFINER permissions and default privileges

### Verified helper access

The following helpers remain executable by `anon`:

```text
initialize_game_schedule(uuid)
seed_game_data(uuid,uuid)
seed_game_pick_inventory(uuid)
```

They have explicit role grants while PUBLIC EXECUTE is revoked. Source at `scripts/schema.sql:643–644,801–802,984–985` revokes PUBLIC and grants authenticated, but does not explicitly revoke anonymous or service-role grants.

**Correction to the earlier interpretation:** `REVOKE ... FROM PUBLIC` does not remove existing explicit grants to `anon` or `service_role`. `CREATE OR REPLACE FUNCTION` also preserves existing ACLs. These observed helper grants are compatible with the source running under Supabase defaults; they do not independently prove that a migration was skipped. Authenticated-only access is an under-specified permission contract if that is the intended behavior.

Two trigger functions are also anonymously executable:

- `enforce_game_contract_copy_immutability()` — also grants PUBLIC EXECUTE.
- `seed_game_pick_inventory_after_game()`.

A trigger-function EXECUTE grant alone does not establish that an ordinary RPC can invoke its trigger behavior.

Core RPC checks confirmed that `advance_simulation_day` and `submit_free_agency_offer` are authenticated-executable and not anonymously executable. No application RPC was called to test runtime behavior.

### ACL inventory

| Object category | Effective application-role access |
|---|---|
| 43 relations | Anonymous: broad table privileges on 14, none on 29; authenticated: broad privileges on 19, SELECT on 17, none on 7; service role: broad privileges on 26, SELECT on 5, none on 12 |
| 55 functions | Anonymous EXECUTE on 5, authenticated on 19, service role on 18; all five anonymously callable functions are SECURITY DEFINER |
| Public sequence | `contract_snapshot_revalidation_revision_seq`: service-role SELECT/UPDATE/USAGE; no anonymous/authenticated access |
| Public schema | PUBLIC and application roles have USAGE, not CREATE |

Table ACLs alone do not establish row access; RLS must be evaluated together with them. The contracts finding above includes both pieces of evidence.

### Default privileges

For objects created by `postgres` in `public`, live defaults directly grant `anon`, `authenticated`, and `service_role`:

- Broad table privileges.
- Function EXECUTE.
- Sequence SELECT/UPDATE/USAGE.

Similar application-role defaults exist for `supabase_admin`. No `ALTER DEFAULT PRIVILEGES` statements were found in repository SQL. These defaults can produce different results from bare PostgreSQL fixtures.

**Baseline implication:** Capture the intended owner-specific defaults and explicit per-object ACLs. Do not assume a dump, a PUBLIC-only revoke, or plain PostgreSQL test setup establishes the effective Supabase permission contract.

## 6. Preferred baseline feasibility

**GO for isolated local preparation:** Both registered payloads are recoverable, so there is no need to invent migration contents or delete existing history to begin investigating the preferred chain.

The next separately authorized phase can preserve recovered SQL with provenance, replay it locally, construct a catch-up candidate, complete catalog comparisons, and test fresh installation and populated upgrades.

The baseline must distinguish:

1. The state actually deployed, including retained policies and nullable `game_id`.
2. Desired corrections that are not yet deployed and require separate reviewed migrations.

**Do not include corrective DDL absent from production and then register it as already applied.** Stored-SQL recovery does not by itself approve baseline replay, parity, registration, or production deployment.

## 7. Unresolved prerequisites

- [ ] Decide the three public-read policies, prioritizing contract ownership isolation.
- [ ] Reconcile `contracts.game_id` nullability.
- [ ] Preserve or explicitly disposition the migration-009 index.
- [ ] Complete remaining definition-level comparisons and default-expression mapping.
- [ ] Specify owner-specific default privileges and per-object ACLs explicitly.
- [ ] Prove local replay and populated-upgrade data preservation.
- [ ] Verify backup/restore readiness before remote mutation.
- [ ] Obtain separate authorization before local implementation or any production change.

## Final recommendation

**GO:** Begin separately authorized, isolated local baseline preparation using the recovered registered SQL.  
**NO-GO:** Claim complete parity, register/repair history, apply corrective changes, or deploy migration 057 yet.

The remote investigation performed no SQL writes, migration/history changes, permission changes, gameplay RPC calls, or production data modifications. End-to-end access behavior and complete catalog equivalence remain unverified. The original transition plan remains a proposal, now supplemented by this evidence.
