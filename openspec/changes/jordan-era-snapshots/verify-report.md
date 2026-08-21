# Verification Report

```yaml
schema: gentle-ai.verify-result/v1
change: jordan-era-snapshots
mode: standard
artifact_store: both
verdict: fail
blockers: 5
critical_findings: 5
requirements: 0/9
scenarios: 0/15
tasks: 14/14
test_command: bunx vitest --run
test_exit_code: 0
test_output_hash: sha256:dcca8a3bf04e71c56bf5e46f08411fd8e3d5204e77fcdd4a8bdd482f2b9970dc
build_command: bunx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
review_gate: allow
bound_lineage: review-223962b1d59d2776
implementation_review_lineage: review-85b4d33b16be2eee
```

**Change**: `jordan-era-snapshots`  
**Version**: N/A  
**Mode**: Standard, independent final verification  
**Native status**: `verify: ready`  
**Review authority**: gate `allow`, bound lineage `review-223962b1d59d2776`; implementation review `review-85b4d33b16be2eee` was reported approved with no CRITICAL findings.

## Completeness

| Metric | Value |
|---|---:|
| Requirements | 9 |
| Scenarios | 15 |
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

The task ledger has 11 implementation tasks and 3 manual gates, all checked. Completion marks do not establish scenario compliance: tasks 1.6 and 2.4 claim verification coverage, but no runtime tests for the Python loader/core or SQL seed paths exist.

## Build and Test Execution

| Evidence class | Command | Exit | Result | Output hash |
|---|---|---:|---|---|
| Automated | `bun biome check .` | 0 | 127 files checked; no fixes applied | `sha256:2b5358f7235e169c3a5c4d97e9be91006eddd9419a38aada0245f23a95a17d51` |
| Automated | `bunx tsc --noEmit` | 0 | Passed; empty output | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Automated | `bunx vitest --run` | 0 | 10 files, 78 tests passed | `sha256:dcca8a3bf04e71c56bf5e46f08411fd8e3d5204e77fcdd4a8bdd482f2b9970dc` |
| Static executable check | `python3 -m py_compile scripts/historical_loader_core.py scripts/seed_historical_rosters.py scripts/seed_jordan_rosters.py` | 0 | Passed; empty output | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

**Coverage**: Not available. `py_compile` proves syntax/import compilation only; it does not execute loader behavior.

## Evidence Classification

### Automated runtime evidence

- The full Vitest suite passed: 78/78 tests.
- `tests/domain/entities/Season.test.ts` executes the Jordan historical-data flag and checks that its description contains `1995-96` and approximate-contract wording.
- No runtime test imports or exercises `historical_loader_core.py`, `seed_jordan_rosters.py`, migration 008, template generation, identity reuse, SQL guard branches, repeated-game isolation, or new-game-only behavior.

### Static evidence

- The 1995 entry point delegates to the shared core and configures season 1995 with separate salary tiers.
- Contract values are SHA-256-derived and deterministic for stable inputs.
- Player inserts use `on_conflict=nba_id` with `resolution=ignore-duplicates`; template writes merge on `(season_year, player_id)`.
- Migration 008 selects templates by `season_year`, scopes copied rows to `p_game_id`, keeps the modern fallback branch, and guards 2010/1995 when no roster row exists.
- `SeasonEra` marks Jordan and LeBron as historical-data-backed; modern remains canonical.
- Migration 008 contains no existing-game backfill or reseed statement.

### User-supplied manual production evidence

- Migration 008 was applied successfully to production Supabase.
- `python scripts/seed_jordan_rosters.py` was executed against production.
- A newly created 1995 game loaded period-correct historical rosters.

This evidence does **not** establish exact template counts, Seattle franchise identity, non-zero or tier-level salaries, contract isolation, global-profile immutability, existing-game immutability, loader rerun idempotency, missing-template behavior, or rollback execution.

## Spec Compliance Matrix

| Requirement | Scenario | Runtime/manual coverage | Result |
|---|---|---|---|
| HIST-001 | Load the 1995-96 opening-season templates | Production run and roster observation are partial; no covering test and no Seattle observation | ❌ UNTESTED |
| HIST-001 | Reject an incomplete API roster response | No covering test | ❌ UNTESTED |
| HIST-002 | Generate a 1995 contract template | No covering test or reported salary observation | ❌ UNTESTED |
| HIST-002 | Keep approximate values truthful | Metadata test passes, but no roster/contract presentation test | ⚠️ PARTIAL |
| HIST-003 | Create a new 1995 game | Roster observed manually; contracts and row scoping were not observed | ⚠️ PARTIAL |
| HIST-003 | Create two games from the same 1995 snapshot | No covering test or manual evidence | ❌ UNTESTED |
| HIST-004 | Missing 1995 templates abort historical seeding | No covering test or manual evidence | ❌ UNTESTED |
| HIST-004 | Missing modern templates preserve playability | No covering test or manual evidence | ❌ UNTESTED |
| HIST-005 | Preserve isolation for 1995 games | No covering test or manual evidence | ❌ UNTESTED |
| HIST-006 | Describe Jordan-era fidelity | Metadata test passes partially; UI does not state opening-season fidelity | ⚠️ PARTIAL |
| HIST-008 | Reuse an existing player identity | No covering test or manual profile comparison | ❌ UNTESTED |
| HIST-008 | Insert a missing player identity safely | No covering test or rerun evidence | ❌ UNTESTED |
| HIST-009 | Existing games remain unchanged | No covering test or manual before/after comparison | ❌ UNTESTED |
| HIST-010 | Regression-check supported eras | No automated test exercises modern, 2010, and 1995 seed paths | ❌ UNTESTED |
| HIST-010 | Validate Supabase behavior manually | Production roster path passed; Seattle, salaries, and immutability checks were not reported | ⚠️ PARTIAL |

