# Step 3.1 — local validation blockers: resolution results

**GO for continued local validation. NO-GO for staging promotion and production deployment.**
Both previously failing legacy suites now pass in isolation, and expanded 450-player
gameplay completes a full season lifecycle under the corrected policies on vanilla
PostgreSQL. Two blockers remain: the Supabase-image denied-RPC crash is unresolved,
and canonical-only trade execution is blocked by pre-existing application SQL.

Evidence: 2026-11-04; base `d460a5b22130e1a443db0358fac6d07cb2145b30`.
Read [Step 3](schema-verification-step-3.md), [Step 2](schema-verification-step-2.md),
and the [runbook](deployment-runbook.md) first. Task log: `odd/tasks/supabase-step-3-1.md`.

## Task A — denied-anonymous RPC SIGSEGV

Investigated in disposable containers only (`--network none`, tmpfs, no ports/binds);
the shared rehearsal database was never targeted.

| Probe | Result |
|---|---|
| Minimal case: revoked SECURITY DEFINER function invoked as anon | Supabase `postgres:17.6.1.106` terminates backend with signal 11; function body never runs (counter unchanged); no SQLSTATE returned |
| Role contexts: `SET ROLE`, `SET SESSION AUTHORIZATION`, direct anon login | All three crash identically on the Supabase image |
| `shared_preload_libraries=''` on the same Supabase image | Still crashes → not a single preload library alone (empty preloads also break pg_stat_statements semantics, 55000) |
| Same SQL on vanilla `postgres:17-alpine` (17.11) | SQLSTATE `42501` permission denied under all three role contexts |
| All three real revoked helpers after 057 on the full application schema (vanilla) | `initialize_game_schedule(uuid)`, `seed_game_data(uuid,uuid)`, `seed_game_pick_inventory(uuid)` each deny `42501`; all affected row counts unchanged |

**Root cause: UNRESOLVED.** The evidence rules out the function body, role switching
alone, and the preload set as a whole, but the Supabase build (17.6, GCC 15.2, platform
preloads) versus vanilla (17.11, musl) comparison cannot attribute the fault further.
Per the standing constraint the crash is not reproduced again; the Supabase-image
runtime denial proof stays **BLOCKED**, and ACL checks alone are not accepted as PASS.
Safe local approach adopted: actual revoked invocations asserting `42501` with
state-unchanged checks, run on vanilla PostgreSQL only (`scripts/test-supabase-step31.py`).
Bounded logs: `/tmp/opencode/nba-gm-step31-cq2eHp/`.

## Task B — legacy suite failures

| Suite | Root cause | Fix | Result |
|---|---|---|---|
| free-agency-days | `freeAgencyMarketRead.postgres.sql` asserts 056 image fields (`nba_id`/`espn_id` on candidates 005/017) but executed at the 031 boundary, before `is_available_free_agent` (035) and the image fields (056) existed | Defer that fixture to after 035 and apply 056 there (`scripts/test-free-agency-days-postgres.ts`); fixture moved, assertions untouched | **PASS** (exit 0, all phases incl. concurrency) |
| player-attributes | `advance_simulation_day` now completes schedules through `freeze_postseason_qualification` (049), which requires 15 teams per conference; the fixture had 2 teams without conferences and standings for only 2 | 26 synthetic conference teams + completed standings in `playerAttributeSimulation.postgres.sql`; one assert narrowed to `game_date='2026-10-02'` because qualification adds playoff rows to the same game (invariant unchanged) | **PASS** (exit 0) |

Both failures existed independently of the proposals (boundary suites never apply them).
No business logic, migration, or proposal file was changed. Harness hard-coded dead
container ID in `scripts/test-player-attributes-postgres.ts` replaced with ID-shape
validation; the inspect-based isolation checks (image, label, network, ports, tmpfs,
binds) are retained.

Dependency reruns: possession-engine **PASS** (after removing a `competition_phase`
filter that referenced a column created in 049 while that suite loads schema through
046), offseason entry/contracts/player-options **PASS**, postseason-qualification
**PASS**, `bun run typecheck` **PASS**. `bun biome check` reports only the
pre-existing `.engram/manifest.json` baseline formatting advisory.

## Task C — expanded gameplay validation

`scripts/test-supabase-step31.py` (disposable vanilla PostgreSQL 17.11, network none,
tmpfs, synthetic data only; proposals applied inside the container, never promoted):

| Invariant | Result |
|---|---|
| Game creation and seeding (30 teams, 450 players, 870-game schedule, 450 roster states, zero legacy contracts) | **PASS** |
| Roster ownership (15 per team) and canonical contracts (450 agreements, salary accounting) | **PASS** |
| Trade execution between teams | **FAIL**: `Player contract is missing` — `execute_trade_transactional` requires legacy or runtime contract rows and ignores `game_contract_agreements`; identical on baseline, so pre-existing application SQL, not proposal-caused |
| Free agency: release, offer submission, simulated-day acceptance, roster slot restoration | **PASS** |
| Full regular season (870 completed results), 30 qualifications, champion within bounded days | **PASS** |
| Offseason entry, contract preparation, player options (runtime signing classified expiring; estimated terms invent nothing) | **PASS** |
| Corrected policies do not break authenticated workflows | **PASS** (baseline vs corrected stdout identical apart from the two security PASS lines) |
| Anonymous catalog reads and foreign-owner reads after 057 | **PASS** (zero rows) |
| Anonymous execution of the three revoked helpers after 057 | **PASS** on vanilla (`42501`, state unchanged); **UNVERIFIED** on the Supabase image (Task A blocker) |

## Changed files

- `scripts/test-free-agency-days-postgres.ts` (fixture ordering + 056 application)
- `scripts/test-player-attributes-postgres.ts` (container ID validation)
- `tests/infrastructure/supabase/playerAttributeSimulation.postgres.sql` (league fixture + one assert scope)
- New: `scripts/test-supabase-step31.py`, `tests/infrastructure/supabase/step31-gameplay.sql`
- Unchanged: baseline, historical migrations, both proposals, application source, all Step 3 artifacts

## Recommendation

**GO for further local validation** (Auth/PostgREST end-to-end coverage once API
services exist locally; trade path decision for canonical-agreement-only players).
**NO-GO for staging promotion**: the Supabase-image denied-RPC crash is unexplained —
a permission fix must prove denial on the actual deployment image, not only on vanilla
PostgreSQL — and the trade gap needs an explicit product decision before corrected
schemas carry realistic rosters. Production remains NO-GO; nothing was deployed,
registered, pushed, or committed.
