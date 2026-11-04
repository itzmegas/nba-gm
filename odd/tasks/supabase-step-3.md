# Supabase Step 3 — local correction compatibility
Objective: validate inactive corrections without changing the baseline or production.
Branch: feat/courtside-hybrid-preview. Delivery: ask-on-risk, forecast ~350 authored lines. Runners: Python, Bun, local PostgreSQL.

## Specs
S1. "Review `supabase/proposals/057_restrict_legacy_reads.sql` and `058_contract_game_required.sql`." "Trace every application query and RPC that depends on the affected tables, policies, and helper-function grants."
S2. "Build local integration tests for anonymous access, authenticated users, cross-user isolation, and service-role operations." "Verify that contract reads are correctly restricted to their intended owners without breaking roster, trade, free-agency, or offseason workflows." "Test the security correction locally against the reconstructed Supabase schema."
S3. "Test the `contracts.game_id NOT NULL` proposal with valid and invalid synthetic data." "Verify that existing game creation, seeding, roster refresh, contract materialization, and simulation operations remain compatible." "Run all relevant existing PostgreSQL integration tests."
S4. "Fix any proposal defects locally without modifying the already-validated baseline." "Produce a compatibility report identifying regressions, required application changes, and remaining risks."
S5. "Do not deploy anything to production." Preserve baseline/legacy files, use synthetic disposable local data only, and keep proposals inactive. Checks: preservation hashes and local target/binding checks.

## Tasks
- T1 [S1,S5] inline; inventory reported, independent exhaustiveness unproved; commit `3cf4b3e`. Mapping trigger: complete dependency inventory exceeds bounded inline evidence.
- T2 [S2,S3,S4,S5] inline; partial, SQL isolation/constraints pass, two existing PostgreSQL suites fail and denied-anon runtime proof unavailable; commit `3cf4b3e`. Risk: item 2 (security probes), item 1 (constraint rehearsal only).
- T3 [S1-S5] inline; report complete, independent verification partial, Needs your decision; commit `3cf4b3e`. Route: no writer trigger; parent owns implementation. Mirror: odd/supabase-step-3/tasks.

## Log
L1. Original request (verbatim):

# Courtside — Supabase Migration Transition: Step 3

Read these documents first:

- `docs/database/schema-verification-step-2.md`
- `docs/database/deployment-runbook.md`
- `SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md`

The local Supabase baseline has been successfully reconstructed and validated. Production adoption remains NO-GO.

## Objective

Validate the proposed security and contract-integrity corrections against the existing application and representative synthetic franchise data.

Do not modify production.

## Tasks

1. Review `supabase/proposals/057_restrict_legacy_reads.sql` and `058_contract_game_required.sql`.
2. Trace every application query and RPC that depends on the affected tables, policies, and helper-function grants.
3. Build local integration tests for anonymous access, authenticated users, cross-user isolation, and service-role operations.
4. Verify that contract reads are correctly restricted to their intended owners without breaking roster, trade, free-agency, or offseason workflows.
5. Test the security correction locally against the reconstructed Supabase schema.
6. Test the `contracts.game_id NOT NULL` proposal with valid and invalid synthetic data.
7. Verify that existing game creation, seeding, roster refresh, contract materialization, and simulation operations remain compatible.
8. Run all relevant existing PostgreSQL integration tests.
9. Fix any proposal defects locally without modifying the already-validated baseline.
10. Produce a compatibility report identifying regressions, required application changes, and remaining risks.

## Safety requirements

- Remote Supabase access is strictly read-only.
- Local disposable database writes are authorized.
- Do not execute remote migration repair, `db push`, or schema changes.
- Do not modify production data, policies, grants, or migration history.
- Do not copy real user data into local testing.
- Preserve the existing baseline and legacy migration files.
- Keep corrective migrations separate from the baseline.
- Do not promote proposals to the active migration chain without separate approval.

## Deliverables

- Security and compatibility test results.
- Confirmed impact on application queries and RPCs.
- Revised correction proposals, if needed.
- Explicit PASS/FAIL for anonymous and cross-user isolation.
- Regression assessment for franchise gameplay.
- GO/NO-GO recommendation for staging validation and eventual production deployment.

Do not deploy anything to production.

L2. Read required documents; Step 1 resolves to docs/SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md. Clean starting worktree. Existing local container binds only 127.0.0.1:55322. No remote access planned. Baseline proposal runner already tests basic SQL isolation and NOT NULL refusal; expand coverage separately.
L3. Local probes reproduce baseline anonymous leak (RED), corrected read isolation (GREEN), service access, final-schema trades, 30-team creation/promotion/materialization, historical seed, offseason/market/terminal simulation. Full public hashes preserved. No proposal defect demonstrated; proposals remain unchanged. Two attempts at denied anonymous RPC execution crashed local PostgreSQL; no further retry. Eight initial legacy suites passed; follow-up pending-offer suite passed, player-attributes failed at 15-team qualification guard. Free-agency-days failed at missing image identifiers. Typecheck passed; 1104 Vitest tests passed with four docs collection failures; Biome has existing manifest error. Details in docs/database/schema-verification-step-3.md.
L4. Independent verifier PARTIAL; preserved all 73 protected files and confirmed rejected cross-owner insert/reassignment plus NULL update state invariants. Added those boundary regressions inline. No correction findings. No commit while required proof remains missing; no push/PR. Needs your decision: separately authorize/resolve local PostgreSQL crash, legacy fixture failures and Auth/PostgREST full-gameplay coverage before promotion. RDD remains clone-locally off.
L5. The Step 3 local security/workflow probes and their partial-result report were committed as work unit `3cf4b3e` (`test(db): verify local correction compatibility`); no files from Step 3.1 are included in that commit.
