# Courtside Franchise Manager — Full Application & Integration Audit

**Date:** 2026-11-02
**Method:** Read-only repository investigation. No source files, configs, schemas, or database rows were modified. The only file written is this report. Safe static verification commands were executed (`tsc`, `vitest`, `biome`); no servers were started and no live database was connected to.

**Verification commands run (results quoted in section I):**

```
bun tsc --noEmit          → 0 errors
bun vitest run            → 138/142 suite files pass, 1104/1104 tests pass, 4 failing discovery files (stale prototype .cjs tests)
bun biome check .         → 1 formatting error (.engram/manifest.json — not application source)
```

**Live-database status:** The initial repository-only audit could not verify deployment. After the user authorized the Supabase MCP, a read-only live check confirmed 42 public tables with RLS enabled, aggregate data counts, migration-registry entries, and current Supabase Advisor findings. The live schema broadly matches `scripts/schema.sql`, but the MCP migration registry has only two entries versus 56 numbered repository migration files; exact migration-history reconciliation and per-user RLS behavior remain unverified. See the live verification addendum at the end of this report. No rows were written or gameplay actions run.

---

## A. Executive Summary

**What the application actually does today.** Courtside Franchise Manager is a real, persistent, database-backed NBA GM game — not a UI shell. A user authenticates (Supabase Auth), creates a franchise "game" from three eras (Modern 2026-27, LeBron 2010-11, Jordan-era 1995-96 — `src/domain/entities/SeasonEra.ts:22-54`), and gets a league seeded with real NBA data (teams, rosters, contracts, ratings) through a mix of ESPN/Basketball-Reference/2K integrations and historical ingest scripts. From the game dashboard the user can advance the simulation day (or month/season batch) through a PostgreSQL possession engine that produces moments, box scores, standings, and season statistics; view roster with release actions; execute transactions-validated trades that persist atomically; run a free-agency market with server-evaluated offers; browse standings, teams, players, and player profiles; and, after the season is simulated, view play-in, playoffs, and a champion, then enter an offseason with expiring-contract recording, team-option decisions, and a player-option policy — all persisted in per-user, RLS-protected game state.

**What is genuinely functional (verified against code):**
- Franchise creation with seeding + schedule initialization (`src/application/hooks/games/useCreateGame.ts`), protected by rollback.
- Advance Day / Advance to next game / Month / Season batch → `advance_simulation_day` RPC (`src/application/hooks/simulation/useAdvanceDay.ts:18`, `useAdvanceRange.ts:54-80`), with a Zustand-based single-simulation lock (`useBatchSimulationStore.ts`).
- Trades: domain validation + atomic SQL execution + persisted history (`TradeEngine.ts`, `SupabaseTradeRepository.ts:39` → `execute_trade_transactional`).
- Free agency: market read, offer submission with server-side assessment, resolution during simulated days, contract ownership rules (migrations 020-031, 026/028 SQL).
- Postseason through champion (migrations 049-052) with a reactive UI (`src/components/postseason/`).
- Offseason entry: contract ledgers, team options, player-option policy `salary-comparison-v1` (migrations 053-055; `docs/OFFSEASON.md`).
- League browsing: standings, teams directory, players database, player profiles, day-by-day results with box scores.
- A separate MyCareer mode (create-a-player lifecycle with events, draft offers, retirement) hidden from the main navigation.

**What remains a prototype.** The complete NBA Draft module (Hub, Board, Lottery, Order, Night), League Leaders, Transactions ledger, dedicated Scouting surfaces, Franchise Profile with front-office/finances depth, and a unified Settings page exist only in the exported OpenDesign prototypes (`docs/NBA-Franchise-Management-Redesign/`) — with the exception of draft picks existing as trade assets and offseason freeing of picks. There is no draft engine, no draft-night flow, and no draft selection persistence in `src/`.

**Main architectural strengths.** Clean/hexagonal layering with strong Zod validation at every repository boundary; the game engine lives in idempotent, transactional, guarded SQL functions rather than client code; RLS on all 42 tables with owner policies; deterministic seeded randomness (`possession_random(p_seed, p_draw)`, migration 044:4); bilingual i18n (en/es, ~1.7k translation lines); a 1,104-test suite covering domain, infrastructure, migration checks, and components.

**Main blockers.** (1) The OpenDesign draft and scouting modules are not integrated at all. (2) Multi-season progression stops at the offseason: after a champion, advance controls are disabled ("no rollover" — `layout-components.tsx:312`); the roadmap (`docs/SIMULATION_ROADMAP.md`, tail) explicitly records "no draft, no summer market, no calendar regeneration, no aging, no automatic contract/roster changes" and "does not start 2027-28". (3) No AI GMs exist anywhere in `src/` — counterpart decisions do not exist for trades, and free-agency "decisions" are server policies, not rival managers. (4) A confirmed broken nav item: the sidebar exposes `/settings` (`layout-components.tsx:99`) but no settings route exists (lands in the `[...not-found]` catch-all).

---

## B. Verified Technology Stack

| Category | Verified | Evidence |
|---|---|---|
| Runtime / package manager | Bun 1.3.13 (pinned) | `package.json` `packageManager` |
| Framework | Next.js **16.1.4**, App Router, React 19.2.3 | `package.json` dependencies |
| Language | TypeScript 5 (strict; `tsc --noEmit` passes) | `tsconfig.json`, audit run |
| UI | Tailwind CSS 4, shadcn/ui, Base UI/Radix, lucide-react, tw-animate | `package.json`, `components.json`, `src/components/ui/*` |
| Server state | TanStack Query 5 (`@tanstack/react-query`) | `src/application/hooks/**` |
| Client state | Zustand 5 stores (game/trade UI selection, batch-sim lock) | `src/application/stores/*` |
| Validation | Zod 4 at all trust boundaries | repositories (`z.in`/`z.uuid()` parses), API routes |
| Backend | Supabase: `@supabase/ssr` 0.8 + `supabase-js` 2.93; server + client + service-role clients (`src/infrastructure/supabase/`) | `src/infrastructure/supabase/*` |
| Auth | Supabase Auth (email/password via `src/app/login/page.tsx`, recovery route `src/app/auth/recovery/route.ts`, password change `src/app/account/password/page.tsx`, client `AuthGuard` in `src/application/auth/AuthGuard.tsx`) | files |
| Engine | PostgreSQL RPC functions (possession engine, daily sim, postseason, free-agency resolution, trade execution) | `scripts/migrations/*.sql` |
| Lint/format | Biome 2.3 (only tool; no ESLint/Prettier) | `biome.json` |
| Tests | Vitest 4 + Testing Library + happy-dom; 142 files / 1,104 tests | `vitest.config.ts`, audit run |
| Data ingestion (Python, manual) | `nba_api` (swar/nba_api) via `scripts/ingest_data.py`, `historical_loader_core.py`; hoopshype salary scrape (`scrape_real_salaries.py`) | script imports |
| Data sources (TS, live fetch) | ESPN web API rosters (`src/infrastructure/roster/espnRosterSource.ts:92,99`), Basketball-Reference contract snapshots (`src/infrastructure/contracts/basketballReferenceContractSource.ts:105`), **nba2kapi.com ratings** (`src/infrastructure/ratings/nba2kRatingsSource.ts:57-58`) | files |

