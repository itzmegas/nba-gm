# Tasks: historical-era-snapshots

## Phase 1: Infrastructure

- [x] 1.1 Add historical roster and contract template tables, unique keys, RLS policies, migration `005_historical_era_snapshots.sql`, and `scripts/schema.sql` documentation. (Infrastructure)
- [x] 1.2 Update `seed_game_data` to validate ownership, read `games.season_year`, copy templates into game-scoped rows, and retain an explicit fallback. (Infrastructure)
- [x] 1.3 Make active contract retrieval season-aware for historical game contexts. (Infrastructure)

## Phase 2: Historical Data Ingestion

- [x] 2.1 Add the 2010-11 NBA API loader with `.env.local` service-role configuration and `teams.nba_id` roster lookup. (Infrastructure scripts)
- [x] 2.2 Generate and upsert deterministic approximate contract templates compatible with existing contract fields. (Infrastructure scripts)

## Phase 3: Era Metadata

- [x] 3.1 Mark 2010/LeBron as historical-data-backed and describe real rosters with approximate generated contracts. (Domain / Presentation)
- [x] 3.2 Keep 1995/Jordan visual-only. (Domain / Presentation)

## Phase 4: Validation

- [x] 4.1 Run static and automated validation: Python compilation, Biome, TypeScript, Vitest, and whitespace checks. (Validation)
- [x] 4.2 Apply migration 005 and run the loader against Supabase. (Manual validation)
- [x] 4.3 Manually create games across eras and create a second 2010 game; confirm historical rosters load and both 2010 games remain correct. (Manual validation)
