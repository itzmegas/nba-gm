# Tasks: Jordan Era Snapshots

## Delivery Model

- **Strategy**: Feature Branch Chain
- **Order**: draft tracker PR → Slice 1 branch → Slice 2 branch
- **Review budget**: 400 changed lines total per review slice
- **Decision-needed flag**: **Yes** — manual approval is required for migration application and live-data loader execution

## Slice 1 — Foundation / Shared loader + fail-closed guard

### Boundary

| Field | Boundary |
|---|---|
| **Start** | Existing validated 2010 loader path (`scripts/seed_historical_rosters.py`) and current `seed_game_data` guard |
| **Finish** | Shared loader core extracted, 2010 path refactored to use it, migration 008 added, JORDAN metadata flipped, schema comment updated |
| **Verification** | `bun biome check`; rerun 2010 loader in its current flow; confirm a 1995 game fails closed when templates are absent; confirm 2010 behavior remains unchanged |
| **Rollback** | Remove `scripts/historical_loader_core.py`, revert `scripts/seed_historical_rosters.py`, delete `scripts/migrations/008_jordan_era_snapshots.sql`, restore `src/domain/entities/SeasonEra.ts` and `scripts/schema.sql` |
| **Work-unit commit guidance** | Commit as one foundation unit, e.g. `feat(jordan-era-snapshots): share historical loader core and generalize guard` |

### Tasks

- [x] 1.1 Extract shared NBA loader primitives into `scripts/historical_loader_core.py` and keep only era-specific constants in the loader entry point.
- [x] 1.2 Refactor `scripts/seed_historical_rosters.py` to import the shared core without changing its 2010 behavior.
- [x] 1.3 Add `scripts/migrations/008_jordan_era_snapshots.sql` to generalize `seed_game_data` so declared historical seasons fail closed when templates are missing.
- [x] 1.4 Update `src/domain/entities/SeasonEra.ts` so JORDAN is marked as historically data-backed and its description mentions 1995-96 rosters with approximate contracts.
- [x] 1.5 Update the historical template comment in `scripts/schema.sql` to reflect multi-era support.
- [x] 1.6 Add or update focused verification coverage for the 2010 regression path, the 1995 fail-closed branch, and the domain metadata flip.

## Slice 2 — 1995 ingestion / Jordan-era loader

### Boundary

| Field | Boundary |
|---|---|
| **Start** | Slice 1 landed, shared core available, and migration 008 reviewed for deployment readiness |
| **Finish** | New 1995 loader entry point exists, 1995 salary tiers/config are wired, spec delta reflects 1995 scenarios, and live-data runbook is ready |
| **Verification** | `bun biome check`; dry-run or sandbox execution of `scripts/seed_jordan_rosters.py`; validate idempotency; confirm roster identity safety and approximate contract generation |
| **Rollback** | Remove `scripts/seed_jordan_rosters.py` and the 1995 spec delta only; keep Slice 1 foundation intact |
| **Work-unit commit guidance** | Commit as one loader unit, e.g. `feat(jordan-era-snapshots): add 1995 jordan roster loader and spec coverage` |

### Tasks

- [ ] 2.1 Create `scripts/seed_jordan_rosters.py` as a thin 1995-96 entry point that imports the shared core and declares 1995-specific season and salary-tier config.
- [ ] 2.2 Encode 1995-era salary tiers and superstar/star player ID sets in the new loader without reusing 2010 salary values.
- [ ] 2.3 Extend `openspec/changes/jordan-era-snapshots/specs/historical-era-snapshots/spec.md` with the 1995-96 scenario, fail-closed scenario, and approximate-contract truthfulness language.
- [ ] 2.4 Add verification coverage for loader idempotency, safe identity reuse, and roster-template generation for the 1995 path.
- [ ] 2.5 Prepare the live-data execution notes for running `scripts/seed_jordan_rosters.py` against the target Supabase project after explicit approval.

## Manual Approval / Live-Data Gates

- [ ] A1 Obtain explicit approval before applying `scripts/migrations/008_jordan_era_snapshots.sql` to any shared or production Supabase environment.
- [ ] A2 Obtain explicit approval before running `scripts/seed_jordan_rosters.py` against live NBA API data and the target Supabase project.
- [ ] A3 Record the exact sandbox/production target, command, and result after the live run; do not treat this as automatic implementation.

## Review Workload Forecast

| Slice | Expected changed files | Estimated lines | 400-line risk | Recommendation |
|---|---:|---:|---|---|
| Slice 1 | 5 | ~180-230 | Low | Chain as PR 1 |
| Slice 2 | 2-3 | ~180-240 | Low to medium | Chain as PR 2 |

- **Total forecast**: ~360-470 authored lines across the whole change
- **400-line budget risk**: **Medium** if Slice 2 grows during loader work; keep the shared core minimal
- **Chained recommendation**: **Yes** — use Feature Branch Chain with a draft tracker PR, then Slice 1 → Slice 2
- **Decision-needed flag**: **Yes** — live-data/migration execution requires manual approval before implementation is considered complete

## Implementation Order

1. Deliver Slice 1 first so the guard and shared loader foundation are stable.
2. Verify 2010 regression behavior before introducing the 1995 entry point.
3. Deliver Slice 2 only after Slice 1 is reviewable and the migration path is approved.
4. Run the manual live-data steps last, after both slices are merged and approved.

## Next Step

Ready for implementation planning or `sdd-apply`.