**Planned but not verified in this audit:** any scheduled/cloud ingestion; a deployed migration set in Supabase; real-time subscriptions (none found); Playwright (listed in AGENTS.md, not present in `package.json` devDependencies).

---

## C. Repository Architecture

### Directories

| Path | Responsibility |
|---|---|
| `src/app` | Next.js App Router: `(protected)` group (auth-guarded hub, games, dashboard), `login`, `account/password`, `auth/recovery`, dedicated API route handlers, dev-only `ui-preview` |
| `src/domain` | Pure entities, constants, repositories interfaces, services (TradeValidator, SalaryCapCalculator, ContractGenerator, PostseasonQualification, Offseason projections), i18n catalogs. No Supabase/React imports. |
| `src/application` | TanStack Query hooks per family (games, teams, players, contracts, roster, schedule, simulation, free-agency, trades, postseason, offseason, career), Zustand stores, services (TradeEngine), i18n providers |
| `src/infrastructure` | Concrete adapters: Supabase repositories (one per domain), ESPN roster source, B-Ref contract source, nba2k ratings source, player-identity crosswalk, Supabase client factories |
| `src/components` | Presentation: `dashboard/` shell + widgets, `games/`, `roster/`, `league/`, `players/`, `trades/`, `free-agency/`, `postseason/`, `offseason/`, `theme/`, `ui/` (shadcn primitives) |
| `scripts/` | SQL schema + 56 numbered migrations; Python/mysql-adjacent ingest seeds; manual Postgres integration runners (`test-*-postgres.ts`) |
| `tests/` | Vitest suites per layer (domain, infrastructure incl. migration copies, application hooks, presentation) |
| `docs/NBA-Franchise-Management-Redesign/` | Exported OpenDesign prototype (12 active pages, own `courtside-ui-audit.md`) |
| `docs/` | System documentation: STATE_ARCHITECTURE, POSSESSION_ENGINE, POSTSEASON, OFFSEASON, SIMULATION_ROADMAP (detailed acceptance log), UI plan |

### Execution path: opening the app → franchise screen

1. `src/app/login/page.tsx` (client) → Supabase email/password sign-in.
2. `src/app/(protected)/layout.tsx` wraps children in client-side `AuthGuard` (`src/application/auth/AuthGuard.tsx`); there is **no `middleware.ts`** — server-side protection is RLS policies, not route middleware.
3. `src/app/(protected)/page.tsx` lists saved games (and career saves) from `games` per user.
4. `games/new` → `CreateGameForm` → `useCreateGame`: creates `games` row (`status: initializing`), calls `/api/roster-refresh` (ESPN roster → contract materialization via service-role), `/api/player-attributes/bootstrap` (2K ratings cache → game attribute materialization), seeds pick inventory, initializes schedule — with rollback on failure (`useCreateGame.ts:53-60`, route handlers in `src/app/api/*`).
5. `games/[gameId]/dashboard/layout.tsx` loads `useGame(gameId)` (canonical `games` row: `selectedTeamId`, `seasonYear`, `simulationDate`), applies team theme, renders `DashboardSidebar` + `DashboardHeader` (`src/components/dashboard/layout-components.tsx`) and an accessible scroll region (skip-link at line 53).
6. Every child page reads through TanStack Query hooks keyed `["games", gameId, …]`, hitting Supabase repositories — the same data other pages and the sim mutate, with invalidation after mutations.

### State-management architecture

Exactly as documented in `docs/STATE_ARCHITECTURE.md`: TanStack Query for all persisted game state (teams, players, contracts, rosters, schedule, standings, box scores, postseason, offseason, free agency, trades); Zustand only for UI state (`useTeamStore`, `usePlayerStore`, `useTradeStore`, `useBatchSimulationStore` as a day-sim mutex). The component shell reads the **canonical `games` row** for simulation date, season, and selected team — there are no observable duplicate copies of franchise state in client stores.

**Canonical state anchor.** `games` (`scripts/schema.sql:75`): `id`, `user_id`, `selected_team_id`, `season_year`, `season_era_id`, `simulation_date`, `status` — the authoritative root. Game clock writes are guarded (`guard_game_clock_writes`); the sim RPC advances it with an expected-date precondition (`useAdvanceDay.ts:20`).

### Duplicated / abandoned / inconsistent code

| Item | Evidence | Status |
|---|---|---|
| `src/app/dashboard/**` (3 files) | All just `redirect("/")` | Abandoned stubs kept for old URLs |
| `src/app/select-team/page.tsx` | `redirect("/games/new")` | Abandoned experiment |
| `src/components/team-selector.tsx` | Pushes `/dashboard` (line 71) which redirects to `/`; **no imports found anywhere** | Dead code (conflict risk none, but app-breaking if ever wired) |
| `src/domain/services/SeasonSimulator.ts` | Reference in `docs/STATE_ARCHITECTURE.md` and its own test; **no production caller found** | Abandoned TS sim POC; the real engine is SQL (`advance_simulation_day`) |
| Career mode UI strings | Hard-coded English inside `src/app/(protected)/career/[careerId]/page.tsx` (e.g. "Sign with", "Advance Season", "Retire"), outside the en/es i18n catalogs used everywhere else | Untranslated module, and a **second game-state model** (`career_saves`) disjoint from `games` |
| `docs/NBA-Franchise-Management-Redesign/tests/*.cjs` (4 files) | Plain node test scripts, no vitest suites; vitest picks them up and fails discovery | Tooling-config leak; makes `bun test` exit non-zero |

---

## D. OpenDesign Integration Matrix

Prototype reference: `docs/NBA-Franchise-Management-Redesign/` (index/dashboard, calendar, roster, league hub [standings, teams, players, leaders, transactions], trade-center, free-agency, postseason, franchise profiles, draft [hub/board/lottery/order/night]). Prototype fidelity itself is already exhaustively audited in `docs/NBA-Franchise-Management-Redesign/courtside-ui-audit.md` — all prototype data is static/local (`league-data.js`, `roster-data.js`, `draft-data.js`, …) with **no backend, no fetch, no persistence** (audit §B).

