# Supabase migration baseline — Step 2
Objective: reproducible local baseline; production remains read-only. Branch: feat/courtside-hybrid-preview.
Delivery: ask-on-risk → feature-branch-chain (explicitly selected); forecast >400 authored lines plus recovered/generated SQL. Runner: Bun, Supabase CLI, isolated Docker PostgreSQL.

## Specs
S1. "Pin a compatible Supabase CLI version and initialize local Supabase configuration."
S2. "Recover the exact two registered migration SQL payloads through the official Supabase MCP and preserve their provenance." "Create a local migration chain containing the recovered original migrations."
S3. "Construct a reviewed catch-up baseline candidate representing the actual deployed schema through legacy migration 056."
S4. "Preserve `scripts/migrations/001–056` unchanged." "Keep `scripts/schema.sql` intact unless an explicitly justified, non-destructive change is separately approved."
S5. "Reconcile the known differences:" "Retained public-read policies on `contracts`, `players`, and `teams`." "Nullable `contracts.game_id`." "Existing `idx_scheduled_games_team`." "Explicit grants to `anon` on helper functions." "Owner-specific default privileges."
S6. "Clearly distinguish actual deployed state from desired future corrections." "Complete remaining schema-definition comparisons where possible."
S7. "Validate the baseline using an isolated local Supabase instance with synthetic test data." "Test fresh database reconstruction and migration replay."
S8. "Document any differences, blockers, and required production corrections." "Separate proposed corrective migrations for security and structural differences, but do not deploy them." "Updated migration deployment runbook." "Explicit GO / NO-GO recommendation for production baseline adoption."
S9. "If local Supabase cannot be started, report the limitation and do not claim replay verification." "Do not perform any production writes."

## Tasks
- T1 [S1,S2,S4,S9] inline; checked, commit a1edfa7: Supabase 2.90.0, initialized PG17 config, exact recovered bytes/MD5/SHA-256. Risk: item 5 (development dependency).
- T2 [S3,S5,S6,S9] inline; independently verified, commit 8a0f603: catalog-driven catch-up and public-schema parity. Risk: items 2,3 (ACL and schema contracts).
- T3 [S4,S7,S9] inline; checked, commit 8a0f603: fresh reset, populated upgrade, no-pending replay,12 pgTAP assertions and three legacy runners pass; repository-wide failures independently proven baseline-identical advisories. Long commands delegated per-action.
- T4 [S6,S8,S9] inline; independently verified, commit 1a665cb: report/runbook/inactive proposals; production NO-GO. Risk: items 2,3.

## Log
L1. Original request (2026-11-02):

> # Courtside — Supabase Migration Transition: Step 2
>
> Read the following reports before starting:
>
> - `SUPABASE_MIGRATION_TRANSITION_PLAN.md`
> - `SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md`
>
> We have successfully recovered the two original Supabase migration SQL payloads and identified confirmed production schema differences.
>
> ## Objective
>
> Prepare a reproducible Supabase CLI migration baseline **locally**, without modifying the remote database or its migration history.
>
> ## Tasks
>
> 1. Pin a compatible Supabase CLI version and initialize local Supabase configuration.
> 2. Recover the exact two registered migration SQL payloads through the official Supabase MCP and preserve their provenance.
> 3. Create a local migration chain containing the recovered original migrations.
> 4. Construct a reviewed catch-up baseline candidate representing the actual deployed schema through legacy migration 056.
> 5. Preserve `scripts/migrations/001–056` unchanged.
> 6. Keep `scripts/schema.sql` intact unless an explicitly justified, non-destructive change is separately approved.
> 7. Reconcile the known differences:
>    - Retained public-read policies on `contracts`, `players`, and `teams`.
>    - Nullable `contracts.game_id`.
>    - Existing `idx_scheduled_games_team`.
>    - Explicit grants to `anon` on helper functions.
>    - Owner-specific default privileges.
> 8. Clearly distinguish actual deployed state from desired future corrections.
> 9. Complete remaining schema-definition comparisons where possible.
> 10. Validate the baseline using an isolated local Supabase instance with synthetic test data.
> 11. Test fresh database reconstruction and migration replay.
> 12. Document any differences, blockers, and required production corrections.
>
> ## Critical safety requirements
>
> - Local filesystem changes are authorized.
> - Local disposable database operations are authorized.
> - Remote Supabase access is READ-ONLY.
> - Do not run `db push` against the remote project.
> - Do not run remote migration repair.
> - Do not modify production schema, policies, grants, data, or migration history.
> - Do not execute gameplay RPCs against production.
> - Do not copy real user data into local development.
> - Do not fabricate missing migration definitions.
> - Do not register a baseline as applied until schema parity is proven and separately approved.
> - Do not include desired security fixes inside a baseline that will be registered as already applied.
> - Preserve existing application behavior and legacy migration tests.
>
> ## Deliverables
>
> 1. Local Supabase CLI configuration.
> 2. Recovered migration files with provenance.
> 3. Catch-up baseline candidate.
> 4. Local replay and validation results.
> 5. Schema parity and drift report.
> 6. Separate proposed corrective migrations for security and structural differences, but do not deploy them.
> 7. Updated migration deployment runbook.
> 8. Explicit GO / NO-GO recommendation for production baseline adoption.
>
> If local Supabase cannot be started, report the limitation and do not claim replay verification.
>
> Do not perform any production writes.