**Compliance summary**: 0/15 scenarios fully compliant under the SDD rule that each scenario requires a passing covering runtime test; 4 are partially evidenced and 11 are untested.

## Correctness Against Requirements

| Requirement | Status | Evidence and gap |
|---|---|---|
| HIST-001 Historical roster template source | ⚠️ Partial | Loader creates season/player/team/position/jersey rows and production showed historical rosters. `validate_roster_row` checks keys but accepts an empty `PLAYER` value; Seattle identity was not observed. |
| HIST-002 Approximate contract templates | ⚠️ Partial | Static generation is deterministic and uses separate 1995 ranges; no runtime contract test or reported salary-level observation exists. |
| HIST-003 Season-aware seeding | ⚠️ Partial | SQL filters by season and scopes inserts to the new game; production proved roster selection only, not contracts or two-game independence. |
| HIST-004 Fail-closed guard | ❌ Not compliant | The guard checks only whether any roster-template row exists. It does not reject incomplete roster sets, missing contract templates, or otherwise invalid templates as required. |
| HIST-005 Repeated-game isolation | ⚠️ Partial | Schema and SQL are game-scoped statically; no covering test or manual mutation/isolation proof exists. |
| HIST-006 Era metadata | ⚠️ Partial | Historical flag and approximate wording are correct and tested. The rendered description says real `1995-96` rosters but not that they are opening-season rosters. |
| HIST-008 Safe player identity ingestion | ⚠️ Partial | Ignore-duplicate insert plus UUID fetch is identity-safe by inspection; no runtime test or manual global-profile comparison exists. |
| HIST-009 New-game-only behavior | ⚠️ Partial | Migration and loader do not target existing games by inspection; existing-game immutability was not tested or observed. |
| HIST-010 Regression safety and evidence | ❌ Not compliant | Required automated seed/contract/identity/guard coverage and required manual Seattle/salary/immutability observations are absent. |

## Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| Shared core with parallel era entry points | ✅ Yes | Both 2010 and 1995 entry points delegate to `historical_loader_core.py`. |
| Explicit SQL guard list | ✅ Yes | Migration uses `IN (2010, 1995)`, though this mechanism is insufficient for the stronger completeness requirement. |
| 1995-specific salary tiers | ✅ Yes | Separate era-calibrated ranges are configured and not reused from 2010. |
| Opening-season, first-team-wins simplification | ✅ Yes | Template uniqueness remains `(season_year, player_id)`. |
| Identity-safe insert via ignore duplicates | ✅ Yes | Existing player rows are not merged or updated. |
| New-game-only rollout | ✅ Yes by inspection | No backfill/reseed DML is present in migration 008 or the loader. |
| Testing strategy | ❌ Deviated | Planned Python unit, sandbox loader, SQL branch/isolation/rollback, and UI checks are not present as executable evidence. |
| Rollback definition in migration 008 | ⚠️ Deviated | Migration 008 does not redefine rollback; it relies on the existing era-agnostic function. No rollback execution was reported. |

Layer boundaries remain coherent: domain metadata has no infrastructure dependency; loader and SQL stay in infrastructure scripts; presentation consumes domain metadata.

## Issues Found

### CRITICAL

1. **Required runtime coverage is absent.** Tasks 1.6 and 2.4 are checked, but the executed suite has no loader/core/SQL scenario tests. This directly violates HIST-010 and prevents all 15 scenarios from reaching full compliance.
2. **The fail-closed guard accepts incomplete historical datasets.** `v_has_historical_templates` is true when only one roster row exists and does not require matching contract templates. HIST-004 requires missing, invalid, or incomplete datasets to abort.
3. **Roster validation accepts an empty player identity.** `validate_roster_row` calls `as_string(row["PLAYER"])`, but `as_string` returns an empty string instead of rejecting it. An ambiguous identity can proceed despite HIST-001.
4. **Jordan UI metadata omits opening-season fidelity.** The rendered copy states real 1995-96 rosters but not opening-season rosters, contrary to HIST-006's explicit UI requirement.
5. **Required production validation is incomplete.** The reported live run proves migration/loader/new-roster success, but not Seattle identity, non-zero approximate contracts, or existing-game/global-profile immutability required by HIST-010.

### WARNING

1. No exact template count was reported, so roster completeness cannot be established from the successful production run.
2. No contract-isolation, two-game isolation, loader-rerun, missing-template, or rollback execution evidence was supplied.
3. The approved implementation review lineages are valid process evidence but do not supersede contradictory final requirement/runtime findings.

### SUGGESTION

None. The blocking requirement and evidence gaps should be resolved before optional improvements are considered.

## Verdict

**FAIL**

All required commands pass and the user-supplied production evidence proves the main 1995 roster happy path. Final SDD verification nevertheless fails because mandatory scenarios lack passing runtime coverage, the fail-closed implementation does not detect incomplete datasets, validation permits an empty player identity, UI copy misses opening-season fidelity, and required manual Supabase observations remain unproven.
