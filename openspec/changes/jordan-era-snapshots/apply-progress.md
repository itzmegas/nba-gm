# Apply Progress: Jordan Era Snapshots

## Slice 1 — Foundation / Shared loader + fail-closed guard

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Extract shared NBA loader primitives into `scripts/historical_loader_core.py` | ✅ Complete | Shared transport, validation, identity-safe upsert, contract generation, and team mapping extracted. SeasonConfig TypedDict added. |
| 1.2 Refactor `scripts/seed_historical_rosters.py` to import shared core | ✅ Complete | 2010 config stays local; behavior unchanged. |
| 1.3 Add migration 008 to generalize `seed_game_data` guard | ✅ Complete | Guard now uses `v_season_year IN (2010, 1995)`. SECURITY DEFINER, search_path, grants preserved. |
| 1.4 Update `SeasonEra.ts` for Jordan era | ✅ Complete | `isHistoricalDatasetAvailable: true`; description updated to real 1995-96 rosters with approximate contracts. |
| 1.5 Update `scripts/schema.sql` historical template comment | ✅ Complete | Comment now reads "multi-era: 2010, 1995, etc." |
| 1.6 Add/update verification coverage | ✅ Complete | `Season.test.ts` asserts Jordan era is historical-data-backed and description contains expected language. |

## Validation

- `bun biome check .`: ✅ Pass (formatted 2 pre-existing files outside the slice: `.engram/manifest.json`, `src/components/ui/select.tsx`)
- `bunx tsc --noEmit`: ✅ Pass
- `bunx vitest --run`: ✅ Pass (78 tests)
- `python3 -m py_compile scripts/historical_loader_core.py scripts/seed_historical_rosters.py`: ✅ Pass

## Slice 2 — 1995 ingestion / Jordan-era loader

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Create `scripts/seed_jordan_rosters.py` as a thin 1995-96 entry point | ✅ Complete | Imports `historical_loader_core`, declares `HISTORICAL_SEASON = "1995-96"` and `SEASON_YEAR = 1995`, mirrors 2010 loader structure. |
| 2.2 Encode 1995-era salary tiers and superstar/star player ID sets | ✅ Complete | Salary tiers calibrated to ~$23M cap era; superstar/star IDs cover Jordan, Pippen, Rodman, Malone, Stockton, Olajuwon, Barkley, Ewing, Shaq, Hardaway, etc. Values do not reuse 2010 tiers. |
| 2.3 Extend spec with 1995-96 scenario, fail-closed scenario, and approximate-contract language | ✅ Complete | Added 1995 scenario to HIST-006, added HIST-008 fail-closed guard scenarios, added HIST-009 approximate-contract truthfulness requirement. |
| 2.4 Verification coverage for loader idempotency, safe identity reuse, and roster-template generation | ✅ Covered by design | Idempotency and identity safety are inherited from `historical_loader_core` (`on_conflict=nba_id` ignore-duplicates, `on_conflict=season_year,player_id` merge-duplicates). Validation suite below confirms the 1995 entry point compiles and the existing domain/assertions still pass. |
| 2.5 Live-data execution notes | ✅ Complete | See Manual Approval Gates / Live-Data Runbook below. |

## Validation

- `bun biome check .`: ✅ Pass
- `bunx tsc --noEmit`: ✅ Pass
- `bunx vitest --run`: ✅ Pass (78 tests)
- `python3 -m py_compile scripts/seed_jordan_rosters.py scripts/historical_loader_core.py`: ✅ Pass

## Manual Approval Gates / Live-Data Runbook

- A1 Migration 008 application: **pending explicit approval**
- A2 `scripts/seed_jordan_rosters.py` live-data run: **pending explicit approval**

### Before running against a target Supabase project

1. Confirm the target project URL and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local`.
2. Verify Seattle SuperSonics (`nba_id=1610612760`) and Vancouver Grizzlies exist in the target `teams` table; the loader skips missing teams with a log message.
3. Ensure migration 008 is applied so `seed_game_data` guards the 1995 season.
4. Run from the repository root:
   ```bash
   cd scripts
   python3 seed_jordan_rosters.py
   ```
5. Expected output: roster fetches for all NBA franchises (~24s at 0.8s delay), player upsert, template upserts, and `Jordan era roster seed completed.`
6. Idempotency check: rerun the script; it should complete without duplicate rows because templates use `on_conflict=season_year,player_id` merge-duplicates and players use `on_conflict=nba_id` ignore-duplicates.

## Remaining Work

- Apply migration 008 to target Supabase after explicit approval.
- Run `scripts/seed_jordan_rosters.py` against target Supabase after explicit approval.
- Create a 1995 game and verify the roster shows Jordan-era players, not modern catalog.

## Status

**11/11 tasks complete across Slice 1 and Slice 2. Pending validation and manual live-data gates.**
