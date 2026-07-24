# Exploration: player-career-mode (1-table MVP, gate-corrected)

Change name (user-supplied): `player-career-mode`
Reference experience: https://www.potrerofutbol.ar/el-idolo (Potrero Fútbol, "El Ídolo")
Review budget: **800 changed lines (hard stop)**, target **≤721**, projected **~721**. Both totals are across the full MVP, not per PR.
Per-PR budget: **≤400 authored changed lines** (the 400 line is the high-review-tier threshold; under that, each PR stays in the standard review tier). Split into **3 focused PRs** to honor this.
Artifact store: OpenSpec + Engram. Mode: automatic. Ponytail: full.

## TL;DR

The MVP stays at 1 table + JSONB pending event + row-level atomicity. This round fixes nine coherence gaps surfaced by the fresh gate:

1. **College event auto-transitions to `draft`.** The college event template's options carry `nextStage: 'draft'`. The resolve UPDATE atomically sets `stage = 'draft'` as part of the same conditional write. The separate "Declare for the Draft" button is **removed** — the resolution IS the declaration.
2. **`events_resolved SMALLINT NOT NULL DEFAULT 0 CHECK (events_resolved >= 0)`.** New column on `career_saves`. The resolve hook computes the absolute value `eventsResolved = save.eventsResolved + 1` **client-side from the validated current snapshot** and sends that explicit value in one conditional row update guarded by the pending event ID. Powers the legacy summary's event count without a second write. **Supabase JS `.update()` cannot express SQL expressions** (it maps to `UPDATE ... SET col = $1` with positional parameters); server-side arithmetic would require an RPC (rejected) or raw SQL (rejected). The single conditional UPDATE sets `events_resolved = $5` where `$5` is the client-computed absolute value. This is design/pseudocode for the value, not SQL arithmetic.
3. **Generic `Partial<CareerSave>` updates are removed.** Two new narrow conditional mutations replace them:
   - `usePickDraftTeam(careerId)` takes `{ teamId, offerIds }`, validates `offerIds.includes(teamId)` **and that `offerIds` contains no duplicate IDs** **before** issuing the UPDATE, and the UPDATE carries `WHERE stage = 'draft' AND pending_event IS NULL`.
   - `useRetireCareer(careerId)` issues a UPDATE with `WHERE stage = 'nba' AND pending_event IS NULL`.
    - **Lifecycle stage / pending-event WHERE guards are cooperative-client concurrency and data-consistency checks**, not a security boundary. RLS enforces row ownership (`user_id = auth.uid()`). An authenticated owner can call the Supabase JS client directly and bypass those lifecycle filters — the WHERE clauses do not stop a custom client call that simply omits them. Accepted MVP limitation; no RPC.
