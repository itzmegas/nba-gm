# Design: Two-Team Trade Machine Page

## Technical Approach

One new client page at `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` (~300 lines) and one focused Vitest check at `tests/app/trades/buildPackage.test.ts` (~30 lines). The page wires existing domain/application hooks to two roster columns and a validation panel. No new domain, application, infrastructure, or dependency code. Local `useState` holds the two package shapes because the legacy `useTradeStore` shape is incompatible with the engine's domain `TradePackage`.

## Architecture Decisions

### Decision 1: Local state over Zustand store

**Choice**: Page-local `useState` for Team A/B selected players, adapted to domain `TradePackage` at the hook boundary.

**Alternatives considered**:
- Refactor `useTradeStore` to match domain `TradePackage` → widens diff, touches unrelated code, risks regressions.
- Adopt a new Zustand slice → over-engineering for a single page; two `useState<Set<string>>` (player IDs) are 4 lines.

**Rationale**: The legacy store uses `playerIds[] / contracts[] / cashConsiderations / draftPicks[]`. The engine expects `TradePackage { teamId, teamName, outgoingAssets: TradeAsset[] }`. The adapter is ~8 lines in the page — far cheaper than refactoring the store. The page is the only consumer of this state; persistence is not an MVP requirement.

### Decision 2: Single file page over subcomponent extraction

**Choice**: All UI lives in one file. Extract subcomponents only if the file exceeds 400 lines during implementation.

**Alternatives considered**:
- Pre-extract `TeamTradeColumn`, `PlayerPicker`, `TradeValidationPanel`, `SalarySummaryCard`, `TradeActionBar` into `src/components/trades/` → 5 new files; review budget tightens; premature abstraction.

**Rationale**: Each column is ~60 lines, the validation panel ~40 lines, the action bar ~30 lines. Co-locating them in the page keeps the diff in one place and fits the 400-line budget. If any section grows past ~80 lines during apply, extract it — but don't guess upfront.

### Decision 3: Team A prefilled with `game.selectedTeamId`, Team B free choice

**Choice**: Team A defaults to the GM's team (from `useGame`). Team B starts unselected. The user picks both from the full `useTeams()` list with native `<select>` elements. No swap mechanism — the user changes either selector directly.

**Alternatives considered**:
- Both teams free choice → extra click for every trade; GM's team is the natural starting point.
- Swap button → not part of the approved MVP scope; users can change the selectors directly.

**Rationale**: Match Fanspo's "Your Team" / "Other Team" mental model. `game.selectedTeamId` is already available from `useGame`. Avoids scope creep from the Swap feature.

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  page.tsx (client)                                              │
│                                                                  │
│  useGame(gameId)                                                 │
│    → data: Game (selectedTeamId, seasonYear)                    │
│    → isLoading: show loading skeleton                            │
│    → isError / data=null: show "Game not found" unavailable state │
│                                                                  │
│  useTeams() ───────→ full team list for both selectors          │
│                                                                  │
│  useRoster(gameId, teamAId) ──→ RosterPlayer[] (Team A column)  │
│  useRoster(gameId, teamBId) ──→ RosterPlayer[] (Team B column)  │
│                                                                  │
│  Extract Contract[] from roster (both sides):                    │
│    contractsA = rosterA.filter(rp => rp.contract).map(rp => rp.contract!)
│    contractsB = rosterB.filter(rp => rp.contract).map(rp => rp.contract!)
│                                                                  │
│  Local state:                                                    │
│    [teamAId, setTeamAId] = useState(game.selectedTeamId)        │
│    [teamBId, setTeamBId] = useState(null)                       │
│    [selectedA, setSelectedA] = useState<Set<string>>(new Set()) │
│    [selectedB, setSelectedB] = useState<Set<string>>(new Set()) │
│                                                                  │
│  Adapter (inline, ~8 lines):                                    │
│    buildPackage(teamId, teamName, selectedSet, roster)          │
│      → TradePackage { teamId, teamName, outgoingAssets }        │
│                                                                  │
│  useSimulateTrade(gameId, contractsA, contractsB, pkgA, pkgB)   │
│    → { data: TradeValidationResult, isError, error, refetch }    │
│                                                                  │
│  useExecuteTrade()                                               │
│    → mutation.mutate({ gameId, contractsA, contractsB, pkgA, pkgB })
│    → onSuccess: invalidates contracts + roster queries           │
│      AND removes stale simulation query:                         │
│      queryClient.removeQueries({ queryKey: ["games", gameId, "trade-simulation"] })
│                                                                  │
│  On execute success: clear local state + clear simulation cache  │
└──────────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` | Create | Client page: two-column layout, team selectors, player toggles, salary summary, validation panel, Try/Execute/Reset actions. ~300 lines. |
| `tests/app/trades/buildPackage.test.ts` | Create | One Vitest unit test: `buildPackage()` adapter correctness. ~30 lines. |

No other files are created, modified, or deleted. Combined diff within 400-line budget.

## Interfaces / Contracts

No new interfaces. All types are consumed from the existing domain layer:

```typescript
// Domain types consumed (no new definitions)
import type { TradeAsset, TradePackage, TradeValidationResult } from "@/domain/entities/Trade";
import type { Contract } from "@/domain/entities/Contract";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";