| Module | Prototype | Application route | Integration | UI fidelity | Data source | Functional interactions | Persistence | Gameplay integration | Missing pieces | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| **Franchise Dashboard** | `index.html` | `src/app/(protected)/games/[gameId]/dashboard/page.tsx` | Integrated | High ( Courtside visual language rebuilt over shadcn) | Supabase (live) | Next game, standings summary, cap space, alerts/widgets | Loads canonical state | Reads sim results | None major | page.tsx imports `NextGameWidget`, `StandingsWidget`, `CapSpaceWidget`, `AlertsWidget` |
| Simulation date + advance | dashboard/sidebar + calendar "advance" | Sidebar footer + header dropdown | Integrated | High | Supabase (`games.simulation_date`) | Advance Day / Next Game / Month / Season with progress + stop | **Yes (RPC)** | **Yes — drives the engine** | No event-driven calendar actions other than games | `layout-components.tsx:291-380`, `useAdvanceDay.ts`, `useAdvanceRange.ts` |
| **Calendar** | `calendar.html` | `…/dashboard/schedule/page.tsx` + `schedule/day/[date]/page.tsx` | Integrated | High | Supabase (`scheduled_games`, box scores) | Month paging, day selection, day results, box scores | Yes | Yes (results produced by sim) | Off-court events (lottery, deadlines) not modeled | `src/components/games/Calendar.tsx`, `useSchedule`, `useBoxScore` |
| **Postseason** | `postseason.html` | `…/dashboard/postseason/page.tsx` | Integrated | High | Supabase (`postseason_*`, migrations 049-052) | Qualification view, play-in, bracket/series, champion, elimination; hosts Offseason panel | Yes | Yes (engine-generated) | Champion milestone ceremony depth; offseason continuation → next season missing | `layout-components.tsx:298-315`, `src/components/postseason/*`, `docs/POSTSEASON.md` |
| **Roster** | `roster.html` | `…/dashboard/roster/page.tsx` | Integrated | High | Supabase (game roster, contracts, attributes, stats) | Table views (overview/attributes/contract/stats per plan doc), player selection, **release player** with cap-coverage rules | Yes (releases in `game_roster_releases`, migrations 035/036) | Yes | No rotation/lineup editor; no contract extension flow (prototype has one; app does not) | `src/components/roster/roster-table*.tsx`, `release-player-button.tsx` |
| **Franchise profile** | `franchise.html` | `…/dashboard/league/teams/[teamId]/page.tsx` | Partial (matches prototype plus real data) | Medium-High | Supabase | Team detail from league; finances/biography depth varies | Read-only | Partial | Front-office/strategy attributes, dedicated profile shell | `docs/courtside-ui-migration-plan.md:207` |
| **Settings** | dashboard settings dialog | **None** — sidebar link exists (`/settings`) but no route | Not integrated | N/A | N/A | Link lands in `[...not-found]` | No | No | Entire module | `layout-components.tsx:99`; route tree has no `settings/` |
| **League overview** | `league.html` hub | `…/dashboard/league/page.tsx` | Partial ("not yet the prototype hub" — plan doc) | Medium | Supabase | Team browsing, search, attributes/stats views | Read-only | Read-only | News/spotlight/transactions panels | `league/page.tsx`, plan doc:207 |
| **Standings** | `standings.html` | `…/dashboard/league/standings/page.tsx` | Integrated | High | Supabase (`league_standings`) | Conference/division/overall, expansion | Read-only | Yes (engine-written) | — | `useStandings` hook |
| **Teams directory** | `teams.html` | `…/dashboard/league/teams/page.tsx` | Integrated | High | Supabase (`teams`) | Directory, conference filter | Read-only | — | — | route file |
| **Players database** | `players.html` | `…/dashboard/league/players/page.tsx` | Integrated | High | Supabase (league players + attributes) | Filters, sorting, profile links | Read-only | — | Prototype의 shortlist/comparison not carried over | `league/players/page.tsx` |
| **Player profile** | full-profile view | `…/dashboard/player/[id]/page.tsx` | Integrated | Medium-High | Supabase | Bio, contract; statistics/scouting section **partial with placeholder** | Read-only | — | Scouting section placeholder | plan doc:208 |
| **League leaders** | `players.html#view=leaders` | **None** | Not integrated | N/A | N/A (season statistics data exists — se migration 048 — but no leaders screen) | — | — | — | Entire screen | route tree |
| **Transactions** | `league.html?view=transactions` | **None** | Not integrated | N/A | N/A (executed_trades table exists) | — | — | — | Entire screen | route tree; prototype audit §C.5 |
| **Trade Center** | `trade-center.html` | `…/dashboard/trades/page.tsx` | Integrated | High | Supabase + domain validation | Asset selection (players + draft picks), CBA validation warnings/errors, execution, history | **Yes** (`execute_trade_transactional`, `executed_trades`, `trade_asset_snapshots`) | Yes | No AI counterpart/negotiation states; add/remove + execute only | `trades/page.tsx` (453 lines), `TradeEngine.ts`, repo RPC |
| **Free Agency** | `free-agency.html` | `…/dashboard/free-agency/page.tsx` | Integrated | High | Supabase (market snapshots, offers) | Market browsing, offer builder, submit; pending offers resolved on simulated days (accept/counter/reject server-side) | **Yes** (`free_agency_pending_offers`, resolution SQL 025/026/028) | Yes (offers → contracts, cap coverage) | Initial import step is explicit per game; no scouting-report deep dive | `market-screen.tsx`, `useFreeAgencyMarket.ts`, migrations 020-031 |
| Summer FA off market | free-agency.html | `game_offseasons`/offseason panel | Partial | Medium | Supabase (offseason contracts/options) | Ledger reading, team-option decisions, player-option policy, projected roster | Yes | Partial (planning only) | No next-season signing window yet | `src/components/offseason/*`, `docs/OFFSEASON.md` |
| **Contract management (standalone)** | dashboard manage-contract | Embedded in roster/player/offseason surfaces | Partial | Medium | Supabase | Contract reading, releases, offseason option handling | Yes | Partial | No extension offers; prototype extension demo not ported | grep "extension" in `src/components/roster` → none |
| **Scouting** | scouting dialogs/profiles | **None as a module** (attributes + 2K ratings data exist) | Not integrated | N/A | N/A | — | — | — | Entire module; data foundation partially exists (`game_player_attributes`, `player_rating_source_cache`) | route tree |
| **Draft Hub** | `draft.html#view=hub` | **None** | Not integrated | N/A | `draft_picks` / `game_pick_inventory` exist only as trade assets | — | — | — | Entire module | route tree |
| **Draft Board / Lottery / Order / Night** | 4 prototype screens/models (+ .test.cjs files) | **None** | Not integrated | N/A | N/A | — | — | — | Entire module; prototype JS models (lottery/night/order) are referenced nowhere in `src/` | `grep -rln draft src/components src/application` → only trade pick inventory |

**Fully designed but missing from the application:** Draft (all 5 surfaces), Scouting, League Leaders, Transactions, Settings, the Franchise profile's front-office/strategy depth, prototype-level roster rotation editing, extension negotiations.

