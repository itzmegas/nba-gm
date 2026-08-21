# Proposal: Player Career Mode

## Intent

Add a fictional career from college through retirement and legacy.

## Scope

### In Scope
- One owner-scoped `career_saves` table; creation sets `currentOverall=60`.
- Direct college-to-draft resolution, three NBA events, retirement, legacy, and immutable pending snapshots.
- Exactly three deterministic, distinct NBA offers selected from a team-ID-deduplicated catalog.
- Tests separately reject duplicate-heavy catalogs and duplicate `offerIds` mutation input.

### Out of Scope
- Salary/cap gameplay, `rookie_salary`, skills/JSONB, potential, multi-year college, real lottery/NBA simulation, free agency, photos, achievements, 12+ events, or cross-mode integration.
- `career_events`/history UI, custom save title, deletion/soft deletion/`useDeleteCareerSave`, extra routes (`/career/new`, `/career/[id]/event`, `/career/[id]/layout.tsx`), extra components, or a Zustand creation store.
- Separate draft declaration, generic `Partial<CareerSave>` updates, post-zero-row mutation reads, transactional/custom RPCs, DB lifecycle enforcement, or GM-table writes.

## Capabilities

### New Capabilities
- `player-career-mode`: Create, advance, draft, retire, and summarize a career.

### Modified Capabilities
None.

## Approach

- Persist one aggregate with `events_resolved`, nullable JSONB event, four checks, owner RLS, and Zod boundaries.
- Keep `CareerSaveRepository` read/list/create-only: `getById`, `getByUserId`, `create`; hooks own four narrow lifecycle updates.
- Resolve computes absolute `eventsResolved = save.eventsResolved + 1` client-side and sends it with the next state in one update guarded by pending-event ID. No SQL arithmetic or RPC.
- Lifecycle guards are cooperative checks only. RLS enforces ownership; direct owner calls can bypass lifecycle filters, an accepted limitation.
- Forecast: **721 LOC** total; PR1 **280**, PR2 **251**, PR3 **190**; every PR <400; hard stop **800**.

## Affected Areas

| Area | Impact |
|---|---|
| `scripts/schema.sql`, `src/domain` | Aggregate, Zod, offers, repository |
| `src/infrastructure`, `src/application` | Mapping, hooks |
| `src/app`, `tests/domain` | Pages, tests |

## Risks

| Risk | Mitigation |
|---|---|
| Malformed rows/events | Zod and tests |
| Duplicate/undersized offers | Require three unique IDs; validate input |
| Stale actions | Guard, invalidate, refetch |
| Scope drift | Locked non-goals and hard budgets |

## Rollback Plan

Revert PRs and entry point; remove schema only after confirming career data is disposable.

## Dependencies

Supabase, read-only NBA teams, exploration, specification, and design.

## Success Criteria

- [ ] Owner completes the overall-60 college-to-retirement loop with no GM writes.
- [ ] Repository remains read/list/create-only; four lifecycle writes remain narrow and guarded.
- [ ] Resolve writes the absolute client-computed count and next state atomically, without SQL arithmetic or RPC.
- [ ] RLS ownership and cooperative-guard/direct-owner-bypass limitations remain explicit.
- [ ] Selection returns exactly three deterministic distinct offers; tests separately reject duplicate-heavy catalogs and duplicate `offerIds` mutation input.
- [ ] Forecast remains 721 = 280 + 251 + 190; all PRs stay <400 and total stays below hard stop 800.