4. **DB CHECKs** added inline: `current_age >= 18`, `current_overall BETWEEN 40 AND 99` (the **creation initial overall is exactly 60**, explicit and validated; the user never inputs overall — the 40–99 range is the DB clamp for delta effects, not a free user input), `events_resolved >= 0`, `stage IN ('college', 'draft', 'nba', 'retired')`.
5. **Zod runtime parsing** for the full Supabase row (including `pending_event` JSONB) via a new `parseSupabaseRow(row: unknown): CareerSave` function. Create + mutation inputs are also zod-validated. Test file covers the complete in-scope test contract for the MVP (`tests/domain/entities/CareerSave.test.ts`, ~53 LOC): `applyChoice` (progression: applies college effect and transitions to `draft`; clamping: floor 40 and ceiling 99), `parseSupabaseRow` (valid row → `CareerSave` with correct dates + camelCase + parsed `pendingEvent`; malformed `pending_event` → throws `ZodError`), `selectEvent` (deterministic: same `(saveId, age, overall, stage)` returns same template; stage-filtered: result's `appliesTo` includes the requested stage), `pickNbaOffers` (deterministic distinct team IDs across calls; rejects duplicate-ID catalog with many entries but fewer than 3 unique IDs after dedup; rejects too-small catalog with fewer than 3 unique IDs after dedup), **`draftPickInputSchema`** (separate in-scope test alongside catalog tests: rejects duplicate `offerIds` — input with duplicate UUIDs in the array and a valid `teamId` fails `.parse()` with a `ZodError`; the catalog duplicate/too-small rejection in `pickNbaOffers` is a different code path and is tested separately).
6. **Zero-row conditional updates return `null` from `.maybeSingle()`.** The hook invalidates the `["career-saves", careerId]` query key and throws a `StaleCareerError`. The page's read hook (already subscribed) refetches. The resolve stays **one atomic write**; the read is **optional, query-driven**, and lives in the existing read path, not in the mutation.
7. **File counts: 8 new + 5 modified = 13 total files.** (Was 8 new + 5 modified; the prior split holds; the new requirements were absorbed without adding files.)
8. **3 PRs, none over 400 LOC.** PR1 280 (domain + tests), PR2 251 (infra + hooks), PR3 190 (presentation). All under the 400 LOC high-review-tier threshold. The 3-PR split does NOT reduce the 721-LOC total; it lowers per-PR review burden.
9. **Contradictions removed.** No "Declare for the Draft" button. No `useUpdateCareerSave`. No "return current state" claim for zero-row updates. No "atomicity through two updates" anywhere. The college event's `nextStage: 'draft'` is the only transition path.

**Total scope (file-by-file forecast, arithmetic-verified): ~721 changed lines** across 8 new files + 5 modified files. 79 LOC headroom under the 800-line hard stop.

## Reference product — mechanics extracted (unchanged)

`potrerofutbol.ar/el-idolo` is a fully client-rendered SPA. Static HTML exposes only a boot-skeleton and metadata. Product contract (from meta description / page title):

| El Ídolo mechanic | NBA translation |
| --- | --- |
| "Modo carrera en 5 minutos" | Time-skip per season; 1 event card per advance. |
| "Arrancás a los 16 en el Ascenso" | Start at 18 in college. |
| "Te ganás el salto a la Liga Argentina" | Resolve the college event → `stage = 'draft'`. |
| "Goles, contratos" | Per-season stat gains; the NBA team identity. |
| "Clásicos" / "Lesiones" / "Decisiones que no se perdonan" | Rivalry / injury / choice events. |
| "Llegás a la estatua" | Win awards / retire with a compact legacy block. |

No public JS bundle or network payload was inspectable (boot-only). No source cloning; the analysis is mechanical, not textual.

## Product decisions resolved (locked in prior rounds, all still in force)

1. **Player naming.** User types `firstName` and `lastName` on the create form. **No save-title field** — the player's own name identifies the save.
2. **Draft agency.** After the college phase (resolved by the user), the system deterministically picks 3 NBA teams seeded by `hash(career_saves.id)`. The user picks one.
3. **Event templates.** A library of **4 hard-coded event templates** in the domain (1 college + 3 NBA loop), each with 2 choices and pure-data effects. The college event's options carry `nextStage: 'draft'`. The NBA events do not change stage. Selection deterministic by `hash(save_id + current_age + current_overall)` over the eligible set. The persisted pending event is an immutable snapshot.
4. **College duration.** Fixed **1 college event**. Resolving it atomically transitions to `stage = 'draft'`. No Declare button.
5. **Retirement trigger.** Manual "Retire" button on the dashboard during the NBA stage. Sets `stage = 'retired'`. Dashboard shows a compact legacy block (final overall, age, college, NBA team, `events_resolved`).
6. **Contracts affecting gameplay.** **No.** Salary column removed entirely. The career is a personal-arc simulator, not a financial one.

## Architectural simplification (gate-mandated, this round)

### Schema (1 table, 4 CHECKs, 1 RLS, 1 index)

```sql
-- 9. Career saves (1-table aggregate; no FK to players or contracts; FK to teams is read-only display)
CREATE TABLE IF NOT EXISTS career_saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT NOT NULL,
    college TEXT NOT NULL,
    current_age SMALLINT NOT NULL DEFAULT 18 CHECK (current_age >= 18),
    current_overall SMALLINT NOT NULL CHECK (current_overall BETWEEN 40 AND 99),
    events_resolved SMALLINT NOT NULL DEFAULT 0 CHECK (events_resolved >= 0),
    stage TEXT NOT NULL DEFAULT 'college'
      CHECK (stage IN ('college', 'draft', 'nba', 'retired')),
    current_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    pending_event JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_saves_user_id ON career_saves(user_id);

ALTER TABLE career_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_saves_all_owner ON career_saves;
CREATE POLICY career_saves_all_owner
  ON career_saves
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Notes:
- **4 inline CHECK constraints** at the column level (`current_age`, `current_overall`, `events_resolved`, `stage`). The DB rejects invalid values regardless of the client.
- **No FK to `players.id`**. The career player is fictional. `first_name + last_name + position + college` is the identity.
- **`current_team_id` references `teams` for read-only display** (teams is publicly readable for authenticated users). No write to `teams`.
- **`pending_event JSONB` is nullable**. When null, the dashboard shows the stat sheet + advance button. When set, the dashboard shows the event card. The JSONB contains the full immutable snapshot.
- **No `status` / `deleted_at` / soft delete**. Hard delete is out of scope for MVP.

### RLS (1 policy, FOR ALL, no nested)

```sql
DROP POLICY IF EXISTS career_saves_all_owner ON career_saves;
CREATE POLICY career_saves_all_owner
  ON career_saves
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

A single `FOR ALL` policy is sufficient. **No nested RLS** (no policy on a child table referencing the parent).

### College event = draft transition (gate finding 1)

The college event template is:

```typescript
{
  kind: "rivalry",
  prompt: "Rival taunts you before the big game. How do you respond?",
  appliesTo: [CAREER_STAGE.COLLEGE],
  options: [
    { label: "Match his energy and dominate", effects: { overallDelta: 2, ageDelta: 1, nextStage: CAREER_STAGE.DRAFT } },
    { label: "Stay calm and let your game speak", effects: { overallDelta: 1, ageDelta: 1, nextStage: CAREER_STAGE.DRAFT } },
  ],
}
```

Both options carry `nextStage: 'draft'`. When the user resolves the college event, the conditional UPDATE atomically sets `stage = 'draft'`. The dashboard then renders the 3-NBA-offers picker. There is **no Declare button** anywhere; the resolution IS the declaration.

### Resolve = ONE conditional UPDATE (absolute-value snapshot, no SQL arithmetic)

The Supabase JS `.update()` chain translates to a single SQL `UPDATE ... SET ... WHERE ... RETURNING *` statement. The hook computes the full next row client-side — including `eventsResolved = save.eventsResolved + 1` as an explicit value — and sends every column as an absolute value. The pseudo-code for the value the hook builds:

```typescript
// resolve hook — client-side, before issuing the .update() call
const nextRow = {
  current_overall: applyChoice(save, optionIndex).currentOverall,   // absolute, clamped 40–99
  current_age:     applyChoice(save, optionIndex).currentAge,        // absolute
  stage:           applyChoice(save, optionIndex).stage,             // absolute
  current_team_id: applyChoice(save, optionIndex).currentTeamId,    // absolute (unchanged on NBA)
  events_resolved: save.eventsResolved + 1,                          // absolute, NOT a SQL expression
  pending_event:   null,
  updated_at:      new Date().toISOString(),
};
```

The conditional UPDATE is a single SQL statement:

```sql
UPDATE career_saves
SET
  current_overall = $1,             -- absolute (clamped 40–99)
  current_age     = $2,             -- absolute
  stage           = $3,             -- absolute
  current_team_id = $4,             -- absolute
  events_resolved = $5,             -- absolute = save.eventsResolved + 1 (computed client-side)
  pending_event   = NULL,
  updated_at      = now()
WHERE id = $6
  AND user_id = auth.uid()
  AND pending_event IS NOT NULL
  AND pending_event->>'id' = $7     -- pending event ID = version token
RETURNING *;
```

**Why `$5` and not `events_resolved + 1`**: Supabase JS `.update()` maps to `UPDATE ... SET col = $1` with positional parameters. It cannot express SQL expressions like `SET events_resolved = events_resolved + 1`. Server-side arithmetic would require an RPC (rejected) or raw SQL (rejected). The absolute-value `$5` approach avoids both. The pseudo-code above is design intent for the **value** the hook writes, not SQL arithmetic.

**Why the absolute increment is safe**: The pending event ID is the version token. Two concurrent resolvers both read `events_resolved = 5` and `pending_event.id = "abc123"`. Resolver A's UPDATE matches the guard, sets `events_resolved = 6` and `pending_event = NULL`, commits. Resolver B's UPDATE arrives: `pending_event` is now NULL, so `pending_event->>'id' = 'abc123'` fails, the WHERE matches 0 rows, `.maybeSingle()` returns `null`, the hook invalidates and throws `StaleCareerError`. Only one resolver can ever commit its computed `events_resolved` value, so the absolute value is always `old_count + 1` relative to the committed state.

Properties:
- **One atomic write**. `stage`, `current_overall`, `current_age`, `current_team_id`, `events_resolved`, and `pending_event = NULL` are all set in a single statement.
- **No SQL arithmetic**. Every column is set to an absolute value computed from the validated current snapshot.
- **Idempotent on re-issue**: the second call's `pending_event IS NOT NULL` fails because the first call set `pending_event` to `NULL`. The hook receives `null` from `.maybeSingle()`.
- **Stale-event guard**: `pending_event->>'id' = $7` matches the specific event the user was resolving. A two-tab race fails this clause for the second tab.

### Roll = ONE conditional UPDATE

```sql
UPDATE career_saves
SET
  pending_event = $1,
  updated_at = now()
WHERE id = $2
  AND user_id = auth.uid()
  AND pending_event IS NULL
  AND stage <> 'retired'
RETURNING *;
```

The hook builds the `pending_event` JSONB client-side deterministically. The SQL only writes it.

### Draft pick = ONE conditional UPDATE (narrow mutation)

```sql
UPDATE career_saves
SET
  current_team_id = $1,
  stage = 'nba',
  updated_at = now()
WHERE id = $2
  AND user_id = auth.uid()
  AND stage = 'draft'
  AND pending_event IS NULL
RETURNING *;
```

The hook's signature:

```typescript
usePickDraftTeam(careerId) → useMutation<CareerSave, Error, { teamId: string; offerIds: string[] }>
```

**Pre-update validation (UX safety net):**
- if `!offerIds.includes(teamId)`, the hook throws `InvalidTeamChoiceError` and never issues the UPDATE.
- if the `offerIds` array contains duplicate IDs (e.g. from a malformed client payload), the hook throws an input-validation error and never issues the UPDATE. The `draftPickInputSchema` zod schema rejects duplicate IDs at the boundary.

The page computes the 3 deterministic offers via `pickNbaOffers(saveId, teams)` and passes `offerIds` to the mutation. This catches stale form values, copy-paste mistakes, and out-of-band UI glitches.

**Conditional guard (cooperative-client concurrency check):** the SQL `WHERE stage = 'draft' AND pending_event IS NULL` prevents an in-flight race from overwriting a `nba`/`retired` row. **This is not a security boundary**: the WHERE clauses are cooperative-client concurrency and data-consistency checks. RLS only scopes by `user_id = auth.uid()`. An authenticated owner can call the Supabase JS client directly and bypass the WHERE guards — those filters do not stop a custom client call that simply omits them. Accepted MVP limitation; no RPC.

### Retire = ONE conditional UPDATE (narrow mutation)

```sql
UPDATE career_saves
SET
  stage = 'retired',
  updated_at = now()
WHERE id = $1
  AND user_id = auth.uid()
  AND stage = 'nba'
  AND pending_event IS NULL
RETURNING *;
```

The hook's signature: `useRetireCareer(careerId) → useMutation<CareerSave, Error, void>`. The `WHERE stage = 'nba' AND pending_event IS NULL` is the same UX-safety-net pattern. Retire from `college` or `draft` is intentionally not allowed by the SQL guard (the user can only retire after they've entered the NBA stage).