**Application features with no prototype equivalent:** the `(protected)` games-management hub, `games/new` creation wizard with era selection and rollback, Login/password/recovery, API bootstrap routes, dev-only `ui-preview`, and the MyCareer mode.

---

## E. Database and Supabase Inventory

Effective schema (repository evidence): `scripts/schema.sql` (355 KB, 42 tables, 66 policies, RLS enabled on all 42 tables) + migrations 001-056 in `scripts/migrations/`. Relationship integrity is enforced with foreign keys — cross-game tables use composite FKs, e.g. `postseason_play_in_games` → `scheduled_games(game_id, id)` (`schema.sql:957` region).

### Identity & ownership

- `career_saves` (`schema.sql:323`) + `games` (`schema.sql:75`) both carry `user_id … NOT NULL` with owner policies (`schema.sql:375-402`; `games_select/insert/update/delete_owner`) scoped to `auth.uid()` (`schema.sql:378`).
- All game-scoped tables (`scheduled_games`, `league_standings`, `game_player_states`, contracts, attributes, stats, postseason, offseason, offers, box scores) cascade or restrict to `games(id)` and inherit owner context through policies (66 POLICY statements, `schema.sql:375+`).
- **Write-integrity guards**: `guard_game_clock_writes`, `guard_game_player_state_writes`, `guard_legacy_contract_writes` block client-side direct mutation of canonical state; writes go through RPCs that validate preconditions (`expected_date` compare in `advance_simulation_day`).

### Domain tables (name → responsibility; read/writers)

| Table (schema.sql line) | Responsibility | Written by | Read by |
|---|---|---|---|
| `teams` (11), `players` (25), `contracts` (46) | Global NBA reference data (30 teams, players, contracts) | Ingest scripts (historical ~2010/1995 + modern refresh), `/api/roster-refresh` | Teams/players/roster hooks, trades, FA, careers |
| `contracts` / `game_contract_*` (1028-1093): `game_contract_materializations`, `_identities`, `_agreements`, `_seasons`, `_provenance` | Game-scoped canonical contracts with copy immutability (`enforce_game_contract_copy_immutability`) and provenance tracking | `/api/roster-refresh`, `materialize_game_contract_snapshots`, trades, FA signing | Roster, trades, FA, offseason |
| `game_runtime_contracts` (2166) | Per-game view layer for current roster contracts | materialization | Roster/trades |
| `historical_roster_templates` (122) / `historical_contract_templates` (136) | Jordan/LeBron era snapshots | migrations 005/008/seed scripts | game seeding |
| `roster_refresh_runs` (158) / `roster_refresh_staging` (169) / `contract_source_snapshot_versions` (182) / `current_contract_source_snapshots` (199) | Ingest provenance: who refreshed which roster/contract snapshot when | ESPN/B-Ref pipeline | refresh path |
| `games` (75) | **Canonical franchise root**: user, selected team, season, era, `simulation_date`, status | `SupabaseGameRepository.create`, `advance_simulation_day` (guarded) | every dashboard page |
| `scheduled_games` (944) | Per-game fixture schedule + scores/status | `initialize_game_schedule`, sim | Calendar, daily games, next-game |
| `league_standings` (952) | Per-game standings | sim | Standings, dashboard |
| `game_player_states` (107) | morale/fatigue/is_active/is_injured per game-player (**columns exist; checked: no simulation found that advances fatigue or injuries** — see G) | seeding (+guard on writes) | roster/sim reads |
| `draft_picks` (702) / `game_pick_inventory` (714) | Draft pick definitions and per-game ownership | seed functions (`seed_game_pick_inventory`), `execute_trade_transactional` | trades, pick inventory hook |
| `executed_trades` (725) / `trade_asset_snapshots` (734) | Trade history + asset snapshot at execution | `execute_trade_transactional` | trade history page |
| `free_agency_availability_enrollments` (1983) / `free_agency_pending_offers` (1992) | FA market state per game | `enroll_simulated_free_agents`, `submit_free_agency_offer`, resolution | FA market screen |
| `public.free_agency_imports` (3505) | Initial FA import state | bootstrap route | FA screen |
| `game_roster_releases` (3756) | Released players + salary coverage (035/036) | release action | roster/trades |
| `player_rating_source_versions` (4271) / `player_rating_source_cache` (4281) | 2K ratings provenance + cache | ratings bootstrap | attributes materialization |
| `game_attribute_materializations` (4429) / `game_player_attributes` (4438) | Per-game player attribute snapshots | bootstrap/materialization | roster, trades, sim |
| `game_box_scores` (5218) | Per-game box score rows | possession engine (045) | schedule/day, player stats |
| `postseason_qualifications` (5692), `_play_in_games` (5875), `_playoff_seeds` (5884), `_series` (6062), `_series_games` (6087), `_results` (6096) | Playoff qualification, play-in, seeding, bracket, results | sim functions (049-052) | postseason screen |
| `game_offseasons` (6335), `game_offseason_contracts` (6383), `game_offseason_player_options` (6512) | Offseason entry, expiring contracts, option decisions | offseason RPCs (053-055) | offseason UI |

**Engine functions (SQL):** `possession_random(p_seed, p_draw)` (044:4 — deterministic hash-based), possession engine (044), box scores (045), daily entry `advance_simulation_day` (046, rotation calibration 047), `authenticate/assess_free_agency_offer` + `resolve_free_agency_offer` (026/028), `execute_trade_transactional`, `initialize_game_schedule` (010), `enroll_simulated_free_agents`, qualification/play-in/series builds (049-052), `resolve_offseason_player_options` (055), seed/rollback helpers.

**Missing tables vs. the intended product:** nothing for **draft events/lottery results/selections**, **scouting reports/assignments**, **transactions ledger of non-trade events** (only trades have `executed_trades`), **AI GM strategy state**, **injury/fatigue simulation events**, **season rollover state**. `doc memory` for these exists only in the prototype's JS data files.

**Data-coverage problems in reference data (repository evidence):** modern era has no historical dataset (`isHistoricalDatasetAvailable: false`, `SeasonEra.ts:31`) and depends on a live ESPN/B-Ref/2K refresh at game creation; historical eras use approximate/estimated contracts ("aproximados", `SeasonEra.ts:37`).

---

## F. NBA Data Pipeline

