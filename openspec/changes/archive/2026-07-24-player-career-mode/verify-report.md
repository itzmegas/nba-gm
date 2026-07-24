```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5249e0114c7c330932ea17049541d4c93470d6f82a8c6eb96166d07a9b9d1823
verdict: fail
blockers: 1
critical_findings: 1
requirements: 17/17
scenarios: 36/36
test_command: bun vitest run
test_exit_code: 0
test_output_hash: sha256:0c64bd247caf5b72e3f05108cb3cc75a01bcce0c1606fd2c08b4931516930a40
build_command: bun tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: `player-career-mode`  
**Version**: N/A  
**Mode**: Standard, user-authorized runtime-seam evidence policy  
**Artifact store**: OpenSpec + Engram

### Executive Summary

**FAIL.** Runtime and source correctness pass: all 17 requirements and 36 scenarios are accepted under the authorized runtime-seam policy, the cache-isolation and stale-roll blockers are fixed, all 87 tests pass, TypeScript passes, and targeted Biome passes. Archive is nevertheless blocked because the current authored worktree is **827 changed lines**, not <=800.

The direct count is 46 additions/deletions in tracked feature paths plus 781 lines in new feature files. Excluding the 92-line runtime suite gives 735; including it gives 827. The runtime suite is part of the MVP verification change and cannot be omitted from an honest authored-change count. Even the historical ledger arithmetic, 705 + 90 runtime remediation + 29 bounded correction = 824, exceeds 800. `tasks.md` reports 734 by excluding runtime coverage and therefore is not coherent with the current worktree or the hard-stop definition.

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 17/17 accepted |
| Scenarios evaluated | 36/36 |
| Direct runtime/runtime-seam scenarios | 23/36 |
| Source-backed residual scenarios | 13/36 |
| Tasks checked complete | 17/17 |
| Tasks unchecked | 0 |
| Current authored count | **827** |
| Hard-stop margin | **-27 lines** |

### Build and Test Evidence

| Check | Exit | Result | Output hash |
|---|---:|---|---|
| `bun vitest run` | 0 | 12 files, 87 tests passed | `sha256:0c64bd247caf5b72e3f05108cb3cc75a01bcce0c1606fd2c08b4931516930a40` |
| `bun tsc --noEmit` | 0 | Passed with empty output | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Targeted `bun biome check` over current career paths | 0 | 13 supported files checked | `sha256:f7cd33b9fca7dc0d8cb2b70b2ec0102e57740d73f3b0bce1a148cc9a34e92695` |
| `bun biome check` | 1 | Only `.engram/manifest.json` final-newline issue | `sha256:cfefa98badac94e4bd55afc0c364519d07a5706c0eb7f5f2587912cfde218eb2` |
| `git diff --check` | 0 | No tracked whitespace errors | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Coverage percentage is not configured. The focused runtime suite exists at `tests/application/hooks/career-runtime.test.ts` and passes as part of the full suite.

### Correction Verification

| Correction | Evidence | Result |
|---|---|---|
| Authenticated cache isolation | `careerListKey(userId)` and `careerKey(userId, careerId)` scope list/detail queries and every invalidation; create invalidates by `save.userId` | ✅ Fixed |
| Stale college-roll race | Roll reads the save and includes `stage = save.stage` plus `pending_event IS NULL` in the conditional update | ✅ Fixed |
| Runtime regression seam | Runtime test asserts owner filtering, fixed create state, career-only calls, roll stage guard, resolve event guard/count, draft guard, and zero-row stale invalidation | ✅ Passing |
| Review lineage | Engram validation `review-e8e8eede9ed3b461` confirms both bounded corrections without later feature-scope additions | ✅ Reviewed |

### Spec Compliance Matrix

| # | Requirement / scenario | Evidence | Result |
|---:|---|---|---|
| 1 | Landing entry — enter career mode | Additive `/career` link; GM rendering remains | ✅ COMPLIANT (source-backed) |
| 2 | Create — create a valid career | Runtime repository create with owner identity | ✅ COMPLIANT |
| 3 | Create — persist fixed initial state | Runtime payload asserts owner and overall 60; schema defaults inspected | ✅ COMPLIANT |
| 4 | Create — reject invalid input | Zod parse precedes repository create | ✅ COMPLIANT (source-backed) |
| 5 | Owner isolation — read owned careers | Runtime asserts `user_id` list filter | ✅ COMPLIANT |
| 6 | Owner isolation — cross-owner mutation unavailable | Owner `FOR ALL` RLS policy inspected | ✅ COMPLIANT (residual warning) |
| 7 | College event — resolve directly to draft | Domain progression and runtime resolve evidence | ✅ COMPLIANT |
| 8 | College event — no declaration path | No Declare action in dashboard | ✅ COMPLIANT (source-backed) |
| 9 | Draft offers — stable offers | Deterministic-offer test passes | ✅ COMPLIANT |
| 10 | Draft offers — pick offered team | Runtime draft guard and source payload | ✅ COMPLIANT |
| 11 | Draft offers — reject non-offered team | Membership check precedes update | ✅ COMPLIANT (source-backed) |
| 12 | Draft offers — reject duplicate-ID catalog | Duplicate-heavy catalog test passes | ✅ COMPLIANT |
| 13 | Draft offers — reject duplicate input | Zod duplicate-offer test passes | ✅ COMPLIANT |
| 14 | NBA loop — roll event | Runtime roll executes null-pending and fetched-stage guards | ✅ COMPLIANT |
| 15 | NBA loop — resolve event | Runtime resolve plus clamp/stage tests | ✅ COMPLIANT |
| 16 | Pending snapshot — resolve stored snapshot | `applyChoice` consumes stored pending snapshot | ✅ COMPLIANT |
| 17 | Pending snapshot — do not roll twice | Runtime asserts null-pending guard | ✅ COMPLIANT |
| 18 | Atomic resolve — duplicate harmless | Runtime asserts event-ID guard | ✅ COMPLIANT |
| 19 | Atomic resolve — stale event loses race | Shared zero-row runtime path invalidates and throws stale | ✅ COMPLIANT |
| 20 | Atomic resolve — absolute count | Runtime asserts absolute `events_resolved: 1` payload | ✅ COMPLIANT |
| 21 | Repository boundary — no generic write | Interface exposes only read/list/create | ✅ COMPLIANT (source-backed) |
| 22 | Cooperative guards — stale client rejected | Zero-row runtime path reports stale | ✅ COMPLIANT |
| 23 | Cooperative guards — RLS owner boundary | Owner policy inspected; no real DB harness | ✅ COMPLIANT (residual warning) |
| 24 | Cooperative guards — direct owner bypass accepted | Limitation explicit; no RPC/trigger | ✅ COMPLIANT (source-backed) |
| 25 | Stale refresh — stale action refreshes | Runtime invalidation and dashboard stale/refetch source | ✅ COMPLIANT |
| 26 | Retirement — retire NBA career | Runtime retire boundary and source transition | ✅ COMPLIANT |
| 27 | Retirement — reject premature retirement | Stage/pending guards and shared zero-row behavior | ✅ COMPLIANT |
| 28 | Legacy — display summary | Retired branch renders five required values | ✅ COMPLIANT (source-backed) |
| 29 | DB/parsing — reject malformed event | Malformed-row test passes | ✅ COMPLIANT |
| 30 | DB/parsing — parse valid row | Valid-row test passes | ✅ COMPLIANT |
| 31 | DB/parsing — reject invalid DB state | Four SQL CHECK constraints inspected | ✅ COMPLIANT (residual warning) |
| 32 | View states — initial load | List/dashboard loading branches inspected | ✅ COMPLIANT (source-backed) |
| 33 | View states — read failure | List/dashboard error branches inspected | ✅ COMPLIANT (source-backed) |
| 34 | Focused validation — pure domain behavior | Seven focused domain tests pass | ✅ COMPLIANT |
| 35 | GM isolation — complete flow | Runtime ledger touches only `career_saves`; no career GM writes | ✅ COMPLIANT |
| 36 | Explicit non-goals — no deferred scope | Route/source inspection finds no deferred capability | ✅ COMPLIANT (source-backed) |

**Scenario coverage**: **36/36 accepted** under the authorized policy: **23 direct runtime/runtime-seam**, **13 source-backed residual**, **0 failing**, **0 blocker-level untested**.  
**Requirement coverage**: **17/17 accepted**.

### Correctness and Design Coherence

| Area | Status | Evidence |
|---|---|---|
| One aggregate, four checks, owner RLS | Implemented | `scripts/schema.sql:148-197` |
| Read/list/create-only repository | Implemented | `CareerSaveRepository.ts:3-7` |
| Narrow roll/resolve/draft/retire writes | Implemented | `useCareer.ts:136-234` |
| Absolute resolve count | Implemented + runtime covered | `useCareer.ts:176-185`; runtime payload assertion |
| Auth-scoped query cache/invalidation | Implemented | `useCareer.ts:21-22,53-60,94-133` |
| Fetched-stage roll guard | Implemented + runtime covered | `useCareer.ts:140-159`; runtime stage assertion |
| Zero-row stale behavior | Implemented + runtime covered | `useCareer.ts:62-90` |
| GM/RPC isolation | Implemented | Career writes target only `career_saves`; no `.rpc()` |
| Deferred scope | Absent | Only `/career` and `/career/[careerId]` routes |
| Task/accounting coherence | **Failed** | `tasks.md` reports 734 while direct current count is 827 |

### Findings

#### CRITICAL

1. **AUTHORED HARD STOP EXCEEDED.** Direct current count is **827 additions/deletions**, 27 over the approved 800-line maximum. The 92-line runtime suite is authored feature-verification code and must be counted. `tasks.md` excludes it and is therefore materially incoherent. This is an archive blocker despite green behavior.

#### WARNING

1. No real Supabase/PostgreSQL/RLS integration suite is configured; RLS and DB checks are source-verified under the authorized policy.
2. No browser harness is configured; navigation and rendering states are source-verified under the authorized policy.
3. Full Biome fails only because `.engram/manifest.json` lacks a final newline; targeted career checks pass.
4. Lifecycle/draft guards remain approved cooperative-owner controls, not a security boundary.
5. The unrelated untracked `openspec/changes/traspasos/` worktree path remains outside this verification scope.

#### SUGGESTION

1. Reconcile the authored ledger and reduce at least 27 changed lines before rerunning the independent final verification. Do not archive based on the green runtime suite alone.

### Archive Decision

**FAIL — archive MUST NOT proceed.** Runtime/spec verification is green, but the explicit 800-line hard stop is exceeded and task accounting is not coherent.

### Result Contract

- **status**: blocked
- **executive_summary**: All 17 requirements and 36 scenarios are accepted under the authorized runtime-seam policy, and the two bounded runtime blockers are fixed. Final verification fails because the direct authored count is 827, exceeding the 800 hard stop by 27 lines; `tasks.md` incorrectly reports 734 by excluding the runtime suite.
- **artifacts**: `openspec/changes/player-career-mode/verify-report.md`; Engram topic `sdd/player-career-mode/verify-report`
- **next_recommended**: Return to bounded apply/accounting correction; reduce the current authored change to <=800 and rerun `sdd-verify`. Archive is not authorized.
- **risks**: Real DB/RLS and browser harnesses remain unavailable; full Biome has the pre-existing manifest newline issue; cooperative-owner limitations remain accepted. The sole blocker is the authored hard-stop/accounting contradiction.
- **skill_resolution**: `paths-injected` — `sdd-verify` plus shared SDD phase/report contracts; user instruction prohibited delegation, review, code edits, and commits.
