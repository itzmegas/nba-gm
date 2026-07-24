# Exploration: traspasos (Trade Machine page)

Change name (user-supplied): `crear la pagina de traspasos, tengo un ejemplo https://fanspo.com/nba/trade-machine`
Reference product: https://fanspo.com/nba/trade-machine
Review budget: 400 changed lines. Delivery: ask-always on risk.

## TL;DR

The trade engine, validator, salary-cap math, and re-assign contract flow are already implemented in the domain and application layers. The sidebar at `src/components/dashboard/layout-components.tsx:61` already routes "Traspasos" to `/games/[gameId]/dashboard/trades`, but **no page exists at that path** — clicking it 404s. The change is therefore a presentation-layer work unit: build the trade machine page on top of the existing `useSimulateTrade` / `useExecuteTrade` hooks and `useTradeStore`, with the player picker, salary diff, and validation feedback as the only new UI. **No new domain logic, no schema migration, no new dependency.**

## Current State

### What already exists (verified by codegraph + Read)

| Layer | File | Status |
| --- | --- | --- |
| Domain entity | `src/domain/entities/Trade.ts` | Defines `TradeAsset`, `TradePackage` (with `outgoingAssets[]`), `TradeValidationResult`, `TeamTradeDetails` |
| Domain service | `src/domain/services/TradeValidator.ts` | Full salary matching (NON_TAXPAYER_LOW/MID/HIGH, TAXPAYER, SECOND_APRON), roster size, hard-cap checks. ~200 lines, well-typed. |
| Domain service | `src/domain/services/SalaryCapCalculator.ts` | `getFinancialStatus()` already returns `apronStatus: "None" \| "First" \| "Second"` and `taxBill` |
| Domain service | `src/domain/services/RosterValidator.ts` | In-season 12–15 / off-season 21 limit (tested in `tests/domain/services/RosterValidator.test.ts`) |
| Domain constants | `src/domain/constants/nba-rules.ts` | Cap $140.588M, Luxury $170.814M, First Apron $178.132M, Second Apron $188.931M, three matching tiers |
| Domain error types | `src/domain/errors/` | `HardCapError`, `RosterSizeError`, `SalaryMatchingError` |
| Application service | `src/application/services/TradeEngine.ts` | `simulateTrade()` (sync) + `executeTrade()` (writes `contracts.team_id`) — note: **no transaction wrapping** (each `update` is its own Supabase call) |
| Application hooks | `src/application/hooks/trades/useTrades.ts` | `useSimulateTrade` (TanStack Query) + `useExecuteTrade` (mutation) — already wired with proper query invalidation |
| Application store | `src/application/stores/useTradeStore.ts` | Zustand store with two-team packages. **WARNING: shape mismatch** — its `TradePackage` uses `playerIds[]/contracts[]/cashConsiderations/draftPicks[]`, **not** the domain's `outgoingAssets[]`. This store is effectively dead code relative to `useSimulateTrade` / `TradeEngine`. |
| Infrastructure | `src/infrastructure/repositories/SupabaseContractRepository.ts` | Has `update(gameId, id, { teamId })` — sufficient to re-assign players. No transaction. |
| UI primitive | `src/components/roster/roster-table.tsx` | Reusable RosterTable (headshot, salary Y1/Y2, contract status, click-to-player page) |
| UI pattern | `src/app/(protected)/games/[gameId]/dashboard/league/page.tsx` | Existing read-only roster browser with team picker + player search; useful reference |
| UI shell | `src/components/dashboard/layout-components.tsx:61` | Sidebar `NAV_ITEMS` already has `{ label: "Traspasos", path: "/trades", icon: ArrowLeftRight }` — route **target missing** |
| Demo (Python) | `scripts/demo_trade_machine.py` | Pre-2010 reference script with hard-coded Lakers vs Warriors and 125% rule. Not wired to UI. |

### Inconsistencies to handle in the proposal

1. **`useTradeStore` (Zustand) shape vs domain `TradePackage`** — they do not match. The store's `TradePackage` (legacy) has `playerIds[]`, `contracts[]`, `cashConsiderations`, `draftPicks[]`. The domain `TradePackage` (used by `useSimulateTrade` / `TradeEngine`) has `outgoingAssets: TradeAsset[]` where each asset has `type: "player" | "pick" | "cash"`. The Zustand store is therefore incompatible with the engine. **Either**: (a) build the page using local component state and a thin wrapper that adapts to the domain shape; (b) refactor `useTradeStore` to mirror the domain shape. (a) is the ponytail choice (no editor, no reviewer friction).
2. **No transaction in `TradeEngine.executeTrade`** — N+1 partial-failure window if Supabase fails mid-trade. Out of scope for the page, but flag for a future hardening change.
3. **`useRoster` excludes players without a `Contract` row** — traded players always need a contract, so this is fine, but the trade page must handle the rare "no-contract player" case (filter on the picker, or surface a soft warning).
4. **Picks not modeled** — there is no `draft_picks` table in the schema (grepped `scripts/schema.sql` for `trade|pick` — no matches). The Fanspo product supports picks; **out of MVP scope** because the schema does not model them yet.

