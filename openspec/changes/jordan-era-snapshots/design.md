# Design: Jordan Era Snapshots

## Technical Approach

Extract shared NBA loader primitives from the validated 2010 path into a reusable core module, then add a configurable parallel entry point for 1995-96 that passes era-specific salary tiers and superstar ID sets. Generalize the `seed_game_data` guard from hard-coded `v_season_year = 2010` to a season list, flip `SeasonEra` metadata for Jordan, and keep both eras idempotent, identity-safe, and template-driven.

This implements the proposal's "shared primitives backed by configurable validation, contract, identity-safe persistence, and idempotency" strategy, delivered in two chained implementation slices under a 400-line-per-PR review budget.

### Quick path

1. **Slice 1**: Extract `historical_loader_core.py`, add migration 008 (generalized guard), flip `SeasonEra.ts`, update `schema.sql` comment.
2. **Slice 2**: Add `seed_jordan_rosters.py` with 1995 config, extend `historical-era-snapshots` spec with 1995 scenario.
3. Run `seed_jordan_rosters.py` against production Supabase.
4. Create a new 1995 game and verify Jordan-era roster appears instead of modern players.

## Architecture Decisions

### Decision 1: Shared core module + parallel entry points

**Choice**: Extract transport, validation, identity-safe upsert, and contract generation functions into `scripts/historical_loader_core.py`. Each era script imports the core and passes its own `SeasonConfig` dict. The 2010 script is minimally refactored to delegate to core functions; the 1995 script is a new thin entry point.

**Alternatives considered**:
- **Pure parameterization** (cli args on the existing script): requires touching already-shipped code heavily, risks regression on 2010, and makes per-era constants (tiers, superstar IDs, season strings) harder to read.
- **Pure copy-paste** (parallel scripts with duplicated logic): fastest to write but guarantees drift between era loaders. Every bugfix, validation improvement, or API change must be applied to N files.

**Rationale**: The shared core extracts the functions that are already stable and validated (the 2010 path shipped and works). Each era script becomes a thin config file: constants, a main loop, and a call to core. Bugfixes to HTTP, upserts, or contract generation land once. The 2010 refactor is minimal (~15 lines changed to import instead of define) and preserves backward behavior exactly.

### Decision 2: Explicit SQL guard list over metadata table

**Choice**: Replace `IF v_season_year = 2010 AND NOT v_has_historical_templates THEN RAISE EXCEPTION` with `IF v_season_year IN (2010, 1995) AND NOT v_has_historical_templates THEN RAISE EXCEPTION`.

**Alternatives considered**:
- **Metadata table** (`historical_seasons(season_year INTEGER PRIMARY KEY, ...)`): more future-proof but adds a new table, RLS policies, and a JOIN in the guard — overkill for two values. The `SeasonEra` TypeScript entity already owns metadata; duplicating it in SQL creates two sources of truth.
- **No guard at all**: risk that an era marked `isHistoricalDatasetAvailable: true` creates games with modern rosters because templates weren't loaded. The fail-closed requirement from the proposal mandates a guard.

**Rationale**: The explicit list is the simplest expression in SQL. Adding a new era requires one line in the IN list — this is a feature, not a bug, because it forces the developer to consciously acknowledge the new era in the seed function. When a third era is requested (e.g., 2003 draft class era), the IN list becomes `(2010, 1995, 2003)` — still trivial.

### Decision 3: 1995-specific salary tier table

**Choice**: Define `SALARY_TIERS` in `seed_jordan_rosters.py` with era-calibrated values reflecting the ~$23M salary cap of 1995-96.

| Tier | Range | Rationale |
|------|-------|-----------|
| `superstar` | $3.0M – $4.5M | Jordan's 1995-96 salary was ~$3.85M; top stars like Ewing had balloon contracts but most MVPs were in this band. |
| `star` | $1.8M – $3.5M | Second-tier stars (Hardaway, Hill, Kemp). |
| `starter` | $0.8M – $1.8M | Quality starters on non-rookie deals. |
| `rotation` | $0.4M – $0.9M | Bench depth and role players. |
| `bench` | $0.2M – $0.5M | End-of-bench veterans on minimum-type deals. |
| `rookie` | $0.2M – $1.2M | Rookie scale was unregulated; early picks could earn more than rotation veterans. |

**Alternatives considered**:
- **Reuse 2010 tiers** ($14.5M–$18.5M superstar): would make every 1995 player earn 4–5x historical reality. Anachronistic and misleading.
- **NBA API for real salaries**: `nba_api` does not expose historical contract data. Requires a separate data source (Basketball-Reference scraping) with licensing risk.