L2. Read both reports. Existing three untracked reports are user-owned and must not be staged. Docker 29.9.2 available. Official MCP project URL matches Step 1. Recovered both payloads again with identical character counts and MD5s. Implementation stays inline: no parallel writer reason. Mapping delegated because SQL understanding exceeded initial evidence budget. Independent verification required for items 2,3,5. Engram mirror pending.

L3. User approved native blocking prompt option “Approve Supabase postinstall”; only Supabase was trusted. Pinned CLI 2.90.0, actual local/remote PG17.6. Startup initially timed out downloading; explicit local reset initialized history. Database-only stack excludes service containers; dedicated bridge verified effective 127.0.0.1:55322 binding.

L4. Official MCP catalog capture is metadata-only, single-statement MVCC snapshot; SQL registry originals match Step1 MD5s, exact UTF-8 no final newline. Catch-up generated from observed catalog, never from replaying legacy data migrations. Final local replay matches 42 tables/367 columns,55 full function definitions/ACLs,272 constraints,109 indexes,10 triggers,47 policies,96 default-ACL entries,sequence/enum/view/schema ACL/publication. Local pg_net0.20.0 is the only captured environment addition. All legacy hashes unchanged. No remote writes, linking, RPC calls or real row copies.

L5. Local failures corrected during construction: unique constraints/indexes before FKs; check functions before checks; FK-referenced standalone indexes are not constraint-owned; builtin gen_random_uuid binding requires pg_catalog ahead of extensions. Supabase-admin default alterations refused locally and rolled back; existing defaults match and remain platform prerequisites, evidence outside active chain. Comparator RED exit1 on wrong default binding; regenerated final candidate passes. Exact recovery/generation are metadata operations without a meaningful initial behavior RED; four structural/regression tests added and observed green.

L6. Canonical schema applied separately under equivalent postgres defaults. All55 full functions/ACLs match; remaining actual differences: retained policies,nullable game_id,legacy extra index,equivalent differently named schedule UNIQUE,index name,and column order in four tables. No changes to canonical source. Owner-default global hardening remains a separate decision. Inactive proposals only remove legacy policies/anon helper grants and add guarded NOT NULL, never deployed.

L7. Own checks: fresh replay/populated original-boundary upgrade/no-pending replay pass; all columns of three synthetic rows preserved; pgTAP12 pass; db lint exit0 with warnings; typecheck pass; legacy053/054/055 runners pass. Bun suite138 files/1104 tests pass with four ignored docs .cjs files failing collection; Biome new JSON format errors fixed, unrelated .engram/manifest.json format error remains. Independent verifier must classify these at baseline. Application build/HTTP/Auth-service tests not run. RDD off by clone_local; not toggled. Assessment over delegated tooling returned unassessable due undeclared untracked inventory; high-risk verification still required. Delivery strategy decision still required before any >400-line work-unit commit; no commits yet.

L8. Independent verifier confirmed every S# except one candidate-caused local isolation blocker: bare local resets recreated wildcard port bindings. Corrected once by retaining --network-id globally for every validator CLI invocation and checking network option/bindings before mutation, after each reset and finally. Added executable loopback and proposal regression probes. Parent tests pass; same verifier's B1-only recheck passes, effective127.0.0.1:55322. All implementation specs locally verified with bounded proof; adoption remains NO-GO. Verifier serial baseline/current suite and Biome failures identical, not regressions; manifest is tracked at base. Verified all57 legacy/schema files and app source unchanged; all25 literal application RPC names available. Transactional proposal tests confirm anon2→0,owners2→1,explicit helper revokes,NOT NULL positive/negative/exact errors,all42 tables+catalog hash unchanged after refusal/rollback. No extra full sweep.

L9. User selected “Feature-branch chain” for local work-unit organization, no publication authorized. Planned slices: tooling/recovery; observed-state replayable baseline; inactive corrections/report; documentation close recording exact prior commits. Generated catalog evidence/recovered SQL excluded from authored-line planning. The baseline behavior is one coherent >400-line authored unit with generation, comparison, fixtures and replay tests; splitting those would leave a non-reproducible slice, so retain it together rather than code-golf or omit checks.

L10. Local chain committed: slice1 a1edfa7 tooling/recovery (109 authored changed lines); slice2 8a0f603 observed replayable baseline (473 authored changed lines, coherent-unit exception explained in L9); slice3 1a665cb inactive corrections and runbook/report (396 authored changed lines). Running authored total978 before this specification-close document; generated JSON,lock/config,registry payloads/catch-up SQL and managed-default evidence excluded. Final passive specification-close commit accompanies slice3. No PRs,push,merge,remote writes or production metadata registration. Rollback boundaries: remove unadopted dependent local slices in reverse order only; no rollback command authorized or executed.

L11. Terminal local-preparation result: independently verified after one bounded network correction; Risk items2,3,5. Native assessment high; review disabled/unmanaged by existing clone-local user switch, unchanged. Parent spot checks pass: four Python structural tests,exact payloads,metadata parity,preservation hashes,canonical probe,transactional proposals,loopback full replay; final Docker binding127.0.0.1:55322. Required broad checks retain only baseline-identical Biome/ignored-doc-suite failures; build/browser/Auth/staging/restore checks not run. Scratch roots removed; generated Python bytecode disabled/removed. Existing three user reports still untracked and untouched. Production adoption NO-GO; no further in-scope production action authorized. Full Engram mirror/readback refreshed for this document.
