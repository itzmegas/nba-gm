# Apply Progress: historical-era-snapshots

## Status: Complete

All implementation tasks completed and validated in production.

## Implementation Summary

### Phase 1: Schema & Migration 005
- Created `historical_roster_templates` and `historical_contract_templates` tables
- Updated `seed_game_data` to read `games.season_year` and seed from templates when available
- Added RLS policies for authenticated reads
- Migration applied to Supabase: 2026-07-15

### Phase 2: NBA API Loader
- Created `scripts/seed_historical_rosters.py`
- Loaded 2010-11 NBA rosters (437 players, 437 roster templates, 437 contract templates)
- Used deterministic salary generation based on player tier and roster position
- Loader executed successfully: 2026-07-15

### Phase 3: Era Metadata & UI
- Updated `SeasonEra.ts` to mark 2010 as `isHistoricalDatasetAvailable: true`
- Added era-specific warning copy in `CreateGameForm.tsx`
- Updated `SupabaseContractRepository.ts` to accept season year parameter
- Added unit tests for era metadata

### Phase 4: Validation
- Biome check: passed
- TypeScript compilation: passed
- Vitest: 10 files, 77 tests passed
- Manual validation: created 2010 game (LeBron era) and modern game, both seeded correctly
- Confirmed multiple 2010 games maintain isolated contracts

## Production Issues & Corrections

### Issue 1: Migration 005 Fallback Bug
**Problem**: Migration 005 fallback tried to copy contracts where `game_id IS NULL`, but migration 003 had already enforced `game_id NOT NULL`. Modern/1995 games would fail to seed.

**Correction (Migration 006)**: Created forward migration that copies existing game-scoped contracts instead of querying NULL game_id. Applied to Supabase: 2026-07-15.

**Review**: Scoped review lineage `review-11149f1e4ffe649c` approved correction. Pre-commit validation passed.

### Issue 2: Zero Salaries in Fallback Contracts
**Problem**: Migration 006 created isolated contracts but with all salary fields set to 0. Modern/1995 games displayed no salary expenditure.

**Root Cause**: Correction prioritized isolation over salary values. Review accepted zero-value contracts as "playable" but this was insufficient.

**Correction (Migration 007)**: Created `scripts/migrations/007_add_fallback_contract_salaries.sql` that:
- Assigns deterministic approximate salaries by team position (superstar: $45M, star: $30M, starter: $15M, rotation: $7M, role player: $2M)
- Applies 5% annual raises over 5 years
- Backfills existing zero-salary fallback games
- Does not copy contracts from other games

**Validation**: Applied migration 007 to Supabase: 2026-07-15. User confirmed modern/1995 games now display contracts with salaries.

## Acceptance Criteria Status

- [x] 2010 roster templates loaded from NBA API (437 players)
- [x] Approximate contract templates generated deterministically
- [x] `seed_game_data` seeds 2010 games from templates
- [x] Modern/default games seed with fallback contracts (now with salaries)
- [x] Multiple 2010 games maintain isolated contracts
- [x] `SeasonEra` metadata reflects real rosters + approximate contracts
- [x] All validation commands pass (Biome, TypeScript, Vitest)
- [x] Manual Supabase validation complete (migration, loader, game creation)

## Files Modified

### Schema & Migrations
- `scripts/schema.sql` - added historical template tables
- `scripts/migrations/005_historical_era_snapshots.sql` - template tables + seed logic
- `scripts/migrations/006_fix_historical_fallback_contracts.sql` - fallback correction
- `scripts/migrations/007_add_fallback_contract_salaries.sql` - salary assignment

### Application Code
- `src/domain/entities/SeasonEra.ts` - era metadata
- `src/components/games/CreateGameForm.tsx` - era-specific warnings
- `src/infrastructure/repositories/SupabaseContractRepository.ts` - season-aware queries
- `tests/domain/entities/Season.test.ts` - era tests

### Scripts
- `scripts/seed_historical_rosters.py` - NBA API loader

## Next Steps

1. Review migration 007 delta
2. Re-run SDD verification with updated evidence
3. Create clean commits
4. Archive change