**Rationale**: The 1995 tiers produce contracts that feel era-authentic while remaining clearly approximate. The values are documented with the ~$23M cap context so future maintainers understand the calibration baseline.

### Decision 4: Start-of-season roster only (no mid-season trade support)

**Choice**: Keep the `(season_year, player_id) UNIQUE` constraint on `historical_roster_templates` unchanged. The loader processes teams sequentially; when a player appears on a second team (traded mid-season), the second insert is skipped by the `on_conflict` merge. The player is assigned to the first team the loader encounters.

**Alternatives considered**:
- **Change UNIQUE to `(season_year, player_id, team_id)`**: supports multi-team-per-season but requires a rule for which team is "active" in `game_player_states`. Adds migration risk and complexity disproportionate to the MVP.
- **Hand-curated one-team-only list**: manually remove traded players from the second team's batch. Error-prone and requires ongoing maintenance.

**Rationale**: The 2010 path already operates this way (players like Carmelo Anthony who were traded in 2010-11 appear on one team). The simplification is consistent across eras, documented, and deferrable.

### Decision 5: Identity-safe player inserts via `on_conflict` with `ignore-duplicates`

**Choice**: Reuse the existing pattern from `seed_historical_rosters.py`: `POST /players?on_conflict=nba_id` with `Prefer: resolution=ignore-duplicates,return=representation`. Players that already exist (by `nba_id` UNIQUE) are silently skipped; the loader fetches their existing UUID for template rows.

**Alternatives considered**:
- **`merge-duplicates`**: would overwrite existing `players.team_id`, `jersey_number`, and other biography fields. This contaminates global player profiles — a player who spans both 1995 and 2010 would have their 1995 team assignment overwrite their 2010 canonical data.
- **Separate per-era player table**: clean but doubles the data model; `game_player_states` already scopes era differences.

**Rationale**: `ignore-duplicates` guarantees that the first era to insert a player "owns" their global profile row. For the handful of players who span both eras (e.g., Kevin Willis played in both 1995-96 and 2010-11), their 2010-era biography remains intact. The 1995 team assignment is recorded only in `historical_roster_templates` → `game_player_states`.

## Data Flow

```text
                              ┌──────────────────────────────┐
                              │   historical_loader_core.py   │
                              │  (shared transport + upsert)  │
                              └──────────┬───────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼──────┐      ┌──────▼──────┐      ┌─────▼─────┐
              │ 2010 config │      │ 1995 config │      │ (future)  │
              │ seed_hist.. │      │ seed_jordan │      │  config   │
              └─────┬──────┘      └──────┬──────┘      └───────────┘
                    │                    │
                    │  NBA API           │  NBA API
                    │  CommonTeamRoster  │  CommonTeamRoster
                    │                    │
                    ▼                    ▼
              ┌──────────────────────────────────────────────┐
              │              Supabase REST API               │
              │  (SERVICE_ROLE_KEY, never exposed to client) │
              └──────────────────────┬───────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐  ┌─────────────────┐  ┌──────────────────┐
              │ players  │  │ historical_     │  │ historical_      │
              │ (global) │  │ roster_templates│  │ contract_templates│
              └──────────┘  └────────┬────────┘  └────────┬─────────┘
                                     │                    │
                                     │  seed_game_data()  │
                                     │  (SQL function)    │
                                     ▼                    ▼
                              ┌──────────────────────────────────┐
                              │  game_player_states  contracts   │
                              │  (game-scoped,       (game-scoped│
                              │   per-game copies)    per-game)  │
                              └──────────────────────────────────┘

Create Game (user action)
  → seed_game_data(game_id, team_id)
  → reads games.season_year
  → guard: season_year IN (2010, 1995) AND templates missing? → RAISE EXCEPTION
  → templates exist?
       yes → copy roster templates to game_player_states
           → copy contract templates to contracts(game_id)
       no  → fallback: modern canonical catalog + modern salary tiers
```

### Seeding sequence diagram