| Integration | Status | Where | Mode | Stored vs on-demand | Notes |
|---|---|---|---|---|---|
| `swar/nba_api` (Python) | Implemented but **manual, one-shot** | `scripts/ingest_data.py` (teams + rosters), `scripts/historical_loader_core.py` (era rosters via `commonTeamRoster`, `historical_loader_core.py:42-46`), seeds `scripts/seed_jordan_rosters.py`, `seed_historical_rosters.py` | Manual run by operator; upserts via Supabase REST (`historical_loader_core.py:71-76`) with deterministic contract tiers and hash-seeded salaries (`historical_loader_core.py:212-226`) | Stored (reference tables) | Covers **2010-11 (LeBron) and 1995-96 (Jordan)**; loader validates rows, chunks, and idempotent upserts |
| hoopshype salaries | Implemented, manual | `scripts/scrape_real_salaries.py` → `https://hoopshype.com/salaries/players/` | One-shot scrape | Stored in `contracts` | No provenance versioning in this script itself |
| ESPN web API | Implemented, **live at game creation** | `src/infrastructure/roster/espnRosterSource.ts:92,99`; `/api/roster-refresh` | On-demand during create-game; staging + promotion | `roster_refresh_*` + canonical promotion (`promote_current_roster`) | Migration 011/012 |
| Basketball-Reference contracts | Implemented | `src/infrastructure/contracts/basketballReferenceContractSource.ts` (`BASE_URL:105`) | Snapshot cache with versioning (`contract_source_snapshot_versions`, `SupabaseContractSnapshotCache`) | Stored + versioned | `dry-run-bref-contracts.ts` for spike |
| **nba2kapi.com** | Implemented | `src/infrastructure/ratings/nba2kRatingsSource.ts` — bulk endpoints `https://api.nba2kapi.com/api/players/bulk?teamType=curr` and per-team lists (`:57-58`) | Bootstrap route `/api/player-attributes/bootstrap` → cache → materialization into game attributes | Cached (`player_rating_source_cache`, migration 037) + materialized (038-040, 042) | Verified test coverage: `nba2kRatingsSource.test.ts`, coverage test |
| Player identity crosswalk | Implemented | `src/domain/playerIdentity`, `src/infrastructure/playerIdentity` (`validatedPlayerIdentityCrosswalk`, used by roster-refresh route) | Mapping table curated + validated | — | Provides consistent IDs across ESPN/B-Ref/2K |
| Provenance | Implemented | `game_contract_provenance` (013/014/017/018), `player_rating_source_versions`, `contract_source_snapshot_versions`, `roster_refresh_runs` | — | — | Best-practice design; live contents unverified |

**Seasons represented:** Modern (2026-27, current-season refresh), LeBron era (2010-11), Jordan era (1995-96) — with explicit "historical dataset availability" flags (`SeasonEra.ts`). Protocol docs (`PLAYER_ATTRIBUTES.md:18`) record a verified source check on 2026-10-22.

**Reliability concerns.** (1) The modern-era path performs **live network fetches during game creation** (ESPN + B-Ref + 2K); any upstream outage/shape change breaks game creation (rollback exists, but availability couples to external sites). (2) Historical-era contracts are approximations by design. (3) The Python ingest and the TS refresh paths are separate write surfaces into the same `contracts`/`players` tables — correct today, but they share immutability guards that require every writer to keep the canonical rules.

---

## G. Gameplay Systems Inventory

| System | Status | Evidence / notes |
|---|---|---|
| Possession-level game simulation | **Implemented and verified (SQL)** | migrations 044-047; deterministic seeded RNG (`possession_random`); box scores (045); rotation calibration based on attributes (047); docs `POSSESSION_ENGINE.md` |
| Season scheduling & game day processing | **Implemented (SQL)** | `initialize_game_schedule` (010), `advance_simulation_day` (046) with expected-date guard |
| Standings | **Implemented** | `league_standings` + `useStandings`; sim-updated |
| Player season statistics | **Implemented** | migration 048 + `useSeasonStatistics` |
| Postseason qualification / play-in / bracket / champion | **Implemented** | migrations 049-052; UI `postseason/page.tsx`; `docs/POSTSEASON.md` acceptance log |
| Trade legality & validation | **Implemented (domain + SQL)** | `TradeValidator.ts` (tested), salary in/out rules, `execute_trade_transactional` (migration 024 serialization guards); draft picks included |
| Free-agent decision logic | **Partial — policy-based, not AI** | offer assessment/counteroffer SQL (025/028 cases: accept/counter/reject evaluated server-side on sim days); it models the **player's** decision, not rival-GM markets |
| Contracts & salary-cap enforcement | **Implemented for core paths** | `SalaryCapCalculator.ts`, contract materialization with immutability guards, FA cap validation in assessment SQL, release salary coverage (036); **not**: off-season extension meltdowns, 2027-28 budgets |
| Offseason entry & options | **Implemented (bounded)** | 053 entry, 054 expirings/team options, 055 player-option policy `salary-comparison-v1` (explicitly "a game simplification, not a real NBA rule") |
| Draft lottery / order / selection | **Not implemented** in app; prototype models exist with tests as node (`draft-lottery-model.js` etc.) + `.cjs` tests, but referenced nowhere in `src/` | `game_pick_inventory` + `draft_picks` are trade assets only |
| Player development / aging | **Not implemented** | roadmap tail: "no envejecimiento"; no progression SQL found |
| Injury & fatigue | **Not implemented (columns only)** | `game_player_states.fatigue/is_injured` exist but no sim writes found; no injury generation anywhere |
| AI-controlled GMs | **Not implemented** | no decision logic found outside FA offer assessment; no strategy tables |
| Team strategies (persistent) | **Not implemented** | — |
| Multi-season progression / rollover | **Not implemented** | advance buttons disabled after champion (`layout-components.tsx:312`, `championConfirmed` at 337-341); roadmap log: offseason mode "does not start 2027-28" |
| Batch sim engine loops | **Implemented** | `useAdvanceRange.ts:48-80` sequential RPCs with stop flag and progress store; potential UX cost: one RPC + 7 invalidations per day (see I) |
| `SeasonSimulator` TS service | **Abandoned experiment** | no production callers |

**Can the architecture support multi-season franchise sim without major restructuring?** Largely yes: the canonical `games` row already carries `season_year`, and the engine is date-driven and guarded in SQL. The required additions are intra-architecture (new SQL phases for draft/season-advance, FA restart, calendar regeneration) rather than rewrites. The biggest structural gap is that **scheduling is only regular-season**: playoff/lottery transitions exist, but a new-season schedule initializer and draft-order producer must be added.

---

## H. Cross-Module Journey Audit

