# Proposal: Two-Team Trade Machine

## Intent

The dashboard already links to `/games/[gameId]/dashboard/trades`, but the route does not exist and currently returns a 404. Add the smallest useful trade page so a GM can build, validate, and execute a player-only trade between two teams in the active game by reusing the existing trade engine and hooks.

## User Outcome

A GM can select two distinct teams, choose contracted players from each roster, inspect salary and validation feedback, execute a valid trade, or reset the proposal without leaving the saved game.

## Scope

### MVP Scope

- Add the missing two-team trade page at `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx`.
- Support player assets only, using the active game's season and existing roster data.
- Build domain-compatible `TradePackage` values in local page state because `src/application/stores/useTradeStore.ts` uses an incompatible legacy shape.
- Reuse `useSimulateTrade` and `useExecuteTrade` without changing the trade engine, hooks, repositories, or schema.
- Show outgoing salary, projected financial context, validation errors, and validation warnings for both teams.
- Provide Try Trade, Execute Trade, and Reset actions. Execution is available only for a valid result involving two distinct teams.
- Exclude players without contracts from selection and show a useful empty state when a roster has no eligible players.
- Add only the smallest focused check for any non-trivial package-building helper, and keep the complete implementation within 400 changed lines.

### Explicit Non-Goals

- Trades involving three to five teams.
- Draft picks, cash considerations, free-agent signings, or contract modifications.
- A separate season selector or configurable trade rules.
- Sharing, community voting, trending players, or saved trade proposals.
- Refactoring or adopting the legacy Zustand trade store.
- Making `TradeEngine.executeTrade` transactional.
- New domain rules, SQL migrations, RLS policies, repository methods, or dependencies.

## Capabilities

### New Capabilities

- `trade-machine`: Build, validate, reset, and execute a two-team, player-only trade within an active game.

### Modified Capabilities

None.

## Minimal Approach

Implement one client page that owns the two selected teams and outgoing player assets in local React state. Adapt that state directly to the domain `TradePackage` shape consumed by the existing trade hooks. Keep presentation logic in the page; extract at most one or two presentational components only if needed to remain readable without exceeding the review budget.

This completes the Trade Interface item in `PLAN.md` Phase 3 by exposing the existing Phase 2 trade validation and salary-cap capabilities. No domain, application, or infrastructure behavior changes.

## Affected Surfaces

| Surface | Layer | Impact |
| --- | --- | --- |
| `src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx` | Presentation | New client page for team selection, player packages, financial summaries, validation feedback, and trade actions. |
| `src/application/hooks/trades/useTrades.ts` | Application | Reused unchanged for simulation and execution. |
| `src/application/services/TradeEngine.ts` | Application | Reused unchanged for validation and contract reassignment. |
| `src/domain/entities/Trade.ts` | Domain | Existing trade asset, package, and validation contracts are consumed unchanged. |
| `src/domain/services/SalaryCapCalculator.ts` | Domain | Existing financial status calculation is reused unchanged. |
| `src/application/stores/useTradeStore.ts` | Application | Explicitly untouched because its legacy package shape is incompatible with the engine. |
| `src/components/dashboard/layout-components.tsx` | Presentation | Existing navigation link is reused unchanged. |

Infrastructure and database surfaces are unaffected.

## Acceptance-Level Outcomes

- [ ] Opening the existing Traspasos navigation target renders the trade page instead of a 404.
- [ ] The GM can select two distinct teams and toggle eligible contracted players into each outgoing package.
- [ ] Try Trade uses the existing simulation hook and displays salary context plus all returned errors and warnings.
- [ ] Execute Trade is unavailable while simulation is loading, when both sides select the same team, or when the latest result is invalid.
- [ ] Executing a valid trade uses the existing execution hook and refreshed roster queries reflect the reassigned players.
- [ ] Reset clears the local proposal without modifying persisted data.
- [ ] Rosters with no eligible contracted players render an empty state rather than failing.
- [ ] The implementation adds no dependency, migration, or cross-layer business logic and remains within 400 changed lines.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| The legacy Zustand store is mistaken for the engine-compatible state model. | Low | Keep it untouched and construct the domain package shape locally at the hook boundary. |
| `TradeEngine.executeTrade` can partially update contracts because writes are not transactional. | Medium | Preserve current behavior, surface execution failures, and defer transaction hardening to a separate change. |
| The page exceeds the 400-line review budget. | Low–Medium | Keep the page thin and reuse existing code; ask before expanding scope or creating a larger review slice. |
| Players without contracts cannot be represented as valid player assets. | Low | Exclude them from the picker and provide an empty state when none are eligible. |

## Review Boundary

The implementation is one review unit capped at 400 changed lines. If the minimal page and focused check are forecast to exceed that budget, pause and request approval before increasing scope or review workload.

## Rollback Plan

Revert the new trade page and its focused check. The existing sidebar link will return to its current 404 behavior; no database, domain, application, infrastructure, or dependency rollback is required.

## Dependencies

- Existing `useRoster`, `useSimulateTrade`, and `useExecuteTrade` hooks.
- Existing trade domain types, validator, salary calculator, and contract repository behavior.
- No new external dependencies.
