# Exploration: jordan-era-snapshots

## TL;DR

Replace the current 1995/Jordan visual-only fallback with a real 1995-96 roster + approximate contract template layer, reusing the 2010/LeBron infrastructure (migrations 005-007, `historical_*_templates` tables, `seed_historical_rosters.py` pattern). The 1995 era currently silently falls through the seed function's fallback branch and is seeded with the **modern canonical player catalog** (the user's reported bug: "cree una partida del 95 y me trajo los jugadores actuales").

Recommended approach: **parallel loader** (new `seed_jordan_rosters.py`) + new migration `008_jordan_era_snapshots.sql` that extends the existing 2010-only guard into a generic "any season declared as historical-backed must have templates loaded" guard. Effort: Medium. Review budget: ~500 lines (above the 400 cap → chained PRs).

---

## Current State

### How a 1995/Jordan game is seeded today

`seed_game_data(p_game_id, p_team_id)` (current version in `scripts/migrations/007_add_fallback_contract_salaries.sql`) has three branches:

1. **Hard guard** (line 18): `IF v_season_year = 2010 AND NOT v_has_historical_templates THEN RAISE EXCEPTION`. This guard is **hard-coded to 2010 only**. 1995/Jordan is not guarded.
2. **Historical branch** (line 22): if `historical_roster_templates` has rows for the game's `season_year`, copy them to `game_player_states` and `historical_contract_templates` to `contracts` (game-scoped).
3. **Fallback branch** (line 33): otherwise, insert ALL rows from the current canonical `players WHERE team_id IS NOT NULL` into `game_player_states`, then insert deterministic per-team-tier contracts (the migration 007 salary tier system: $45M for the top player per team, $30M for positions 2-3, etc.).

For a 1995-96 game, branch 1 is skipped (guard only matches 2010), branch 2 is skipped (no templates for 1995), so the **fallback branch executes with the modern canonical player catalog** and modern-era salary tiers. The result is exactly what the user observed.

### Why it works for 2010 today

The 2010 flow has:
- Schema: `historical_roster_templates`, `historical_contract_templates` (both keyed by `(season_year, player_id)`).
- Data: 437 players + 437 roster templates + 437 contract templates seeded by `seed_historical_rosters.py` against the live Supabase.
- Seed function: copies templates into game-scoped state.
- `SeasonEra` metadata: `isHistoricalDatasetAvailable: true` for 2010/LeBron.

### What is missing for 1995

- 1995-96 templates are absent in `historical_*_templates`.
- `SeasonEra.ts` still declares 1995/Jordan as `isHistoricalDatasetAvailable: false` with description "Usa una fecha clásica visual con el dataset canónico actual."
- The fallback's hard guard does not block 1995.

---

## Affected Areas

| Path | Layer | Why it is affected |
| --- | --- | --- |
| `src/domain/entities/SeasonEra.ts` | Domain | Must flip `isHistoricalDatasetAvailable: true` for JORDAN and update the description to mention real rosters + approximate contracts. |
| `scripts/migrations/008_jordan_era_snapshots.sql` (new) | Infrastructure | Extend the hard guard to cover 1995 (or generalize it to a metadata-driven guard). |
| `scripts/seed_jordan_rosters.py` (new) | Infrastructure scripts | NBA API ingestion for 1995-96 + era-appropriate salary tier table. |
| `scripts/seed_historical_rosters.py` | Infrastructure scripts | Refactor target (optional) — consider parameterizing for reuse, but defer to avoid scope creep. |
| `scripts/schema.sql` | Infrastructure | Documentation update to reflect that the 2010-only comment now applies to any historical era. |
| `openspec/specs/historical-era-snapshots/spec.md` | Spec | Add a 1995-96 scenario to HIST-006 (or factor HIST-006 into a generic metadata rule). |
| `openspec/changes/jordan-era-snapshots/` (new) | SDD | Proposal/spec/design/tasks/apply-progress for this change. |

---

## Approaches

### Approach A — Parallel loader (recommended for MVP)

A new `scripts/seed_jordan_rosters.py` mirrors `seed_historical_rosters.py` but with:
- `HISTORICAL_SEASON = "1995-96"`, `SEASON_YEAR = 1995`
- A 1995-era salary tier table (1995-96 cap was ~$23M; top stars earned $3-4M, not $14-18M)
- A 1995-era superstar/star ID set

A new migration `008_jordan_era_snapshots.sql`:
- Replaces the line `IF v_season_year = 2010 AND NOT v_has_historical_templates THEN RAISE EXCEPTION` with a guard that triggers for any era whose `SeasonEra.isHistoricalDatasetAvailable === true`. The simplest expression in SQL is to keep the season-by-season list (`2010`, `1995`) explicit and short, since SQL has no DOM access.
- Adds `1995-96` superstar/star ID lists and salary tier constants only in the Python script (the SQL function is season-agnostic).