// Local state shape (not exported)
type PlayerId = string;

// Adapter: builds domain TradePackage from local toggle set
function buildPackage(
  teamId: string,
  teamName: string,
  selectedIds: Set<PlayerId>,
  roster: RosterPlayer[]
): TradePackage {
  return {
    teamId,
    teamName,
    outgoingAssets: roster
      .filter((rp) => rp.contract && selectedIds.has(rp.player.id))
      .map((rp) => ({
        type: "player" as const,
        player: rp.player,
        contract: rp.contract!,
      })),
    incomingAssets: [], // ponytail: engine fills this; unused in outgoing packages
  };
}

// Contract extraction for useSimulateTrade / useExecuteTrade
// ponytail: roster already has contracts attached; filter away nulls inline
function extractContracts(roster: RosterPlayer[]): Contract[] {
  return roster.filter((rp) => rp.contract !== null).map((rp) => rp.contract!);
}
```

## Validation and Execution State Transitions

```
                  ┌──→ SIMULATION_ERROR (show error + retry)
                  │
IDLE ──→ TRY_TRADE_LOADING ──→ RESULT_VALID ──→ EXECUTING ──→ EXECUTED (reset + clear sim cache)
  │                              │                   │
  │                              ├──→ RESULT_INVALID │
  │                              │       (show errors)│
  └──────────────────────────────┘                   │
                                                     └──→ EXECUTION_FAILED
                                                          (show error, allow retry)