### Journey A — Trade ✅ (through execution; no counterpart AI)
1. Select assets: `trades/page.tsx` — players + `useDraftPickInventory`.
2. Validate: `TradeEngine.simulateTrade` → `TradeValidator.validateTrade` (tested; `tests/application/services/TradeEngine.test.ts`, `tests/domain/services/TradeValidator.test.ts`).
3. Execute: `TradeEngine.executeTrade` → `SupabaseTradeRepository.execute` → RPC `execute_trade_transactional` (`SupabaseTradeRepository.ts:39`) — transactional: rosters, contract copies (immutable-copy enforcement), pick inventory, history (`executed_trades`, `trade_asset_snapshots`).
4. Update UI: invalidations for players/contracts/roster/draft-picks/history (`useTrades.ts:68-79`).
**Break:** none for a human-vs-league trade; the missing link is negotiation/AI counterpart behavior (prototype's negotiation states were never ported and no AI exists).

### Journey B — Free agency ✅ (through contract)
1. Market import/store: initial free agents enrolled (`enroll_simulated_free_agents`, `importInitialFreeAgents`, `/api/free-agency/bootstrap`).
2. Create offer: `useSubmitFreeAgencyOffer` → `submit_free_agency_offer` RPC with cap/write-integrity rules (migrations 020-023; duplicate-offer protections exist here — unlike the prototype's known duplicate-Pending defect).
3. Evaluate response: offers resolved **during simulated days** via `assess_free_agency_offer`/`resolve_free_agency_offer` (026/028) — accept / counteroffer / reject decided by server-side policy; results shown through `useFreeAgencyMarket` snapshots.
4. Signing: contracts materialized into game contract system (022/021), roster/cap updated, availability state advanced.
**Break:** none mechanically. Gaps: expectation/valuation modeling (roadmap: "modelar expectativas de mercado" explicitly pending), and there is no separate signing ceremony step — an accepted offer becomes a contract through the resolution path.

### Journey C — NBA Draft ❌ (stops before it starts)
1. Lottery result: **does not exist** (`postseason_results` contains no lottery event).
2. Pick ownership: exists **only** as seeded trade inventory (`seed_game_pick_inventory`).
3. Start draft: no draft UI or SQL; no prospect pool.
4. Selection/rights: none.
**Last implemented step:** pick ownership as a trade asset. Prototype's five draft screens (incl. deterministic reveal ceremony and night flows) are unrealized in the app.

### Journey D — Advance Day ✅ (through persistence)
1. UI action: sidebar buttons (`layout-components.tsx:336, 372-380`), guarded by the batch store mutex and disabled after champion.
2. Engine: `RPC advance_simulation_day(p_game_id, p_expected_date)` — processes games of the day through the possession engine, updates scores, box scores, standings, season stats, player states/guards, resolves free-agency offers on the sim calendar, and advances `games.simulation_date`.
3. Persistence: everything persists in game-scoped tables; then batch invalidations refresh the shell and pages (`useAdvanceDay.ts:26-36`).
**Break:** none for in-season structure; inherent limits: no injuries/development to process, no off-court events (draft night, deadlines), and the month/season batch performs one RPC per day (performance, see I).

### Journey E — Multi-season progression ❌ (stops at offseason planning)
1. Season completes → champion produced (052).
2. Postseason/offseason UI: champion confirmed, advance disabled (`layout-components.tsx:312, 337`), offseason entry available (`resolve_offseason_player_options` etc.).
3. Offseason records expirings, team options (exercised/rejected), player-option policy, and a **read-only projected roster** (`OffseasonRosterProjection.ts`, `OffseasonContractOutlook.ts`).
4. Draft / new-season schedule / contract renewal → **not implemented**; roadmap explicitly records the absence ("No hay draft, mercado de verano, regeneración de calendarios, envejecimiento… no se inició 2027-28") and lists "modelar expectativas de mercado" as a pending user-requested block.
**Last implemented step:** offseason planning surfaces. **Continuity breaks:** at "start the next season" — no draft between seasons, no new schedule, no budget reset.

---

## I. Confirmed Bugs and Technical Risks

**Verified problems (evidence-cited; severity):**

1. **Broken navigation to Settings — Medium-high UX defect.** Sidebar defines `{ key: "settings", path: "/settings" }` (`src/components/dashboard/layout-components.tsx:99`), but no `settings/` route exists under the dashboard tree; the `[...not-found]` catch-all (`(protected)/games/[gameId]/dashboard/[...not-found]/page.tsx`) swallows the link.
2. **Failing test discovery for prototype `.cjs` files — Low (tooling).** `bun vitest run` exits 1 with 4 "No test suite found" failures for `docs/NBA-Franchise-Management-Redesign/tests/*.test.cjs`. They are node-style scripts, not vitest suites. Fix: exclude `docs/**` in `vitest.config.ts`.
3. **Biome CI would fail — Low.** `bun biome check .` reports 1 formatting error in `.engram/manifest.json` (tool artifact, not source code — should be ignored in `biome.json`).
4. **Dead-code conflict traps — Medium (maintainability).** `team-selector.tsx` pushes `/dashboard` (which redirects to `/`) and has zero importers; `select-team` page redirects to `/games/new`; `src/app/dashboard/**` are redirect stubs; `SeasonSimulator.ts` has no production caller. Any of these getting wired up would dead-end the user.
5. **Career-mode i18n bypass — Medium.** `career/[careerId]/page.tsx` hard-codes English strings in a codebase whose other surfaces are fully en/es localized; also a disjoint state model (`career_saves`) that is hidden in nav, i.e. a half-integrated second game.
6. **Batch simulation cost — Medium (performance).** `useAdvanceRange.ts` issues **one RPC and seven query invalidations per simulated day**; a full season (~170 days) = ~170 sequential round-trips + ~1,190 cache invalidations. Works, but each day awaits invalidation of entire result sets — likely sluggish in practice and prone to timeouts on long hops.
7. **Live network dependency inside game creation — Medium.** `/api/roster-refresh` fetches ESPN and B-Ref outside the app process; an upstream change (no contract, no HTML change tolerance) fails game creation. Rollback exists (`route.ts:37+`), but the coupling is a reliability risk; also the user-agent identifies a GitHub repo (`basketballReferenceContractSource.ts:106`).
8. **No route middleware — Low (design note).** Protection is client `AuthGuard` + server RLS. Correct as long as every RPC/table policy is maintained, but the app-level guard is bypassable by network calls; RLS is the true boundary (verified policies exist for the main tables; full per-table policy review **Unverified**).
9. **`tsconfig.tsbuildinfo` committed — Low (hygiene).** Build artifact present in repo root.
10. **Prototype directory leaks into tooling — Low.** The docs folder includes testable JS + hosted fonts/truetype mislabeled as `.woff2` (plan doc:318) and non-redistributable NBA image credits (plan doc:319).

**Speculative/unverified:** live RLS behavior, deployed migration parity (`scripts/test-*-postgres.ts` indicate a local Postgres runner exists), production Supabase project state, `ui-preview` fonts, performance of the SQL possession engine at scale. All remain **Unknown** without a live database check.

---

## J. UI/UX Consistency Gaps

1. **One-off module implementations vs prototype:** draft, leaders, transactions, scouting, settings absent → users cannot reach the planned league-complete navigation.
2. **Player profile placeholder:** statistics/scouting section partially built (plan doc:208) — placeholder content visible in production surface.
3. **Prototype state bugs don't apply to app but predecessor friction does:** the app duplicates none of the prototype's known defects (e.g., duplicate FA offers were fixed by server-side guards); conversely the app lacks the prototype's polished draft ceremony entirely.
4. **Contract-management asymmetry:** prototype shows extension demos; app implements releases only — roster management depth differs from design intent.
5. **Offseason lives inside the Postseason page** (`postseason/page.tsx` + `OffseasonPanel`) rather than its own destination (plan doc:213) — a deliberate merge, but one that fragment navigators will find unusual vs the prototype's separate module idea.
6. **Career mode is disjoint:** different visual polish (`max-w-3xl` simple page vs the rich game shell), English-only text, hidden navigation.
7. **Settings/family:** no preferences (region/theme/accent) anywhere; theme only auto-applies from selected team (`TeamThemeApplier`).
8. **Prototype-side watch-outs to not port:** the `courtside-ui-audit.md` §D pitfalls (inconsistent roster counts, finances thresholds, filter semantics, dead "offseason continuation" button) should be treated as traps during integration.

---

## K. Recommended Implementation Roadmap

### Phase 0 — Critical fixes and cleanup (**S**)
- Remove/wire Settings link → either build a minimal settings page or drop the nav item; exclude `docs/**` and `.engram/` from Biome and Vitest; delete dead code (`team-selector.tsx`, `select-team/`, `src/app/dashboard/**` after confirming no historic links, `SeasonSimulator`); commit-ignore `tsconfig.tsbuildinfo`; translate Career mode or explicitly hide it.
- **Dependencies:** none. **Acceptance:** `bun test`, `bun biome`, `tsc` all green; nav has no dead destination.
- **Reuse from OpenDesign:** the settings dialog concept (accent editor) — as a later feature, not now.

### Phase 1 — Shared shell & canonical state (**S/M**)
- Extend the dashboard shell so the sidebar/header expose game context for every game-scoped route (already largely true; finish league layout tabs if needed), wire a global "advance" UX into one place, and add a leaders + transactions page shell fed by existing tables (`player box-score season stats`, `executed_trades`).
- **Dependencies:** Phase 0. **Acceptance:** navigable league module with leaders/transactions reading real data; no `[...not-found]` traps.
- **Reuse:** prototype league hub/leaders/transactions presentation; layout from `courtside-ui-migration-plan.md` design keys.

### Phase 2 — Data model & Supabase integration (**M/L**)
- Add draft tables (lottery results, order, selections) and scouting tables (reports, assignments), migrate rollover bookkeeping (`season_rollover`/next-season initialization), document per-table RLS and guards; establish migration 057+ as the draft/season-advance package with rollback tests like all other migrations.
- **Dependencies:** Phase 0-1. **Acceptance:** local Postgres runner tests (pattern: `scripts/test-*-postgres.ts`) for new RPCs; schema.sql keeps a canonical copy.
- **Reuse:** the existing migration discipline, guarded-write patterns, provenance tables.

### Phase 3 — Functional management workflows (**L**)
- Integrate the Trade Center negotiation depth (counter offers, AI availability) — or explicitly decide human-instant-trades — plus contract extensions (prototype flow), a scouting module fed by the 2K attributes already materialized, and expanded free-agency states (offer aspiration model pending per roadmap).
- **Dependencies:** Phase 2 (draft tables for pick provisioning, trades already work).
- **Acceptance:** each workflow persists and survives reload; FA/trade journeys H-A/H-B complete; extension journey complete.
- **Reuse:** prototype trade/FA/roster interaction patterns + integrations done in D matrix.

### Phase 4 — Simulation engine & AI GMs (**XL**)
- Draft engine (lottery with seeded RNG consistent with `possession_random` pattern, order generation, selection flow), injuries/development writing into `game_player_states`, new-season schedule regeneration, budget/year rollover, and first-cut AI GM decision policies (persisted strategy per team: veteran pivot, rebuild, cap priority) consumed by trade/FA evaluation paths.
- **Dependencies:** Phases 2-3. **Acceptance:** draft journey H-C executes to persistence; next season schedule initializes; AI states persist per season.
- **Reuse:** prototype lottery/order/night JS models as spec + test cases; prototype Draft Night UI.

### Phase 5 — Multi-season progression & polish (**L/XL**)
- Season end → offseason → draft → FA → new-season rollover pipeline; replace `championConfirmed` disable with a "Begin offseason → next season" flow; multi-season statistics/history; final UI polish round against the design system (Tokens from plan doc §5).
- **Dependencies:** Phase 4. **Acceptance:** Journey E completes across years with history visible; roadmap item "modelar expectativas de mercado" resolved.
- **Reuse:** offseason ledger UI, MVP/career archive patterns from careers mode.

---

## L. Immediate Next 10 Tasks

1. **Fix the tests/biome gates** — exclude `docs/**` and `.engram/` from Vitest/Biome config; delete or move prototype `.cjs` tests. (S)
2. **Restore or remove the Settings nav link** — build a minimal `/settings` page (bilingual) or drop the item. (S)
3. **Delete dead code** — `team-selector.tsx`, `select-team/`, `src/app/dashboard/**`, `SeasonSimulator.ts` (+ its test reference), and any imports I missed along the way. (S)
4. **Ship League Leaders page** — query `game_box_scores`/season-statistics aggregates; port prototype ranking UI (`players.html#view=leaders`) — FG/FT% become available because data exists now. (M)
5. **Ship Transactions page** — read `executed_trades`/`trade_asset_snapshots` (+ later FA/responses as required); prototype transactions shell is the reference. (M)
6. **Optimize batch sim** — move invalidation to on-final-day (or interval), or implement a single SQL loop RPC for N days to cut round-trips. (M)
7. **Make game creation resilient** — preflight/skip live B-Ref refresh when cached snapshots exist, degrade gracefully, and keep the attribute bootstrap independent so a B-Ref outage doesn't block play. (M)
8. **Build Draft data model + lottery/order SQL** with rollback tests (migration 057+), deriving seeds deterministically (reuse `possession_random` pattern) and pick inventory from existing `game_pick_inventory`. (L)
9. **Build Draft UI trio (Hub/Board/Lottery) in the game shell** reading new tables; port prototype lottery ceremony + draft board structure first, Night last. (L)
10. **Implement season rollover contract** — `begin_next_season(game_id)` SQL: carry contracts, generate new `scheduled_games`, reset `season_year`/`simulation_date`, apply development deltas behind a flag. (L/XL)

---

## M. Open Questions and Unverified Areas

1. **Live database parity** — 42 public tables are present and RLS is enabled on each; aggregate counts were checked for core tables. The MCP migration registry reports only two timestamped migrations, while the repository has 56 numbered migration files. Reconcile how migrations were applied/tracked; per-user RLS behavior under separate authenticated sessions and production data coverage per era remain unverified.
2. **SQL engine runtime characteristics** — possession-engine cost per simulated day at full league load; batch sim of a season measured. (Needs a sandbox DB.)
3. **Supabase Auth email configuration** (SMTP provider, verified templates) — referenced in recovery route but envoide runtime details unverifiable from repo.
4. **Upstream API stability contracts** — ESPN/B-Ref/2K response-shape testing exists in tests (fixtures) but no monitoring for shape drift in production.
5. **Whether the user's personal remote game** (roadmap acceptance notes) still matches the current local schema (user confirmed installs of 049-056 manually, per roadmap log).
6. **Whether Career mode should continue** as a mode at all — currently hidden and English-only; product decision needed.
7. **Accessibility of prototype-derived screens** once ported (prototype audit explicitly skipped deep a11y/contrast).
8. **Font licensing posture** for redistribution (plan doc:312-322; OFL retained, NBA images restricted).

---

## Live Supabase Verification Addendum (2026-11-02)

**Scope:** Read-only Supabase MCP calls: list migrations, list public tables/columns, list extensions, security/performance advisors, and aggregate `COUNT(*)` queries. No migration, write, seed, function execution, user-level access test, or gameplay action was performed. This addendum supersedes the earlier "live database unknown" qualification above, but does not claim a full RLS penetration test.

### Deployed schema, data, and migration tracking

- `list_tables` reports **42 public tables**, matching the table set in `scripts/schema.sql`; **RLS is enabled on all 42**.
- Exact aggregate counts (no row-level user data retrieved): `teams` 30; `players` 1,554; `contracts` 13,625; `games` 43; `game_player_states` 20,866; `scheduled_games` 19,234; `league_standings` 660; `game_pick_inventory` 16,800; `executed_trades` 0; `free_agency_pending_offers` 247; `game_box_scores` 949; `postseason_results` 1; `game_offseasons` 1.
- `list_migrations` returns only `20260206190001 initial_schema` and `20260206190014 enable_rls`. This is **not evidence that the other schema objects are absent**: the live table inventory and aggregate counts prove a much richer schema is deployed. It does mean the Supabase migration registry does not reflect the repository's 56 numbered files as currently named/tracked; determine whether migrations were applied manually or via another pipeline before relying on migration history.
- Notable difference from the initial table-list summary: its reported row estimates showed `teams`/`contracts` as zero, but explicit read-only `COUNT(*)` returned 30 and 13,625 respectively. Use the explicit counts above; do not rely on the list-table row estimates.

### Live security-advisor findings (require review; no remediation applied)

- **RLS enabled with no policy: 7 tables** — `contract_source_snapshot_versions`, `current_contract_source_snapshots`, `free_agency_availability_enrollments`, `player_rating_source_cache`, `player_rating_source_versions`, `roster_refresh_runs`, `roster_refresh_staging`. With RLS enabled and no policy, normal `anon`/`authenticated` access is denied; this may be intentional for service-role-only ingestion/support tables. Confirm their intended clients and service-role use.
- **GraphQL schema exposure warnings:** 14 objects visible to the `anon` role and 36 to `authenticated` through SELECT grants. This signals schema discoverability/grants, **not by itself proof that rows can be read**: RLS still gates row visibility. Review public data tables versus game/user-owned tables and the `pg_graphql` API exposure contract.
- **SECURITY DEFINER execute grants:** the advisor reports 5 SECURITY DEFINER functions callable by `anon` and 17 by `authenticated`. Live catalog checks confirmed that the `anon`-callable `initialize_game_schedule`, `seed_game_data`, and `seed_game_pick_inventory` definitions include `auth.uid()` plus user/game ownership checks; the other two reported functions are trigger helpers. The same checks found core gameplay mutations (`advance_simulation_day`, `execute_trade_transactional`, `submit_free_agency_offer`) are not executable by `anon`, and are callable by authenticated users. The three seed/schedule helper grants still differ from repository `REVOKE ... FROM PUBLIC; GRANT ... TO authenticated` expectations and merit ACL cleanup/reconciliation, even though their verified owner guards reduce the immediate cross-user risk. No RPC was invoked to test access.
- **Auth hardening:** Advisor reports leaked-password protection disabled.

### Live performance-advisor findings

- 51 foreign keys without covering indexes; 39 RLS policies with auth/current-setting evaluation that may be re-run per row; 13 unused indexes; one duplicate index on `game_player_states`; one staging table (`roster_refresh_staging`) without a primary key; and 4 multiple-permissive-policy warnings on `contracts`, `players`, and `teams`.
- These are advisor signals, not measured production latency. Review query patterns, write/index tradeoffs, RLS policy semantics, and staging-table lifecycle before any database changes.

**Verification boundary:** aggregate row counts and catalog/advisor metadata were read. Actual access behavior using an anonymous token and two distinct authenticated users, correctness of every deployed function body/ACL, and production latency were not exercised. No secrets, keys, game names, or user identifiers are included in this report.

## Final Summary (the six questions)

1. **How much of the OpenDesign UI is integrated?** Roughly the franchise core: dashboard, schedule/calendar, roster, standings, teams, players, player profiles, trades, free agency, postseason(+offseason), and the game-management shell — ~10 of ~18 prototype modules at High fidelity against supabase data. **Not integrated:** the entire Draft module (5 screens), Scouting, League Leaders, Transactions, Settings, roster rotation editing, and extension negotiation.
2. **What can the user genuinely do today?** Sign in, create a persistent franchise across three eras with real data, advance simulated days/months/season through a real SQL engine producing box scores/standings/stats, browse the league and player data, make CBA-validated trades and signings in a persistent free-agency market, watch the postseason resolve to a champion, record offseason contract/options decisions, and release players. They **cannot** run the draft, scout as a module, see leaders/transactions, or continue into season 2.
3. **Is Supabase operational?** Yes — deep, transactional SQL integration is the core of the app. Live MCP verification confirms 42 public tables with RLS enabled and active franchise data. However, migration tracking is unreconciled (2 MCP migration entries vs. 56 numbered repo files), and Advisor flags RLS/policy/ACL items requiring review. The app-side wiring is heavily tested in-repo.
4. **Is there a canonical persistent franchise state?** Yes — the `games` row is the single authoritative root (selected team, season/era, simulation date, status), observed by every module through core queries; guards + postconditions prevent out-of-band writes. The one canonical-state exception is Career mode, which uses a separate `career_saves` model.
5. **The most important architectural blocker?** Not the shell or the data layer — the **absence of the draft and the season-rollover contract** (migrations 057+, SQL + UI) which is the single edge sealing the loop between postseason and the next season. Everything else in the E journey already exists.
6. **Next implementation priority:** Phase 0 cleanup + Phase 1 leaders/transactions (fast wins restoring complete navigation), then the **draft data model + season rollover SQL** because it unlocks Journey C/E, followed by the draft UI and the AI-GM/expectations work that phase 4 requires. This ordering mirrors the roadmap's own pending blocks ("no draft, no rollover…") and gets the product from "stable well-connected sandbox" to "continuous multi-season franchise simulation".