- **Pros**: small, isolated, easy to review; matches the 2010 pattern the user already validated.
- **Cons**: code duplication; two scripts to maintain.
- **Effort**: Low–Medium.

### Approach B — Parameterize the existing loader

Refactor `seed_historical_rosters.py` to accept `season_year` and `season_string` from CLI args, move the salary tier / superstar ID sets to a per-season config, and run it once per era.

- **Pros**: DRY; one place to evolve loader logic.
- **Cons**: requires touching already-shipped code; riskier; bigger PR.
- **Effort**: Medium.

### Approach C — NBA API + curated fixture fallback

Try the NBA API for 1995-96; on failure, fall back to a hand-curated JSON/CSV fixture in `scripts/fixtures/`.

- **Pros**: resilient to NBA API flakiness for very old seasons.
- **Cons**: two code paths, licensing concerns for a hand-curated fixture, complexity.
- **Effort**: High.

### Recommendation

**Approach A** for this change. Ship 1995-96 in a tightly-scoped parallel path that mirrors the validated 2010 path, and queue Approach B (loader refactor) as a follow-up change when a third era is requested. This keeps the current PR under the 400-line review budget when split into chained slices.

---

## Risks and Open Questions

### 1. NBA API availability for 1995-96

The `nba_api` library's `CommonTeamRoster` endpoint supports historical seasons via the `season` parameter (e.g., `"1995-96"`). The 2010 loader worked without special handling. **Action**: spike-run the loader against 1995-96 against a sandbox project to confirm before locking the spec. This is the single biggest blocker for the change.

### 2. Salary economics mismatch

`seed_historical_rosters.py` uses 2010-era `SALARY_TIERS` (superstar $14.5M-$18.5M). 1995-96 cap was ~$23M and Jordan's salary that year was ~$3.85M. Reusing the 2010 tiers would make every 1995-96 contract look anachronistic (everyone earning 4-5x what they actually did). **Mitigation**: introduce a 1995-96 salary tier set in the new Python script only, with explicit comments that the figures are still approximate.

### 3. Mid-season trades (multi-team players in one season)

In 1995-96, players like Dennis Rodman, Chris Mills, and Robert Horry were traded mid-season. `CommonTeamRoster` returns one roster per team, so a traded player appears under two team IDs. The current `(season_year, player_id) UNIQUE` constraint in `historical_roster_templates` would reject the second insert. **Mitigation options**:
- **(a) Use start-of-season roster only** — keep one row per player keyed by their first 1995-96 team. Simplest, matches the dominant 2010 behaviour. Document the limitation.
- **(b) Allow multiple rows per player** — change the unique constraint to `(season_year, player_id, team_id)` or drop it. Requires migration and a new rule for which team is "active" in `game_player_states`.
- **Recommendation**: (a) for MVP. Defer (b) to a future change if/when mid-season trades matter.

### 4. Global player profile contamination

`players.nba_id` is `INTEGER UNIQUE NOT NULL` — one row per NBA ID for life. The 2010 loader inserted all 2010-11 players. For 1995-96:
- Most 1995-96 stars (Jordan, Penny Hardaway, Hakeem, Ewing, Robinson, Stockton, Malone, Barkley, Drexler, Olajuwon, Mourning, etc.) are NOT in the 2010-11 catalog → no contamination, new rows.
- A handful of players appeared in both 1995-96 and 2010-11 (e.g., Kobe Bryant was drafted 1996-97, so not in 1995-96; but Grant Hill, Kevin Willis, etc. span both). For these, the canonical `players` row holds their 2010-11 biography (height, weight, jersey, current team), not their 1995-96 biography. `historical_roster_templates` does not store biography, so the **game will display modern biography for a 1995 player** in the player detail page.
- **Mitigation**: (a) accept the minor biographical inaccuracy for MVP and document it; (b) add a per-season biography snapshot table (large scope, defer).

### 5. Team identity and name changes

- Seattle SuperSonics (1995-96) → OKC Thunder (2008). Distinct `nba_id` in `nba_api.stats.static.teams`.
- Vancouver Grizzlies (1995-96) → Memphis Grizzlies (2001). Distinct `nba_id`.
- The current `teams` table was populated by `scripts/ingest_data.py` with `nba_teams.get_teams()` which includes all historical franchises, so `teams.nba_id` should resolve for all 1995-96 teams.
- **Action**: verify by listing `teams WHERE nba_id IN (8, 23)` (or whatever the nba_api static IDs are for those franchises) before running the loader.

### 6. Already-created 1995 games

The user has at least one 1995 game created under the fallback. It contains the modern canonical player roster in `game_player_states` and the modern-era salary tier contracts (from migration 007 backfill). Two policies:

- **(a) Leave existing 1995 games as-is**. They are internally consistent (modern roster + modern-era salaries) and re-seeding would destroy any user edits. Only NEW 1995 games get the new template-based behavior. Recommended for MVP.
- **(b) Offer a one-time backfill**. Risky; could overwrite user-edited contracts. Defer.

### 7. Season-aware contract reads

`SupabaseContractRepository.getActiveContracts` (line 60) reads `games.season_year` and filters `end_year >= season_year`. This is already era-agnostic and will Just Work for 1995 games seeded with `end_year` values like 1995-1999.

### 8. The "1995" vs "1995-96" season string

`SEASON_ERAS` uses `seasonYear: 1995` (start year). The NBA API uses `"1995-96"`. The seed function uses `games.season_year = 1995`. The templates store `season_year = 1995`. The Python loader needs `HISTORICAL_SEASON = "1995-96"`. No collision, but worth a comment in the loader.

---

## Reuse Map from `historical-era-snapshots`

| Asset | Reuse? | Notes |
| --- | --- | --- |
| `historical_roster_templates` table | **Yes, as-is** | `(season_year, player_id)` unique allows 1995 rows alongside 2010. |
| `historical_contract_templates` table | **Yes, as-is** | Same. |
| `seed_game_data` SQL function | **Yes, modify guard** | Replace the `season_year = 2010` literal with a list (`season_year IN (2010, 1995) AND NOT v_has_historical_templates`) or a metadata table lookup. |
| `rollback_seed_game_data` | **Yes, as-is** | Game-scoped delete unaffected. |
| `seed_historical_rosters.py` | **Clone + modify** | Mirror structure; replace constants and salary tier table. |
| `SeasonEra` entity | **Modify** | Flip JORDAN `isHistoricalDatasetAvailable` to `true`; update description. |
| `SupabaseContractRepository.getActiveContracts` | **Yes, as-is** | Already season-aware. |
| Spec `openspec/specs/historical-era-snapshots/spec.md` | **Extend** | Add a 1995-96 scenario to HIST-006 (or factor HIST-006 into a generic metadata requirement). |
| `openspec/changes/archive/2026-07-15-historical-era-snapshots/` | **Reference, do not modify** | Use as the template for the new proposal/spec/design/tasks. |

---

## Recommended Work-Unit Split (Chained PRs)

Given the 400-line review budget, the 1995 change should ship as **two chained PRs**:

### PR 1 — Schema + seed function guard + `SeasonEra` metadata flip
- New migration `008_jordan_era_snapshots.sql` (~80 lines): guard change + `SeasonEra` is not in SQL, but the function-level guard is.
- Modify `seed_game_data` guard.
- Update `src/domain/entities/SeasonEra.ts` (JORDAN entry, ~10 lines).
- Update `scripts/schema.sql` comment.
- **Estimated lines**: 80-120.

### PR 2 — NBA API loader for 1995-96 + contract generation
- New `scripts/seed_jordan_rosters.py` (~340 lines, parallel to `seed_historical_rosters.py`).
- Update `openspec/specs/historical-era-snapshots/spec.md` to add 1995-96 scenario (~30 lines).
- Documentation: manual run steps.
- **Estimated lines**: 350-400.

This keeps each PR under the 400-line cap.

---

## Open Questions for the User

1. **Already-created 1995 games**: leave as-is (recommended) or attempt backfill? Leaving is safer.
2. **Mid-season trades**: accept the "start-of-season roster only" simplification (recommended) or invest in multi-team-per-season support? Simplification is cheaper.
3. **Salary economics**: use a 1995-96-specific tier table (recommended, looks more authentic) or reuse the 2010 tiers for code simplicity? The former is more truthful to the era even if the numbers are still approximate.
4. **Existing 2010 era metadata**: leave `SeasonEra` description for LeBron as-is, or reword both entries in this change to share a common "real rosters + approximate contracts" disclaimer?
5. **Spike validation**: do you want me to run a dry `CommonTeamRoster(team_id=<sonics>, season="1995-96")` against the live NBA API before the spec is locked, to confirm the 1995-96 endpoint is reachable?

---

## Ready for Proposal

**Yes**, once the user picks the open questions above. The change should start with `/sdd:new jordan-era-snapshots` (or `openspec-new-change`) and produce the standard five artifacts: `proposal.md`, `specs/<capability>/spec.md` (likely extending `historical-era-snapshots/spec.md` rather than creating a new capability), `design.md`, `tasks.md`, and `apply-progress.md`.

The single highest-leverage action before locking the spec is to **verify NBA API availability for the 1995-96 season** with a one-off Python call. If the endpoint is unavailable or rate-limited, Approach C (fixture fallback) becomes attractive and Approach A's scope changes.