```text
User                    Next.js                   Supabase SQL              Supabase REST
 │                        │                          │                          │
 │  Create Game (1995)    │                          │                          │
 │───────────────────────>│                          │                          │
 │                        │  INSERT INTO games       │                          │
 │                        │─────────────────────────>│                          │
 │                        │  games.id                │                          │
 │                        │<─────────────────────────│                          │
 │                        │                          │                          │
 │                        │  seed_game_data(id, tid) │                          │
 │                        │─────────────────────────>│                          │
 │                        │                          │  guard: 1995 in (2010,   │
 │                        │                          │   1995) AND templates?   │
 │                        │                          │  RAISE if missing        │
 │                        │                          │                          │
 │                        │                          │  templates exist → COPY  │
 │                        │                          │  hrt → game_player_      │
 │                        │                          │    states                │
 │                        │                          │  hct → contracts         │
 │                        │                          │  (game-scoped)           │
 │                        │                          │                          │
 │                        │                          │  templates missing →     │
 │                        │                          │  FALLBACK: players +     │
 │                        │                          │  modern salary tiers     │
 │                        │                          │                          │
 │                        │  OK                      │                          │
 │                        │<─────────────────────────│                          │
 │  Game created          │                          │                          │
 │<───────────────────────│                          │                          │
 │                        │                          │                          │
 │  View roster           │                          │                          │
 │───────────────────────>│                          │                          │
 │                        │  SELECT * FROM           │                          │
 │                        │  game_player_states      │                          │
 │                        │  JOIN players            │                          │
 │                        │  LEFT JOIN contracts     │                          │
 │                        │─────────────────────────>│                          │
 │                        │  Jordan, Pippen, Rodman..│                          │
 │                        │<─────────────────────────│                          │
 │  Roster shown ←───────│                          │                          │
```

## File Changes

### Slice 1 — Foundation (~220 lines)

| File | Action | Description |
|------|--------|-------------|
| `scripts/historical_loader_core.py` | **Create** | Extracts `request_json`, `supabase_endpoint`, `chunks`, `as_int`, `as_string`, `split_player_name`, `build_player_payload`, `upsert_players`, `fetch_player_ids`, `upsert_templates`, `contract_tier`, `deterministic_int`, `build_contract_template`, `load_team_map`, `load_runtime_dependencies`, protocol types, and `SeasonConfig` TypedDict. ~180 lines. |
| `scripts/seed_historical_rosters.py` | **Modify** | Imports from `historical_loader_core` instead of defining local functions. Constants (`HISTORICAL_SEASON`, `SEASON_YEAR`, `SUPERSTAR_PLAYER_NBA_IDS`, `STAR_PLAYER_NBA_IDS`, `SALARY_TIERS`) remain file-local as the 2010 config. `main()` delegates to core. ~25 line delta. |
| `scripts/migrations/008_jordan_era_snapshots.sql` | **Create** | Replaces `seed_game_data` with a version that guards `v_season_year IN (2010, 1995)` instead of `v_season_year = 2010`. Identical logic otherwise. Includes rollback definition. ~90 lines. |
| `src/domain/entities/SeasonEra.ts` | **Modify** | Flips JORDAN's `isHistoricalDatasetAvailable` to `true`. Updates description to "Usa rosters reales de 1995-96 con contratos aproximados generados." ~5 line delta. |
| `scripts/schema.sql` | **Modify** | Updates comment on historical template tables to reflect multi-era support. ~3 line delta. |

### Slice 2 — 1995 Ingestion (~220 lines)

| File | Action | Description |
|------|--------|-------------|
| `scripts/seed_jordan_rosters.py` | **Create** | New entry point importing `historical_loader_core`. Declares `JORDAN_SEASON = "1995-96"`, `SEASON_YEAR = 1995`, `SUPERSTAR_PLAYER_NBA_IDS`, `STAR_PLAYER_NBA_IDS`, and `SALARY_TIERS` for the 1995 era. Thin `main()` that calls core primitives. ~200 lines. |
| `openspec/specs/historical-era-snapshots/spec.md` | **Modify** | Adds 1995-96 scenario to HIST-006 (era metadata) and a new requirement HIST-008 (fail-closed guard for all declared historical seasons). ~30 line delta. |

## Interfaces / Contracts

### SeasonConfig TypedDict (new in `historical_loader_core.py`)

```python
from typing import TypedDict

class SeasonConfig(TypedDict):
    historical_season: str      # NBA API season string, e.g. "1995-96"
    season_year: int            # e.g. 1995, matches games.season_year
    salary_tiers: dict[str, tuple[int, int]]  # tier_name → (min, max)
    superstar_nba_ids: set[int]
    star_nba_ids: set[int]
```

### Core function signatures (extracted, backward-compatible)