### Zero-row updates: `maybeSingle()` returns `null`; invalidate + refetch (gate finding 6)

Every conditional UPDATE in this MVP uses `.select().maybeSingle()`. The Supabase JS client returns `{ data: null, error: null }` when the UPDATE affects 0 rows (vs `.single()` which throws). The hook's behavior on a null `data`:

```typescript
if (error) throw new Error(error.message);
if (!data) {
  // 0-row update. The save is in a stale state (event already resolved, stage already advanced, etc.).
  // Invalidate the read query so the next render refetches the current save.
  await qc.invalidateQueries({ queryKey: ["career-saves", careerId] });
  throw new StaleCareerError(
    "Career save is in a stale state; the dashboard will refetch the current state."
  );
}
```

The hook does **not** issue a read after the no-op UPDATE. The read is **optional, query-driven**, and lives in the existing `useCareerSave` read hook (which TanStack Query refetches after the invalidation). The page catches the error and shows a transient "refreshing…" state until the read returns.

The resolve / roll / pick / retire mutations all remain **one atomic write**. The read is a downstream concern.

## Affected Areas (file-by-file changed-line forecast, arithmetic-verified)

13 files total: **8 new + 5 modified**.

| # | File | LOC | Notes |
|---|---|---:|---|
| 1 | `scripts/schema.sql` (modify) | **+35** | 1 CREATE TABLE, 4 inline CHECKs, 1 RLS `FOR ALL`, 1 index. No `career_events` table. |
| 2 | `src/domain/entities/CareerSave.ts` (new) | **125** | Entity, zod schemas (`careerSaveSchema`, `supabaseRowSchema`, `pendingEventSchema`, `createCareerSaveInputSchema`, `resolveEventInputSchema`, `draftPickInputSchema`), `CAREER_STAGE` + `CAREER_POSITION` consts, `COLLEGES` const (5), `PendingCareerEvent` + `CareerEventEffects` types, `applyChoice` pure function, `parseSupabaseRow` zod parser. |
| 3 | `src/domain/constants/career-events.ts` (new) | **45** | `CareerEventTemplate` type, `CAREER_EVENTS` const (4 templates: 1 college with `nextStage: 'draft'` + 3 NBA; 2 choices each), `selectEvent` deterministic function, `pickNbaOffers` (deduplicates catalog by team ID, rejects catalogs with fewer than 3 unique IDs, Fisher-Yates deterministic shuffle, returns exactly 3 distinct team IDs). The hook also rejects duplicate offer IDs in mutation input via `draftPickInputSchema` zod refinement. |
| 4 | `src/domain/repositories/CareerSaveRepository.ts` (new) | **20** | Interface: `getById`, `getByUserId`, `create`. No `update` or `softDelete` — narrow mutations live in hooks. |
| 5 | `src/infrastructure/repositories/SupabaseCareerSaveRepository.ts` (new) | **100** | snake↔camel mapper delegating to `parseSupabaseRow`; 4 methods using `.maybeSingle()` for SELECTs and UPDATEs. |
| 6 | `src/application/hooks/career/useCareer.ts` (new) | **150** | 7 hooks in one file: `useCareerSaves` (list), `useCareerSave` (single), `useCreateCareerSave`, `useRollEvent`, `useResolveEvent`, `usePickDraftTeam` (validates `offerIds.includes(teamId)` before issuing UPDATE), `useRetireCareer`. Each UPDATE uses `.maybeSingle()` and invalidates on 0 rows. |
| 7 | `src/app/(protected)/page.tsx` (modify) | **+25** | Add a "Player Career" card linking to `/career`. **Additive**, not a refactor. |
| 8 | `src/app/(protected)/career/page.tsx` (new) | **75** | Career save list + create form **inlined in the same page**. No `/career/new` route. |
| 9 | `src/app/(protected)/career/[careerId]/page.tsx` (new) | **90** | Dashboard: if `pendingEvent`, render inline event card; else if `stage='draft'`, render 3 NBA offers picker (calls `usePickDraftTeam`); else if `stage='nba'`, render "Advance Season" + "Retire" buttons; if `stage='retired'`, render legacy block with `events_resolved`. No Declare button. |
| 10 | `tests/domain/entities/CareerSave.test.ts` (new) | **53** | **Focused test contract (all in scope for MVP, not deferred):** `applyChoice` (progression: applies college effect and transitions to `draft`; clamping: floor 40 and ceiling 99), `parseSupabaseRow` (valid row → `CareerSave` with correct dates + camelCase + parsed pendingEvent; malformed `pending_event` → throws `ZodError`), `selectEvent` (deterministic: same `(saveId, age, overall, stage)` returns same template; stage-filtered: result's `appliesTo` includes the requested stage), `pickNbaOffers` (returns exactly 3 distinct team IDs; deterministic across calls; **rejects too-small catalog** with fewer than 3 unique IDs after dedup; **rejects duplicate-ID catalog** where input has many entries but fewer than 3 unique IDs after dedup, e.g. 30 entries pointing to 2 unique teams), **`draftPickInputSchema`** (separate in-scope test alongside the catalog tests: rejects duplicate `offerIds` — input with duplicate UUIDs in the array and a valid `teamId` fails `.parse()` with a `ZodError`; the catalog duplicate/too-small rejection in `pickNbaOffers` is a different code path and is tested separately). |
| 11 | `src/domain/entities/index.ts` (modify) | **+1** | Export `CareerSave`, `CAREER_STAGE`, `careerSaveSchema`, `parseSupabaseRow`, `applyChoice`. |
| 12 | `src/domain/repositories/index.ts` (modify) | **+1** | Export `CareerSaveRepository`. |
| 13 | `src/infrastructure/repositories/index.ts` (modify) | **+1** | Export `SupabaseCareerSaveRepository`. |
| | **TOTAL** | **721** | Arithmetic: 35 + 125 + 45 + 20 + 100 + 150 + 25 + 75 + 90 + 53 + 1 + 1 + 1 = 721. **Target ≤721 ✓; hard stop 800; headroom 79 LOC ✓.** |

### PR split (3 focused PRs, all under 400 authored LOC)

**PR1 — Domain + tests.** Files: 1, 2, 3, 4, 10, 11, 12 (7 files). Subtotal: 35 + 125 + 45 + 20 + 53 + 1 + 1 = **280 LOC** ✓ (< 400).

What the reviewer sees: the schema with 4 CHECKs and 1 RLS, the entity + zod schemas + `parseSupabaseRow` + `applyChoice`, the event library + `pickNbaOffers`, the repository interface, the test, and 2 index edits. No infra, no hooks, no UI. Demoability: **not asserted**.

**PR2 — Infra + hooks.** Files: 5, 6, 13 (3 files). Subtotal: 100 + 150 + 1 = **251 LOC** ✓ (< 400).

What the reviewer sees: the Supabase implementation (mapper delegates to `parseSupabaseRow`), the 7 hooks in one file (`useCareerSaves`, `useCareerSave`, `useCreateCareerSave`, `useRollEvent`, `useResolveEvent`, `usePickDraftTeam`, `useRetireCareer`), and 1 index edit. No UI. The hooks are usable from a test or a temporary page; the dashboard is PR3's concern.

**PR3 — Presentation.** Files: 7, 8, 9 (3 files). Subtotal: 25 + 75 + 90 = **190 LOC** ✓ (< 400).

What the reviewer sees: the additive modify on the existing landing (`+25` LOC, no refactor of the GM content), the new `/career` list+form page (75 LOC), the new `/career/[id]` dashboard page (90 LOC, includes the inline event card, the draft picker, the retire button, the legacy block).

**Reconciliation with the 800-line hard stop:**
- TOTAL = 721 LOC = 280 + 251 + 190 (arithmetic verified) ✓.
- **No PR exceeds 400 LOC** (280 / 251 / 190) ✓.
- The 3-PR split does NOT reduce the total. It lowers per-PR review burden by staying under the 400-line high-review-tier threshold.

## What is NOT in the MVP (deferred; will not be added without re-opening the exploration)

The prior round's deferral list grows by:

| Cut (this round) | Reason |
| --- | --- |
| Separate "Declare for the Draft" button | The college event resolution IS the declaration (atomically). |
| Generic `Partial<CareerSave>` updates | Replaced by narrow `usePickDraftTeam` and `useRetireCareer` with conditional WHERE + pre-update validation. |
| Hook reads save after 0-row UPDATE | The read is optional and query-driven via the existing `useCareerSave` + TanStack Query invalidation. |

The full 27-item deferral list (multi-year college, real lottery, free agency, real NBA sim, salary cap, photos, achievements, transactional RPC, history view, cross-mode data, custom save title, `rookie_salary`, `current_potential`, `skills` JSONB, soft delete, `useDeleteCareerSave`, `/career/new` page, `/career/[id]/event` route, `/career/[id]/layout.tsx`, Zustand `useCareerCreateStore`, 12+ events, transactional RPC, etc.) is preserved. **The focused test contract in row 10 of the file table is in scope for MVP, not deferred** — `applyChoice` progression+clamping, `parseSupabaseRow` valid+malformed, `selectEvent` deterministic+stage-filtered, `pickNbaOffers` distinct IDs+deterministic+duplicate-ID catalog rejection+too-small catalog rejection, and **`draftPickInputSchema` rejecting duplicate `offerIds`** (separate in-scope test alongside the catalog tests) all ship in PR1.

## Approaches

### Approach A — One table, JSONB pending event, narrow conditional mutations, 3-PR split (recommended)

Everything in one table. The pending event is a JSONB snapshot. Resolve is one conditional UPDATE; roll is one conditional UPDATE; draft pick is one conditional UPDATE; retire is one conditional UPDATE. Each UPDATE is row-atomic. Pre-update validation in the page (offers list) prevents the wrong `teamId` from reaching the SQL. `events_resolved` increments inside the resolve UPDATE. Zod parse guards the boundary on read and on input.

- **Pros**: minimum architecture for the core loop; row-level atomicity; idempotent; smallest schema footprint; easiest RLS; least new code; 3-PR split keeps every PR under 400 LOC.
- **Cons**: the `pending_event` JSONB column is not validated by the DB schema (Postgres `CHECK (jsonb_typeof(pending_event) = 'object' OR pending_event IS NULL)` could be added; deferred). Mitigation: `parseSupabaseRow` zod-validates on read; the test covers the malformed case.
- **Effort**: ~721 LOC. Fits the 800-line budget with 79 LOC of headroom.

### Approach B — Server-side offers table + RPC for pickDraftTeam (REJECTED)

A `career_offers` table persisted at draft-stage entry, and a `pick_draft_team(career_id, team_id)` RPC that validates the team against the persisted offers. Adds 2 new artifacts (table + RPC), increases LOC by ~80, and the user has explicitly asked for **no RPC for this MVP**.

- **Rejected** by user direction.

### Approach C — In-memory only, no persistence (REJECTED)

The career lives in `localStorage` or a Zustand store with no DB writes.

- **Rejected** — violates the persistence requirement; loses the per-user RLS guarantee.

## Recommendation

**Approach A.** 1 table, JSONB pending event, 4 narrow conditional UPDATEs, 7 hooks in one file, 0 stores, 3 pages. Total **721 LOC** across **3 PRs** (PR1 280, PR2 251, PR3 190). All PRs under the 400-LOC high-review-tier threshold.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `pending_event` JSONB column is not DB-validated | Low | `parseSupabaseRow` zod-validates on every read; the test covers the malformed case. Postgres `CHECK` deferred. |
| Refresh / double-click during resolve applies effects twice | Low | `pending_event IS NOT NULL AND pending_event->>'id' = $eventId` in the conditional UPDATE. Second call: `pending_event` is now `NULL` → 0 rows. |
| Refresh / double-click during roll creates a second pending event | Low | `pending_event IS NULL` in the conditional UPDATE. Second call: 0 rows. |
| Two-tab race on roll or resolve | Low | Same guards. RLS scopes the row to one user; the second tab's UPDATE finds the row in a different state. |
| Two-tab race on pickDraftTeam | Low | `stage = 'draft' AND pending_event IS NULL` in the conditional UPDATE. Second tab: row is now `stage = 'nba'` → 0 rows. |
| Stale form sends a wrong `teamId` to `usePickDraftTeam` | Low | Pre-update validation: `!offerIds.includes(teamId)` throws `InvalidTeamChoiceError`. Conditional WHERE on `stage = 'draft'` catches any race. |
| The pre-update `offerIds` validation is mistaken for a security boundary | Low | The exploration explicitly states this is a **UX safety net, not a security boundary**. RLS still scopes by `user_id = auth.uid()`. An authenticated owner can bypass the client-side validation and SQL WHERE guards directly; the SQL guard does not stop a custom Supabase client call. This limitation is accepted — no RPC for this MVP. |
| The lifecycle WHERE filters (`stage = 'draft'`, `pending_event IS NULL`) are mistaken for a security boundary | Low | The exploration explicitly states these are **cooperative-client concurrency and data-consistency checks**, not enforcement. RLS enforces only row ownership. An authenticated owner calling Supabase directly can omit the WHERE clauses and write any state on their own row. Accepted MVP limitation; no RPC, no DB-level state-machine trigger. |
| `maybeSingle()` returns `null` and the hook claims "current state" | Low | The hook **invalidates** the read query and **throws** `StaleCareerError`. The read is **optional, query-driven** via the existing `useCareerSave` + TanStack Query invalidation. The page catches the error and shows a transient "refreshing…" state. |
| 0-row update path is silent (page does not know to refetch) | Low | The hook always throws on 0 rows after invalidation. The page's error state is explicit. |
| Landing modify regresses the GM experience | Low | The modify is **strictly additive** (`+25` LOC, new card above the existing list). |
| Per-PR demoability is over-claimed | Low | The exploration does NOT claim per-PR demoability. PR1 is data + tests; PR2 is infra + hooks; PR3 wires the UI. |
| Ponytail drift back to over-building | Medium | The 27-deferral list is the wall. Any PR that re-introduces a deferred item must re-open the exploration. |
| Review budget overrun | Low | 79 LOC of headroom under the 800-line hard stop. 3 PRs each under 400 LOC. Arithmetic verified. |
| PR split contradicts itself (claims to reduce total) | Low | The exploration explicitly states: **3-PR split does NOT reduce the total**. The 721-LOC total is the sum of the 3 PRs. |

## Ready for proposal

Yes. The orchestrator can move to the proposal phase. The next agent (`sdd-propose`) should:

- Pin the 4-event library in `src/domain/constants/career-events.ts` (1 college with `nextStage: 'draft'` on both options + 3 NBA; 2 choices each).
- Pin the SQL DDL exactly as sketched (1 table, 4 CHECKs, 1 RLS `FOR ALL`, 1 index, no `career_events`).
- Confirm the 3-PR split: PR1 domain+tests (280 LOC), PR2 infra+hooks (251 LOC), PR3 presentation (190 LOC). All under 400 LOC.
- Re-confirm the additive landing modify (`+25` LOC).
- Re-confirm the pre-update `offerIds` validation in `usePickDraftTeam` is a UX safety net, not a security boundary.
- Lock the 27 explicit deferrals as out-of-scope.

## References

- `src/domain/entities/Game.ts` — current `GAME_STATUS` const-style; pattern for `CAREER_STAGE`.
- `src/infrastructure/repositories/SupabaseGameRepository.ts` — mapper + soft-delete pattern; **adapted** (not copied) for `SupabaseCareerSaveRepository`. The new impl delegates snake↔camel conversion to `parseSupabaseRow`.
- `src/application/hooks/games/useCreateGame.ts` — pattern; **adapted** for `useCreateCareerSave` (no seed RPC; single-row insert; zod-validated input).
- `src/app/(protected)/page.tsx` — landing list; **additive modification** for the career entry point.
- `scripts/schema.sql:201-247` — `game_player_states` RLS block; replaced with a single `FOR ALL` owner policy on `career_saves` (no nested table).
- `tests/domain/entities/Game.test.ts` — vitest pattern for the `applyChoice` + `parseSupabaseRow` test.
- `openspec/changes/traspasos/exploration.md` and `openspec/changes/jordan-era-snapshots/exploration.md` — format reference.