### Reference product (Fanspo) feature mapping

| Fanspo feature | MVP? | Notes |
| --- | --- | --- |
| Season selector | **Skip** for MVP — the game already has a season year in `useGame`. Use the active season. |
| 2–5 teams | **MVP = 2 teams** (the engine and validator are hard-coded for two packages). Multi-team is a future change. |
| Trade players | **MVP** | Reuse `useRoster` for both sides. |
| Draft picks | **Skip** | No `draft_picks` table; schema change is its own change. |
| Modify contracts | **Skip** | Out of scope. |
| Sign free agents | **Skip** | Out of scope. |
| View payroll / Financial Breakdown | **MVP** | Reuse `SalaryCapCalculator.getFinancialStatus()`. |
| Adjust trade rules | **Skip** | Rules are constants; not user-configurable yet. |
| Try Trade / Reset / Share | **MVP subset** — Try Trade (calls `useSimulateTrade`), Reset (clears state). Share out of scope. |
| Trending players | **Skip** | No data source. |
| Validation feedback (errors + warnings) | **MVP** | `TradeValidationResult.errors[]` and `.warnings[]` are already typed. |

## Affected Areas

| Path | Layer | Why it is affected |
| --- | --- | --- |
| `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` (new) | Presentation | The actual page the sidebar already links to. Server vs client: must be `"use client"` (TanStack Query + local UI state). |
| `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` (new) components in same file or under `src/components/trades/` | Presentation | Subcomponents: `TeamTradeColumn`, `PlayerPicker`, `TradeValidationPanel`, `SalarySummary` |
| `src/application/stores/useTradeStore.ts` | Application | Likely **left untouched** for MVP. Page uses local `useState` for `teamA/teamB` packages. If proposal opts to refactor, scope creeps. |
| `src/application/hooks/trades/useTrades.ts` | Application | Reused as-is. `useSimulateTrade` already returns the right shape. |
| `src/application/services/TradeEngine.ts` | Application | Reused as-is. |
| `src/components/dashboard/layout-components.tsx` | Presentation | **Untouched** — the link is already there. |
| `openspec/specs/` | Spec | If a new capability is created, e.g. `trades/spec.md`. Optional: add scenarios under an existing capability. |

## Approaches

### Approach A — Two-column page on local state (recommended)

A single new file `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` that:

- Renders two columns (Team A on the left, Team B on the right) with a Select for team choice (or auto-picks `game.selectedTeamId` as Team A).
- Each column lists the team's players via `useRoster` and exposes an "add to trade" button. Toggling a player pushes/pops a `TradeAsset` (player-type) into a local `useState<TradePackage[]>`.
- A center "Try Trade" button calls `useSimulateTrade` and renders the `TradeValidationResult` (errors as `AlertDialog` / `Alert`, warnings as muted list, salary deltas in `Card`).
- A "Execute Trade" button calls `useExecuteTrade` and on success refreshes the rosters (already handled by the mutation's `onSuccess` invalidation list).
- A salary summary card per team (uses `SalaryCapCalculator.getFinancialStatus()` of the *projected* post-trade contracts — computed in-page from current contracts minus outgoing plus incoming).
- A "Reset" button clears the local state.

No new files outside the page. Subcomponents may live in the same file or be co-located under `src/components/trades/` if they exceed ~80 lines each.

- **Pros**: smallest possible diff; reuses every existing primitive; respects all layer boundaries; reviewable inside the 400-line budget.
- **Cons**: a single fat page file (300–400 lines) if subcomponents are co-located; local state lost on navigation (mitigation: not needed for a GM's session, and `useTradeStore` is available later if persistence is requested).
- **Effort**: Low.

### Approach B — Extract presentational subcomponents under `src/components/trades/`

Same as A, but with subcomponents split: `TeamTradeColumn`, `PlayerPicker`, `TradeValidationPanel`, `SalarySummaryCard`, `TradeActionBar`. Each ~50–100 lines.

- **Pros**: cleaner page file; easier unit-testable in isolation if tests are added later.
- **Cons**: 5 new files + the page = 6 files; review budget tightens; ponytail says one file is fine until a subcomponent needs its own reason to exist.
- **Effort**: Low–Medium.

### Approach C — Refactor `useTradeStore` to align with domain `TradePackage`

Make the Zustand store the source of truth, shape-aligned with `TradePackage { outgoingAssets }`. Use selectors to derive per-team packages.

- **Pros**: clean state model, ready for persistence (e.g. "save proposed trade" was a stub).
- **Cons**: changes a working (even if orphaned) file; widens the diff to ~500 lines; risks regressions in a part of the codebase that is not on the critical path for this change.
- **Effort**: Medium. **Not recommended** — separate change if it ever becomes valuable.

## Recommendation

**Approach A.** Build a single client page at `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx`, ~300 lines, that wires the existing `useSimulateTrade` / `useExecuteTrade` to two roster pickers and a validation panel. No new files in domain, application, or infrastructure. No new dependency. If, during apply, the page file exceeds ~400 lines, fall back to Approach B for one or two subcomponents — but start with A.

- Two-team only (the engine and validator are two-team today).
- Players only (no `draft_picks` schema, no cash considerations UI).
- Use the game's current `seasonYear`; no separate season selector.
- Show validation errors and warnings verbatim from `TradeValidationResult`.
- Disable the "Execute Trade" button while `useSimulateTrade` is loading or `result.isValid === false`.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `useTradeStore` shape mismatch confuses a future reader | Low | Add a one-line `ponytail:` comment in the page noting the engine's expected shape; do not touch the store. |
| `TradeEngine.executeTrade` is not transactional | Medium | Document in the page's confirmation dialog: "If something fails partway, run Reset and re-try." Real fix is a separate change. |
| Page exceeds the 400-line review budget | Low–Medium | Keep logic thin; derive post-trade financials inline with `SalaryCapCalculator`; if a subcomponent grows past ~80 lines, split it (Approach B) within the same PR. |
| `useRoster` excludes no-contract players | Low | Filter the picker on "has a contract" silently. Players without a contract cannot be traded anyway. |
| Sidebar link already exists but page 404s until shipped | High (today) | The change closes this; the next dev clicking "Traspasos" must not hit a 404. |

## Edge cases the implementation must handle

- Team A === Team B (same team selected on both sides) — disable "Execute Trade".
- A team has zero players with contracts (e.g. new save) — show an empty state per column.
- A team has more than 15 players (off-season) — allow picker to show all; validator handles the in-season limit.
- Player on Team A's roster is also on Team B's pick list (should not be possible unless data is wrong) — guard with a simple Set check.
- Validation produces both errors and warnings — render errors blocking, warnings as a muted list.
- A user clicks "Try Trade" then edits a pick list — re-runs the query automatically (TanStack Query's `queryKey` already includes the package contents).

## Non-goals (explicit)

- Multi-team trades (3–5 teams, like Fanspo).
- Draft picks and cash considerations in the UI.
- Per-rule user settings (the constants are not yet user-tunable).
- Share / "Explain Yourself" / community vote.
- Free agent signings or contract modifications.
- Transactional `executeTrade` (deferred to a separate hardening change).
- Refactoring `useTradeStore` to align with the domain `TradePackage`.
- New SQL migrations, new RLS policies, new repository methods.
- Tests beyond the existing `RosterValidator.test.ts`; the trade page is presentation logic on already-tested primitives. **One small Vitest check** covering the page's local "build outgoingAssets from toggled set" helper, since that is the only piece of non-trivial logic the page owns. Per project testing protocol: Biome `bun biome check` is the floor; this is the single allowed self-check (ponytail: trivial logic needs no test, the one-shot helper does).

## Open product questions (to confirm before / during apply)

1. Should the page also be reachable from the GM's selected team only, or accept any two teams in the league? Default assumption: any two teams in the league; Team A is prefilled with `game.selectedTeamId`.
2. Should "Execute Trade" be gated by an "Are you sure?" confirmation? Default assumption: yes, a one-step confirmation via shadcn `AlertDialog` (already imported and used in `games/new` and the new-game flow per `c2bc553 feat: added menu to logout` and `3a81f75 change: add dialog before delete a game`).
3. Should the "Trending players" widget be considered at all? Default: no, no data source.
4. Is the missing `/trades` page considered P0 (i.e. expected by an existing user) or P1 (cosmetic)? Clicking the sidebar item 404s today, so likely P1–P0.

## Ready for Proposal

**Yes** — Approach A. The proposal should declare:
- No new domain, application, or infrastructure code.
- No new dependency, no new migration.
- One new page file + optional one or two co-located subcomponent files.
- Stays inside the 400-line review budget.
- Rollback is `git revert` of the new page file — no other surface changes.

Suggested next command after user approval: `/opsx-new traspasos` (or whatever the project uses for proposal) to generate `proposal.md` from this exploration.