```python
# Transport
def request_json(method: str, path: str, payload=..., extra_headers=...) -> list[RestRow]
def supabase_endpoint(path: str) -> str

# Helpers
def chunks(items: list[T], size: int) -> Iterable[list[T]]
def as_int(value: object) -> int
def as_string(value: object) -> str
def split_player_name(full_name: str) -> tuple[str, str]

# Identity-safe persistence
def build_player_payload(row: RestRow) -> RestRow
def upsert_players(players: list[RestRow]) -> dict[int, str]
def fetch_player_ids(player_nba_ids: list[int]) -> dict[int, str]

# Template persistence
def upsert_templates(table: str, rows: list[RestRow]) -> None

# Contract generation
def contract_tier(player_nba_id: int, roster_order: int, config: SeasonConfig) -> str
def deterministic_int(seed: str, minimum: int, maximum: int) -> int
def build_contract_template(player_id: str, player_nba_id: int, team_id: str, roster_order: int, config: SeasonConfig) -> RestRow

# Team mapping
def load_team_map() -> dict[int, str]

# Runtime
def load_runtime_dependencies() -> tuple[...]
```

### Migration guard contract (Migration 008)

```sql
-- Before (migration 007, line 17):
IF v_season_year = 2010 AND NOT v_has_historical_templates THEN
  RAISE EXCEPTION 'seed_game_data aborted: historical templates for season % are not loaded', v_season_year;
END IF;

-- After (migration 008):
IF v_season_year IN (2010, 1995) AND NOT v_has_historical_templates THEN
  RAISE EXCEPTION 'seed_game_data aborted: historical templates for season % are not loaded. Run the corresponding seed script (seed_historical_rosters.py for 2010, seed_jordan_rosters.py for 1995) before creating games in this era.', v_season_year;
END IF;
```

Rollback function `rollback_seed_game_data` is **unchanged** — it deletes game-scoped rows only and is era-agnostic.

### SeasonEra contract change

```typescript
// Before:
isHistoricalDatasetAvailable: false,
description: "Usa una fecha clásica visual con el dataset canónico actual.",

// After:
isHistoricalDatasetAvailable: true,
description: "Usa rosters reales de 1995-96 con contratos aproximados generados.",
```

### NBA API field validation (new in core)

```python
REQUIRED_ROSTER_FIELDS = {"PLAYER_ID", "PLAYER", "POSITION", "NUM", "TeamID"}

def validate_roster_row(row: RestRow) -> None:
    missing = REQUIRED_ROSTER_FIELDS - set(row.keys())
    if missing:
        raise ValueError(f"NBA API row missing required fields: {missing}")
    as_int(row["PLAYER_ID"])  # raises if not int-compatible
    as_string(row["PLAYER"])  # raises if empty name
```

This runs per-row in `fetch_roster()` before the row is added to the payload batch. A single malformed row fails the entire loader fast, rather than silently seeding partial data.

### Idempotency contract

| Operation | Mechanism | Rerun Safety |
|-----------|-----------|-------------|
| `players` upsert | `POST /players?on_conflict=nba_id` + `resolution=ignore-duplicates,return=representation` | Existing players are skipped; UUID is returned or fetched for template creation. |
| `historical_roster_templates` upsert | `POST /historical_roster_templates?on_conflict=season_year,player_id` + `resolution=merge-duplicates` | Overwrites with latest API data (team, position, jersey). No double rows. |
| `historical_contract_templates` upsert | `POST /historical_contract_templates?on_conflict=season_year,player_id` + `resolution=merge-duplicates` | Overwrites with latest deterministic contract. No double rows. |
| `seed_game_data` | `INSERT ... ON CONFLICT (game_id, player_id) DO UPDATE` + `NOT EXISTS` guard for contracts | Safe to call multiple times on the same game. No duplicate contracts. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Python core** (unit) | `deterministic_int` reproducibility, `contract_tier` classification, `validate_roster_row` field checks, `as_int`/`as_string` edge cases | `pytest` with fixture-based inputs. No Supabase/API dependency. |
| **Python loader** (integration) | Full loader dry-run against a sandbox Supabase project: upserts players, emits templates, reruns idempotently without errors | Manual one-time run before production. Sandbox DB is separate from production. |
| **SQL migration** (integration) | `seed_game_data` with 1995 templates present → game created with 1995 players; `seed_game_data` with 1995 templates absent → RAISE EXCEPTION; `rollback_seed_game_data` → game-scoped rows deleted, templates untouched | Run migration 008 against sandbox Supabase. Create and rollback 1995 games in both conditions. |
| **Domain** (unit) | `SeasonEra` JORDAN entry has `isHistoricalDatasetAvailable: true`; `getSeasonEraById("jordan")` returns updated entity | Vitest assertion on the const array. |
| **UI** (manual) | CreateGameForm shows correct disclaimer text for Jordan era after flag flip | Manual visual check: era selector → Jordan → reads "usa rosters reales" instead of "dataset canónico actual." |
| **End-to-end** (manual) | Full flow: run loader → create 1995 game → verify roster shows Jordan-era players, not modern catalog | One-off validation against production Supabase after both slices merge. |