```

- `IDLE`: No simulation has been run since last selection change. Shows pre-simulation salary totals from local selection. Execute disabled.
- `TRY_TRADE_LOADING`: `useSimulateTrade` query is fetching. Disable Try Trade and Execute. Show loading indicator. Keep Reset enabled.
- `RESULT_VALID`: `result.isValid === true` && `teamAId !== teamBId`. Enable Execute. Show warnings.
- `RESULT_INVALID`: `result.isValid === false`. Disable Execute. Render errors and warnings. Both teams' financial details (incoming salary, salary delta, over-cap, over-hard-cap) from `details.teamA` / `details.teamB` are shown alongside errors so the user understands why validation failed.
- `SIMULATION_ERROR`: `useSimulateTrade.isError` is true (network error, Supabase error, etc.). Show the error message from `useSimulateTrade.error`. Render a Retry button that calls `useSimulateTrade.refetch()`. Execute is disabled. Local state preserved.
- `EXECUTING`: `useExecuteTrade` mutation is pending. Disable Try, Execute, Reset, and both team selectors.
- `EXECUTED`: Clear local player selections (`selectedA`, `selectedB` to empty sets). Remove stale simulation query from cache with `queryClient.removeQueries({ queryKey: ["games", gameId, "trade-simulation"] })`. Rosters refresh via existing query invalidation in `useExecuteTrade.onSuccess`.
- `EXECUTION_FAILED`: Show `mutation.error` message as a destructive alert. Re-enable all controls. Local state preserved for retry.
- Same-team guard (`teamAId === teamBId`): disable Try Trade and Execute before the query fires. `useSimulateTrade.enabled` already requires `contracts.length > 0` for both sides.

## UI Composition

```
┌─────────────────────────────────────────────────────────────────────┐
│  Traspasos  ·  Season 2025-26                         [Reset]      │
├──────────────────────────┬──────────────────────────────────────────┤
│  Team A: [Select ▼]      │  Team B: [Select ▼]                      │
│                          │                                           │
│  ┌─ Roster ────────────┐ │  ┌─ Roster ─────────────────────────────┐│
│  │ ☑ LeBron James  $48M│ │  │ ☐ Stephen Curry  $52M                ││
│  │ ☐ Anthony Davis $43M│ │  │ ☑ Draymond Green  $24M               ││
│  │ ☑ D'Angelo     $17M│ │  │ ☐ Jonathan Kuminga $7M                ││
│  │ ... more players    │ │  │ ... more players                      ││
│  └─────────────────────┘ │  └──────────────────────────────────────┘│
│                          │                                           │
│  ── Package Summary ─── │  ── Package Summary ─────────────────────│
│  Outgoing:    $65,000,000│  Outgoing:    $24,000,000                 │
│  Incoming:    $24,000,000│  Incoming:    $65,000,000                 │
│  Delta:      -$41,000,000│  Delta:      +$41,000,000                 │
│  Roster after:       13  │  Roster after:        15                  │
│  Over cap:           No  │  Over cap:           No                  │
│  Over hard cap:      No  │  Over hard cap:      No                  │
├──────────────────────────┴──────────────────────────────────────────┤
│  ┌─ Validation ────────────────────────────────────────────────────┐│
│  │ ✅ Salary matching valid                                         ││
│  │ ⚠️ Warriors roster at 15 players (close to limit)                ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  [Try Trade]  [Execute Trade]  ← buttons disabled per state table    │
└──────────────────────────────────────────────────────────────────────┘
```

Key UI decisions:

- **Active season display**: `game.seasonYear` rendered as "Season 2025-26" in the page header (Requirement 1).
- **Loading state**: when `useGame.isLoading` or `useTeams.isLoading`, render a centered spinner/skeleton. No trade actions are available.
- **Unavailable state**: when `useGame.data` is null or `useGame.isError`, render a centered message ("Game not found" or "Game data unavailable") with no trade controls (Requirement 1).
- **Team selector**: native `<select>` using `<option>` from `useTeams()`. Exclude the opposite team's selected value to prevent same-team selection.
- **Player list**: rendered from `useRoster()`, filtered to players with contracts only (`rp.contract !== null`). Empty roster state: "No eligible players on this roster" when the filtered list is empty.
- **Package summary per column**: before simulation, shows outgoing salary computed inline from selected contracts (sum of `contract.salaryY1`). After simulation, also shows incoming salary, salary delta, roster size after, over-cap status, and over-hard-cap status from `result.details.teamA` / `result.details.teamB` (Requirement 6).
- **Empty package state**: when a team is selected but no players are toggled, the package summary shows "No outgoing players selected" (Requirement 9).
- **Validation panel**: between the two columns and the action bar. Errors rendered as `<Alert variant="destructive">`. Warnings as `<Alert>` with muted styling. Only shown when `useSimulateTrade.data` exists.
- **Simulation error state**: when `useSimulateTrade.isError`, render the error message in a destructive `<Alert>` with a "Retry" button that calls `refetch()` (Requirement 5).
- **Action bar**: three buttons in a row. Disabled states: Try requires both teams selected with at least one contract present on each side. Execute requires `result.isValid === true` && `teamAId !== teamBId`. Reset always enabled except during execution.
- **No confirmation dialog**: Execute Trade fires the mutation directly — no `AlertDialog` gate (not in approved scope).

## Reuse Audit

| Hook / Service | How it's reused | What we pass |
|----------------|-----------------|--------------|
| `useGame(gameId)` | Gets `selectedTeamId` for Team A default, `seasonYear` for header | `gameId` from URL params |
| `useTeams()` | Populates both team selectors | none |
| `useRoster(gameId, teamId)` | Called twice: Team A and Team B rosters | `gameId`, `teamAId` / `teamBId` |
| `useSimulateTrade(gameId, contractsA, contractsB, pkgA, pkgB)` | Validates the trade without executing | gameId + `Contract[]` arrays extracted from roster + built packages |
| `useExecuteTrade()` | Executes the trade, invalidates queries, clears simulation cache | `mutation.mutate({ gameId, contractsA, contractsB, pkgA, pkgB })` |
| `TradeValidator.validateTrade()` | Called internally by `TradeEngine.simulateTrade()` | internal |
| `TeamTradeDetails` (from `TradeValidationResult.details`) | Renders incoming salary, salary delta, over-cap, over-hard-cap per column | consumed from simulation `data.details.teamA` / `data.details.teamB` |
| `shadcn Alert`, `Button`, `Card` | UI primitives already in the project | standard shadcn imports |

## Edge Cases

| Case | Handling |
|------|----------|
| Game is loading or does not exist | `useGame.isLoading` → loading skeleton. `useGame.data === null` → "Game not found" unavailable state. No trade controls rendered. |
| Same team selected on both sides | Disable Try Trade and Execute. Native `<select>` excludes the other side's value. |
| Team has zero contracted players | `useRoster` filtered to `rp.contract !== null` → empty array → render "No eligible players on this roster". |
| Both teams selected but no players toggled | Each package summary shows "No outgoing players selected". Try Trade and Execute are disabled. |
| Player appears in both outgoing packages | Impossible by construction: each roster is scoped to its team. No cross-team roster sharing. |
| Simulation query fails (network error, Supabase error) | `useSimulateTrade.isError` → render destructive alert with `error.message` and a Retry button calling `refetch()`. Execute remains disabled. |
| Validation returns errors + warnings | Errors render as destructive alerts (block Execute). Warnings render as muted alerts (informational). Both teams' financial details are always visible when simulation data exists. |
| Execute fails mid-trade (partial writes) | Present: `TradeEngine.executeTrade` is not transactional. Surface `mutation.error` as a destructive alert: "Trade execution failed. Some player contracts may have been updated. Verify rosters before retrying." Local state preserved for retry. |
| User navigates away and back | Local state is lost (expected — no persistence requirement). Fresh page on return. |
| Stale simulation data after execution | On execute success: `queryClient.removeQueries({ queryKey: ["games", gameId, "trade-simulation"] })` clears the simulation cache alongside rosters being refreshed by the existing invalidation list. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Helper | `buildPackage()` adapter correctness | One Vitest unit test in `tests/app/trades/buildPackage.test.ts`: given a `RosterPlayer[]` and a `Set<PlayerId>`, verify `outgoingAssets` matches expected `TradeAsset[]`. Also verify: empty set → empty `outgoingAssets`; non-contracted players excluded; multiple players aggregated correctly. ~30 lines. |
| Page | Rendering, state transitions | Manual verification against the acceptance criteria. No component tests — the page is a thin wiring of already-tested primitives. |

The `buildPackage` helper is the only non-trivial logic the page owns. Everything else (`useSimulateTrade`, `TradeValidator`, `TradeEngine`) already has its own verification surface in `tests/domain/services/TradeValidator.test.ts`.

## Migration / Rollout

No migration required. The sidebar link at `src/components/dashboard/layout-components.tsx:61` already points to `/trades`. Creating the page file at the expected path makes the link work.

Rollback: delete both the page file and the test file. The sidebar returns to its current 404 behavior.

## Open Questions

None. All resolved in the proposal:
- Any two teams, Team A prefilled → confirmed.
- Two-team, player-only scope → confirmed.
- No trending players, no picks, no cash → confirmed.

## Why Domain / Application / Infrastructure Changes Are NOT Needed

| Layer | Why untouched |
|-------|---------------|
| **Domain** (`src/domain/`) | `TradePackage`, `TradeAsset`, `TradeValidationResult`, `TeamTradeDetails`, `TradeValidator`, `SalaryCapCalculator`, `RosterValidator`, and `NBA_RULES` already cover two-team player-only trades with salary matching, roster limits, and hard-cap checks. No new rule or type is needed. |
| **Application** (`src/application/`) | `TradeEngine.simulateTrade()` and `TradeEngine.executeTrade()` handle validation and contract reassignment. `useSimulateTrade` and `useExecuteTrade` wrap them with TanStack Query and proper cache invalidation. No new use case or hook behavior is needed. `useTradeStore` is explicitly left alone — its shape mismatch is handled by the page's local state adapter. |
| **Infrastructure** (`src/infrastructure/`) | `SupabaseContractRepository.update(gameId, id, { teamId })` already re-assigns players. Schema, RLS, and migrations are out of scope. No new data access is needed. |