## Migration / Rollout

### Migration 008 rollout

1. Apply `008_jordan_era_snapshots.sql` to production Supabase.
2. The new `seed_game_data` immediately takes effect — no existing games are affected because the function only runs at game creation.
3. If 1995 templates have not yet been loaded, **new 1995 game creation will fail with a clear error** directing the operator to run `seed_jordan_rosters.py`. This is the intended fail-closed behavior.
4. Once `seed_jordan_rosters.py` completes, new 1995 games seed from templates and the guard passes.

### Rollback

To revert this change entirely:

1. Run `SELECT rollback_seed_game_data('<game_id>')` for any 1995 games created during the window (game-scoped only; does not touch templates or global players).
2. Restore the prior `seed_game_data` definition by re-running migration 007 (or keeping migration 007's version as the active function).
3. Optionally delete 1995 rows from `historical_roster_templates` and `historical_contract_templates`:
   ```sql
   DELETE FROM historical_contract_templates WHERE season_year = 1995;
   DELETE FROM historical_roster_templates WHERE season_year = 1995;
   ```
4. Revert `SeasonEra.ts` JORDAN entry to `isHistoricalDatasetAvailable: false` and original description.
5. **Never** touch `players` rows — other eras may reference the same player UUIDs.

Partial rollback (remove 1995 but keep 2010): only steps 2–4.

### Feature flags

No feature flag needed. The guard-by-template-existence pattern is self-serve: if templates exist, the era is active; if not, the era fails closed. This is already proven for 2010.

## Delivery Strategy: Chained PRs

Both slices stay under 400 changed lines. Strategy: **Feature Branch Chain** with a draft tracker PR.

```
tracker (draft, no-merge)
  └── slice-1-foundation  (targets tracker)
        └── slice-2-1995-ingestion  (targets slice-1)
```

### PR 1 — Foundation (~220 lines) 📍

| Boundary | Files |
|----------|-------|
| **Start** | `scripts/seed_historical_rosters.py` (existing, stable) |
| **Core** | `scripts/historical_loader_core.py` (new) |
| **Refactor** | `scripts/seed_historical_rosters.py` (import from core) |
| **SQL guard** | `scripts/migrations/008_jordan_era_snapshots.sql` (new) |
| **Domain** | `src/domain/entities/SeasonEra.ts` (modify JORDAN) |
| **Doc** | `scripts/schema.sql` (comment update) |

**Dependencies**: None — targets tracker.
**Verification**: Re-run `seed_historical_rosters.py` to confirm 2010 behavior unchanged. Apply migration 008, attempt to create a 1995 game → must fail with "templates not loaded" error. Create a 2010 game → must succeed (2010 templates already loaded).

### PR 2 — 1995 Ingestion (~220 lines) 📍

| Boundary | Files |
|----------|-------|
| **Start** | `slice-1-foundation` branch (core module exists) |
| **1995 loader** | `scripts/seed_jordan_rosters.py` (new) |
| **Spec** | `openspec/specs/historical-era-snapshots/spec.md` (extend) |

**Dependencies**: Targets `slice-1-foundation` — needs migration 008 applied and core module available.
**Verification**: Run `seed_jordan_rosters.py` against sandbox. Create a 1995 game → must succeed with Jordan-era roster. Rerun the loader idempotently → no errors, no duplicate rows.

### Review budget

| Slice | Adds | Dels | Total | Under 400? |
|-------|------|------|-------|------------|
| Slice 1 | ~200 | ~20 | ~220 | ✅ |
| Slice 2 | ~220 | ~0 | ~220 | ✅ |

## Open Questions

- [ ] **Q1**: Confirm Seattle SuperSonics (`nba_id=1610612760`) and Vancouver Grizzlies exist in production `teams` table before running the 1995 loader. Blocked by: access to production Supabase. Mitigation: the loader skips teams not found in `team_map` with a log message — it will not crash, but the roster will be incomplete.
- [ ] **Q2**: NBA API rate limiting for 30 historical franchises at 0.8s delay (~24 seconds total). If the API throttles more aggressively, the `NBA_API_DELAY_SECONDS` constant may need tuning. Mitigation: delay is configurable at the top of the script.

## Non-goals (explicitly deferred)

- Exact historical contracts, CBA rules, or salary cap rules for 1995-96.
- Historical player ratings, stats, injuries, draft classes, or awards.
- Per-season player biography snapshots (1995 players retain their 2010-era biography if they span both eras).
- Mid-season trade support (multi-team-per-season).
- Loader parameterization via CLI arguments (deferred to a third-era refactor).
- Production automation or CI/CD scheduling for loader runs.
