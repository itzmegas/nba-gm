# Design: Player Career Mode (1-Table MVP, Gate-Corrected)

## Technical Approach

One owner-scoped `career_saves` aggregate stores the entire career — identity, stats, stage, and the pending event as a nullable JSONB snapshot. Four narrow conditional single-row UPDATEs drive the core loop (roll, resolve, draft pick, retire). No writes to `players`, `contracts`, or `game_player_states`. No custom RPC. No generic `Partial<CareerSave>` update. No cross-table updates.

Zod validates every row on read (`parseSupabaseRow`) and every input on creation / mutation. Deterministic pure functions select events and offers from 4 hardcoded templates. Seven TanStack Query hooks in one file express all reads and mutations. Three pages — landing card, career list+create, career dashboard — render distinct branches per stage and zero-row state.

**Initial overall**: New careers are created with `current_overall = 60`. The DB column is `NOT NULL` with no DEFAULT; the value is set explicitly in the repository's `create` method. The user never inputs overall.

**Projected LOC**: ~721 across 8 new files + 5 modified files. **3 PRs**: PR1 domain+tests (280), PR2 infra+hooks (251), PR3 presentation (190). Hard stop: 800. No PR exceeds 400.

---

## Architecture Decisions

### Decision 1: One-table aggregate with JSONB pending event (not multi-table event history)

**Choice**: `career_saves` single table; `pending_event` as nullable JSONB column.

**Alternatives considered**:
- Separate `career_events` table with FK — adds a second table, second RLS policy, second index, and a cross-table atomicity problem (event write + career-save write must be atomic or retry-safe).
- In-memory only (localStorage) — violates persistence and per-user RLS.

**Rationale**: One table means one RLS policy (`FOR ALL`), one index, and row-level atomicity for every mutation. The JSONB column holds the full immutable event snapshot; no need to join or cross-reference. The DB does not validate the JSONB shape — Zod catches malformed data on every read, with a test covering that rejection path. The MVP has a single pending event at any time; multi-event history is deferred.

### Decision 2: Narrow conditional UPDATEs (no generic `Partial<CareerSave>` updates)

**Choice**: Each lifecycle transition has its own conditional SQL UPDATE with explicit `WHERE` guards. Hooks call supabase client directly for mutations; the repository interface provides `getById`, `getByUserId`, and `create` only.

**Alternatives considered**:
- Generic `repository.update(id, partial)` exposed via `useUpdateCareerSave` — allows the client to set any column on any row, no semantic guard, harder to test and review. Rejected by gate finding #3.
- RPC for each transition — adds ~80 LOC and custom PL/pgSQL functions. Rejected by explicit user direction ("no custom RPC").

**Rationale**: Each mutation is a single `.update().eq().eq()...select().maybeSingle()` chain in the hook. The `WHERE` clause encodes the legal preconditions (`pending_event IS NULL`, `stage = 'draft'`, etc.). `.maybeSingle()` returns `null` on 0-row updates; the hook invalidates the read query and throws `StaleCareerError`. No generic path to incorrect writes.

### Decision 3: College event auto-transitions to `draft` (no separate "Declare" button)

**Choice**: Both college event options carry `nextStage: 'draft'` in their `CareerEventEffects`. The resolve UPDATE sets `stage = 'draft'` as part of the same single-row statement.

**Alternatives considered**: Separate "Declare for the Draft" button after college resolution — adds a second user action, a second conditional UPDATE, and an intermediate page state for no gameplay benefit.

**Rationale**: The resolution IS the declaration. One atomic write handles both. No Declare button, no extra conditional mutation, no intermediate UI state. Gate finding #1 correction.

### Decision 4: Resolve is a single-row UPDATE with absolute-values snapshot (no SQL expressions)

**Choice**: The resolve mutation computes the complete next row client-side — including `eventsResolved = current.eventsResolved + 1` as an absolute value — and sends all columns as explicit values in a single `.update({ current_overall: N, current_age: N, stage: S, current_team_id: T, events_resolved: N, pending_event: null, updated_at: now })` call. The WHERE clause includes `pending_event->>'id' = $eventId`.

**Why not `events_resolved = events_resolved + 1` in SQL**: Supabase JS `.update()` maps to `UPDATE ... SET col = $1` with positional parameters. It cannot express SQL expressions like `SET events_resolved = events_resolved + 1`. Server-side computation requires either an RPC (rejected) or a raw SQL string (bypasses Supabase's parameterized query builder, also rejected). The absolute-value approach avoids both.

**Why the absolute increment is safe**: The single `.update()` chain translates to one `UPDATE ... SET ... WHERE ... RETURNING *` SQL statement. Postgres executes it atomically. The `pending_event->>'id' = $eventId` guard acts as an optimistic concurrency lock:
1. Two concurrent resolvers both read `events_resolved = 5` and `pending_event.id = "abc123"`.
2. Resolver A's UPDATE matches the WHERE clause, sets `events_resolved = 6` and `pending_event = NULL`. Commits.
3. Resolver B's UPDATE arrives. `pending_event` is now NULL, so `pending_event->>'id' = 'abc123'` fails. The WHERE clause matches 0 rows.
4. `.maybeSingle()` returns `null`. The hook invalidates + throws `StaleCareerError`.

Only one resolver can ever commit its computed `events_resolved` value. The absolute value is always `old_count + 1` relative to the committed state because the guard ensures exactly one serializer wins. This is standard optimistic concurrency — the event-id is the version token.

**Alternatives considered**: PL/pgSQL RPC that increments `events_resolved` server-side — rejected by no-RPC constraint. Two separate UPDATEs — violates atomicity and is explicitly excluded.

### Decision 5: Lifecycle WHERE filters are cooperative-client guards, not enforcement

**Choice**: The conditional UPDATEs embed lifecycle preconditions in their WHERE clauses (`stage = 'draft'`, `pending_event IS NULL`, etc.). RLS enforces only `user_id = auth.uid()`.

**What these guards are**: Cooperative-client concurrency and data-consistency helpers. They prevent a well-behaved client (our hooks) from committing stale state after a race, and they reject mallformed requests from UI glitches or copy-paste errors. They work alongside `.maybeSingle()` + `StaleCareerError` to keep the page in sync with the database.

**What these guards are NOT**: A security boundary. A malicious owner using their own authenticated Supabase client (bypassing our application hooks) could issue any UPDATE on their own `career_saves` rows — RLS only restricts by `user_id`, and there is no column-level restriction on `stage` or `pending_event`. The lifecycle WHERE clauses would not prevent a direct `.update({ stage: 'nba' }).eq('id', rowId)` from a custom client, because the custom client simply omits those WHERE guards.

**This is accepted for MVP**. The integrity model trusts the application hooks to express the correct guards, and RLS to scope ownership. There is no RPC, no service-role toggling, and no DB-level state-machine enforcement beyond the four inline CHECK constraints. Future hardening could add a `CHECK` that couples `stage` transitions to `pending_event` nullity via a trigger, but that is deferred.

### Decision 6: Draft pick pre-validation is a UX safety net, not a security boundary

**Choice**: `usePickDraftTeam` zod-validates `{ teamId, offerIds }` and checks `offerIds.includes(teamId)` before issuing the UPDATE. The SQL `WHERE stage = 'draft'` catches races.

**Rationale**: The pre-update check catches stale form values, copy-paste mistakes, and out-of-band UI glitches before they reach the database. It is not a security boundary — a malicious owner can compute their own offers and bypass it. The authoritative guard is RLS (`user_id = auth.uid()`) scoping the row to the authenticated user. Documented explicitly with this decision.

---

## Concurrency Model: How the Event-ID Guard Works

All four conditional mutations share the same optimistic-concurrency pattern:

```
1. Hook reads current save (from TanStack Query cache or fresh fetch)
2. Hook computes the next absolute state client-side
3. Hook issues ONE .update({...}).eq("id", careerId).eq("user_id", userId).{conditional guards}.select().maybeSingle()
4. Supabase translates the chain to a single SQL UPDATE...WHERE...RETURNING * statement
5. Postgres executes the UPDATE atomically
6. .maybeSingle() returns the updated row (winner) or null (loser)
7. On null: hook invalidates TanStack Query cache and throws StaleCareerError
8. Page catches the error, shows a transient "refreshing..." state
9. TanStack Query refetches useCareerSave → page re-renders with current state
```

**Why this is sufficient**: The WHERE clause on `pending_event->>'id'` is the version check. Any concurrent mutation that changes `pending_event` (set it, clear it, change its id) breaks the guard for the loser. The loser gets a null return and cleanly backs off — no partial state, no lost updates, no double increments.

**Why no `FOR UPDATE` / `SERIALIZABLE` is needed**: There is exactly one mutable row per career save, and all concurrent mutations to that row contend on the same WHERE predicates. The event-id guard serializes concurrent resolves; the `pending_event IS NULL` guard serializes concurrent rolls; the `stage = 'draft'` guard serializes concurrent draft picks. None of these need explicit row locking because the guard predicates themselves create mutual exclusion.

---

## Data Flow

```
User ──→ create form ──→ useCreateCareerSave ──→ INSERT (current_overall=60) ──→ redirect /career/[id]
                                                                                       │
                                                                                       ▼
┌─────────────────────────────── Career Dashboard Page ────────────────────────────────────────────┐
│                                                                                                   │
│  useCareerSave(careerId) ──→ SELECT career_saves WHERE id = $1                                   │
│       │                                                                                           │
│       ├── pendingEvent === null && stage === 'college' ──→ "Advance Season" button                │
│       │       │                                                                                   │
│       │       └── useRollEvent ──→ UPDATE SET pending_event = $json                              │
│       │                            WHERE pending IS NULL AND stage <> 'retired'                   │
│       │                            .maybeSingle() → null? → invalidate + StaleCareerError         │
│       │                                                                                           │
│       ├── pendingEvent !== null ──→ Inline event card (college or NBA template)                   │
│       │       │                                                                                   │
│       │       └── useResolveEvent ──→ applyChoice(save, optionIndex) → absolute snapshot         │
│       │                               UPDATE SET overall, age, stage, team_id,                    │
│       │                                 events_resolved(=save.eventsResolved+1), pending=NULL     │
│       │                               WHERE pending IS NOT NULL AND pending->>'id' = $eventId    │
│       │                               .maybeSingle() → null? → invalidate + StaleCareerError     │
│       │                                                                                           │
│       ├── stage === 'draft' && pendingEvent === null ──→ 3-team draft picker                     │
│       │       │                                                                                   │
│       │       └── usePickDraftTeam ──→ zod validate + pre-check offerIds.includes(teamId)        │
│       │                               UPDATE SET team_id, stage='nba'                            │
│       │                               WHERE stage='draft' AND pending IS NULL                     │
│       │                               .maybeSingle() → null? → invalidate + StaleCareerError     │
│       │                                                                                           │
│       ├── stage === 'nba' && pendingEvent === null ──→ "Advance" + "Retire" buttons               │
│       │       │                                                                                   │
│       │       ├── useRollEvent (NBA event)                                                        │
│       │       └── useRetireCareer ──→ UPDATE SET stage='retired'                                 │
│       │                               WHERE stage='nba' AND pending IS NULL                       │
│       │                               .maybeSingle() → null? → invalidate + StaleCareerError     │
│       │                                                                                           │
│       └── stage === 'retired' ──→ Legacy summary (final overall, age, college,                    │
│                                    NBA team, events_resolved)                                     │
│                                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

All mutations invalidate `["career-saves"]` and `["career-saves", careerId]`. TanStack Query refetches the read hook automatically. The page never issues a read after a mutation; the query-driven read is the single source of truth.

---

## Layer Boundaries

```
┌───────────────────────────────────────────────────────────┐
│ Presentation (src/app)                                     │
│  page.tsx (+25 add), career/page.tsx, career/[id]/page.tsx │
│  Reads: useCareerSaves, useCareerSave                      │
│  Mutates: useCreateCareerSave, useRollEvent,               │
│           useResolveEvent, usePickDraftTeam, useRetireCareer│
│  Depends on: Application hooks, domain consts/types         │
├───────────────────────────────────────────────────────────┤
│ Application (src/application/hooks/career)                  │
│  useCareer.ts — 7 hooks, 1 file                            │
│  Imports: SupabaseCareerSaveRepository (for reads),          │
│           supabase client (for conditional UPDATEs),         │
│           domain types, zod schemas, pure functions          │
│  Does NOT import: stores, components, routes                 │
├───────────────────────────────────────────────────────────┤
│ Infrastructure (src/infrastructure/repositories)            │
│  SupabaseCareerSaveRepository.ts                            │
│  Implements: CareerSaveRepository (getById, getByUserId,    │
│              create)                                        │
│  Delegates: snake↔camel → parseSupabaseRow (domain zod)     │
│  Does NOT: contain conditional UPDATE logic (that's hooks)  │
├───────────────────────────────────────────────────────────┤
│ Domain (src/domain)                                         │
│  entities/CareerSave.ts — entity, types, zod schemas,       │
│                           applyChoice, parseSupabaseRow,    │
│                           resolveEventInputSchema,          │
│                           draftPickInputSchema              │
│  constants/career-events.ts — 4 templates, selectEvent,     │
│                                pickNbaOffers                │
│  repositories/CareerSaveRepository.ts — interface           │
│  Depends on: nothing external (pure domain)                 │
└───────────────────────────────────────────────────────────┘
```

Dependency direction: Presentation → Application → Infrastructure+Domain. Domain depends on nothing.

---

## Schema (1 Table, 1 RLS, 1 Index, 4 CHECKs)

```sql
-- career_saves: 1-table aggregate; no FK to players/contracts.
-- FK to teams is read-only display (ON DELETE SET NULL).
-- current_overall has no DEFAULT; application always sets it explicitly (60 on create).
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

**CHECKs** (4 inline, column-level):
| Column | CHECK | Allowed |
|--------|-------|---------|
| `current_age` | `>= 18` | 18+ |
| `current_overall` | `BETWEEN 40 AND 99` | 40–99 inclusive |
| `events_resolved` | `>= 0` | non-negative |
| `stage` | `IN ('college','draft','nba','retired')` | one of four |

**RLS**: Single `FOR ALL` policy, no nested table. Owner-scoped by `user_id = auth.uid()`.

**Index**: `idx_career_saves_user_id` on `user_id` — covers `getByUserId` reads.

**Notable absence**: No DB CHECK on `pending_event` JSONB shape. Zod `pendingEventSchema` validates on every read. A Postgres `CHECK (jsonb_typeof(pending_event) = 'object' OR pending_event IS NULL)` is deferred.

---

## TypeScript / Zod Shapes

### Const Objects and Types (src/domain/entities/CareerSave.ts)

```typescript
import { z } from "zod";

// ── Const objects (existing project pattern: GAME_STATUS) ──

export const CAREER_STAGE = {
  COLLEGE: "college",
  DRAFT: "draft",
  NBA: "nba",
  RETIRED: "retired",
} as const;
export type CareerStage = (typeof CAREER_STAGE)[keyof typeof CAREER_STAGE];

export const CAREER_POSITION = {
  PG: "PG",
  SG: "SG",
  SF: "SF",
  PF: "PF",
  C: "C",
} as const;
export type CareerPosition = (typeof CAREER_POSITION)[keyof typeof CAREER_POSITION];

export const COLLEGES = [
  "Duke",
  "Kentucky",
  "North Carolina",
  "Kansas",
  "UCLA",
] as const;
export type College = (typeof COLLEGES)[number];

// ── Reusable enum tuple for z.enum() calls ──

const careerStageValues = Object.values(CAREER_STAGE) as [CareerStage, ...CareerStage[]];
const careerPositionValues = Object.values(CAREER_POSITION) as [CareerPosition, ...CareerPosition[]];
```

### CareerEventEffects and PendingCareerEvent

```typescript
export interface CareerEventEffects {
  overallDelta: number;
  ageDelta: number;
  nextStage?: CareerStage;       // only set on college event options
  teamId?: string;                // not set in this MVP
}

export interface PendingCareerEvent {
  id: string;                     // deterministic: hash(saveId + age + overall)
  kind: "rivalry" | "injury" | "decision";
  prompt: string;
  options: Array<{
    label: string;
    effects: CareerEventEffects;
  }>;
}
```

### CareerSave Entity

```typescript
export interface CareerSave {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  position: CareerPosition;
  college: College;
  currentAge: number;
  currentOverall: number;
  eventsResolved: number;
  stage: CareerStage;
  currentTeamId: string | null;
  pendingEvent: PendingCareerEvent | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Zod Schemas — Sub-schemas

```typescript
// ── CareerEventEffects ──

const careerEventEffectsSchema = z.object({
  overallDelta: z.number().int(),
  ageDelta: z.number().int(),
  nextStage: z.enum(careerStageValues).optional(),
  teamId: z.uuid().optional(),
});

// ── PendingCareerEvent (JSONB shape validated on every read) ──

export const pendingEventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["rivalry", "injury", "decision"]),
  prompt: z.string().min(1),
  options: z.array(
    z.object({
      label: z.string().min(1),
      effects: careerEventEffectsSchema,
    })
  ).length(2),                   // exactly 2 choices per event
});
```

### Zod Schemas — Supabase Row (snake_case, used by parseSupabaseRow)

```typescript
export const supabaseRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  position: z.enum(careerPositionValues),     // z.enum, not z.string().min(1) — catches corruption
  college: z.enum(COLLEGES),                   // z.enum, not z.string().min(1)
  current_age: z.number().int().min(18),
  current_overall: z.number().int().min(40).max(99),
  events_resolved: z.number().int().min(0),
  stage: z.enum(careerStageValues),
  current_team_id: z.uuid().nullable(),
  pending_event: pendingEventSchema.nullable(),
  created_at: z.string(),        // ISO timestamp from Supabase
  updated_at: z.string(),
});
```

### Zod Schemas — CareerSave (camelCase, with Date objects)

```typescript
export const careerSaveSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  position: z.enum(careerPositionValues),
  college: z.enum(COLLEGES),
  currentAge: z.number().int().min(18),
  currentOverall: z.number().int().min(40).max(99),
  eventsResolved: z.number().int().min(0),
  stage: z.enum(careerStageValues),
  currentTeamId: z.uuid().nullable(),
  pendingEvent: pendingEventSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
```

### Zod Schemas — Input Schemas

```typescript
// ── Create (user-facing) ──

export const createCareerSaveInputSchema = z.object({
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  position: z.enum(careerPositionValues),
  college: z.enum(COLLEGES),
});
export type CreateCareerSaveInput = z.infer<typeof createCareerSaveInputSchema>;

// ── Resolve event (hook-facing, validated before mutationFn logic) ──

export const resolveEventInputSchema = z.object({
  optionIndex: z.number().int().min(0).max(1),  // 2 options max; refine in applyChoice if needed
});
export type ResolveEventInput = z.infer<typeof resolveEventInputSchema>;

// ── Draft pick (hook-facing, validated on entry to usePickDraftTeam) ──

export const draftPickInputSchema = z.object({
  teamId: z.uuid(),
  offerIds: z.array(z.uuid()).min(3).max(3),    // exactly 3 offers
}).refine(
  (data) => new Set(data.offerIds).size === data.offerIds.length,
  { message: "offerIds must contain exactly 3 distinct UUIDs" }
);
export type DraftPickInput = z.infer<typeof draftPickInputSchema>;
```

### Pure Functions

```typescript
/**
 * Parses a raw Supabase row (snake_case, JSONB as object) into a CareerSave.
 * Delegates to supabaseRowSchema → manual camelCase mapping + Date coercion.
 * Throws ZodError on malformed pending_event or invalid enum values.
 */
export function parseSupabaseRow(row: unknown): CareerSave {
  const parsed = supabaseRowSchema.parse(row);
  return {
    id: parsed.id,
    userId: parsed.user_id,
    firstName: parsed.first_name,
    lastName: parsed.last_name,
    position: parsed.position,              // already validated as CareerPosition by z.enum
    college: parsed.college,                 // already validated as College by z.enum
    currentAge: parsed.current_age,
    currentOverall: parsed.current_overall,
    eventsResolved: parsed.events_resolved,
    stage: parsed.stage,
    currentTeamId: parsed.current_team_id,
    pendingEvent: parsed.pending_event,
    createdAt: new Date(parsed.created_at),
    updatedAt: new Date(parsed.updated_at),
  };
}

/**
 * Applies the chosen option's effects to the career save.
 * Clamps currentOverall to 40–99. Returns the fields to UPDATE.
 * Pure: no side effects, no DB access.
 *
 * Called by useResolveEvent to compute the absolute-value snapshot
 * that the single conditional UPDATE will write.
 */
export function applyChoice(
  save: CareerSave,
  optionIndex: number
): {
  currentAge: number;
  currentOverall: number;
  stage: CareerStage;
  currentTeamId: string | null;
} {
  const event = save.pendingEvent;
  if (!event) throw new Error("No pending event to resolve");
  if (optionIndex < 0 || optionIndex >= event.options.length) {
    throw new Error(`Invalid option index: ${optionIndex}`);
  }

  const effects = event.options[optionIndex].effects;
  const newAge = save.currentAge + effects.ageDelta;
  let newOverall = save.currentOverall + effects.overallDelta;
  // Clamp to DB CHECK range (40–99)
  newOverall = Math.max(40, Math.min(99, newOverall));

  return {
    currentAge: newAge,
    currentOverall: newOverall,
    stage: effects.nextStage ?? save.stage,
    currentTeamId: effects.teamId ?? save.currentTeamId,
  };
}
```

### Event Templates and Draft Offers (src/domain/constants/career-events.ts)

```typescript
import type { CareerStage, PendingCareerEvent, CareerEventEffects } from "@/domain/entities/CareerSave";
import { CAREER_STAGE } from "@/domain/entities/CareerSave";
import type { Team } from "@/domain/entities/Team";

export interface CareerEventTemplate {
  kind: PendingCareerEvent["kind"];
  prompt: string;
  appliesTo: CareerStage[];
  options: Array<{
    label: string;
    effects: CareerEventEffects;
  }>;
}

// 4 hardcoded templates: 1 college + 3 NBA
export const CAREER_EVENTS: CareerEventTemplate[] = [
  {
    kind: "rivalry",
    prompt: "Rival taunts you before the big game. How do you respond?",
    appliesTo: [CAREER_STAGE.COLLEGE],
    options: [
      {
        label: "Match his energy and dominate",
        effects: { overallDelta: 2, ageDelta: 1, nextStage: CAREER_STAGE.DRAFT },
      },
      {
        label: "Stay calm and let your game speak",
        effects: { overallDelta: 1, ageDelta: 1, nextStage: CAREER_STAGE.DRAFT },
      },
    ],
  },
  // ... 3 NBA templates (kind: "injury", "decision", "rivalry") with 2 choices each,
  // no nextStage (stage stays 'nba'), ageDelta=1, overallDelta in [-1, +2]
];

// ── Deterministic DJB2 hash (same as used by pickNbaOffers, kept consistent) ──

function hashDjb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Deterministically selects one event template for the current save state.
 * Filtered by stage, indexed by hash(saveId + age + overall).
 * Pure: same inputs → same event every time.
 */
export function selectEvent(
  saveId: string,
  currentAge: number,
  currentOverall: number,
  stage: CareerStage
): CareerEventTemplate {
  const eligible = CAREER_EVENTS.filter((e) => e.appliesTo.includes(stage));
  if (eligible.length === 0) {
    throw new Error(`No events available for stage: ${stage}`);
  }
  const seed = `${saveId}:${currentAge}:${currentOverall}`;
  const idx = Math.abs(hashDjb2(seed)) % eligible.length;
  return eligible[idx];
}

/**
 * Deterministically selects exactly 3 distinct NBA teams for draft offers.
 * Deduplicates the input catalog by team ID before shuffling.
 * Uses Fisher-Yates shuffle seeded by saveId hash. Stable across renders.
 * Throws if fewer than 3 unique teams exist in the catalog.
 * Post-condition: the returned offers have exactly 3 distinct team IDs.
 */
export function pickNbaOffers(saveId: string, teams: Team[]): Team[] {
  // Deduplicate by team ID — Fisher-Yates must operate over a deduplicated catalog
  const uniqueTeams = Array.from(
    new Map(teams.map((t) => [t.id, t])).values()
  );
  if (uniqueTeams.length < 3) {
    throw new Error(
      `Need at least 3 unique teams for draft offers, got ${uniqueTeams.length} (${teams.length} total entries)`
    );
  }

  // Deterministic Fisher-Yates shuffle over the deduplicated catalog
  const shuffled = [...uniqueTeams];
  let seed = hashDjb2(saveId);
  for (let i = shuffled.length - 1; i > 0; i--) {
    // ponytail: simple LCG to advance — sufficient for deterministic shuffle, not crypto
    seed = ((seed * 1103515245 + 12345) & 0x7fffffff);
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const offers = shuffled.slice(0, 3);
  // ponytail: post-shuffle invariant — dedup guarantees distinct IDs, verified anyway
  const ids = new Set(offers.map((t) => t.id));
  if (ids.size !== 3) {
    throw new Error("Draft offers must have exactly 3 distinct team IDs");
  }
  return offers;
}
```

---

## Repository Signatures

### Domain Interface (src/domain/repositories/CareerSaveRepository.ts)

```typescript
import type { CareerSave } from "@/domain/entities/CareerSave";
import type { CreateCareerSaveInput } from "@/domain/entities/CareerSave";

export interface CareerSaveRepository {
  getById(id: string): Promise<CareerSave | null>;
  getByUserId(userId: string): Promise<CareerSave[]>;
  create(input: CreateCareerSaveInput & { userId: string }): Promise<CareerSave>;
}
```

No `update`, no `softDelete`. The conditional mutations are hook-level supabase calls. This is deliberate — the `exploration.md` section that had `CareerSaveRepository.update` as a repository method is superseded by this design.

### Infrastructure Implementation (src/infrastructure/repositories/SupabaseCareerSaveRepository.ts)

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareerSave, CreateCareerSaveInput } from "@/domain/entities/CareerSave";
import { parseSupabaseRow } from "@/domain/entities/CareerSave";
import type { CareerSaveRepository } from "@/domain/repositories/CareerSaveRepository";

export class SupabaseCareerSaveRepository implements CareerSaveRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getById(id: string): Promise<CareerSave | null> {
    const { data, error } = await this.client
      .from("career_saves")
      .select("*")
      .eq("id", id)
      .maybeSingle();                    // returns null on 0 rows (vs .single() which throws)
    if (error) throw new Error(error.message);
    if (!data) return null;
    return parseSupabaseRow(data);       // zod-validated, no manual casting
  }

  async getByUserId(userId: string): Promise<CareerSave[]> {
    const { data, error } = await this.client
      .from("career_saves")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(parseSupabaseRow);
  }

  async create(
    input: CreateCareerSaveInput & { userId: string }
  ): Promise<CareerSave> {
    const row = {
      user_id: input.userId,
      first_name: input.firstName,
      last_name: input.lastName,
      position: input.position,
      college: input.college,
      current_overall: 60,              // initial overall — column is NOT NULL with no DB default
      // current_age (18), events_resolved (0), stage ('college') have DB defaults
    };
    const { data, error } = await this.client
      .from("career_saves")
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return parseSupabaseRow(data);
  }
}
```

**Key differences from `SupabaseGameRepository`**: Uses `parseSupabaseRow` (zod-validated) instead of manual `mapToEntity` casting. No `mapToRow` helper — the insert maps fields directly. `.maybeSingle()` instead of `.single()` on `getById` to return `null` cleanly. `current_overall` is always set explicitly to 60 on create.

---

## Query Keys and Seven Hooks

All hooks live in a single file: `src/application/hooks/career/useCareer.ts`.

### Query Keys

| Hook | Query Key | Type |
|------|-----------|------|
| `useCareerSaves()` | `["career-saves"]` | query |
| `useCareerSave(careerId)` | `["career-saves", careerId]` | query |
| `useCreateCareerSave()` | — | mutation, invalidates `["career-saves"]` |
| `useRollEvent(careerId)` | — | mutation, invalidates `["career-saves", careerId]` |
| `useResolveEvent(careerId)` | — | mutation, invalidates `["career-saves", careerId]` |
| `usePickDraftTeam(careerId)` | — | mutation, invalidates `["career-saves", careerId]` |
| `useRetireCareer(careerId)` | — | mutation, invalidates `["career-saves", careerId]` |

### Hook Signatures

```typescript
// ── Reads ──

export function useCareerSaves(): UseQueryResult<CareerSave[]>;
export function useCareerSave(careerId: string | null): UseQueryResult<CareerSave | null>;

// ── Mutations (all useMutation, all return CareerSave on success) ──

export function useCreateCareerSave(): UseMutationResult<
  CareerSave,
  Error,
  CreateCareerSaveInput
>;

export function useRollEvent(careerId: string): UseMutationResult<
  CareerSave,
  Error,
  void
>;

export function useResolveEvent(careerId: string): UseMutationResult<
  CareerSave,
  Error,
  ResolveEventInput
>;

export function usePickDraftTeam(careerId: string): UseMutationResult<
  CareerSave,
  Error,
  DraftPickInput
>;

export function useRetireCareer(careerId: string): UseMutationResult<
  CareerSave,
  Error,
  void
>;
```

### Conditional UPDATEs in Detail

**useRollEvent** — mutationFn:
```
1. Get current save (from query cache or repository.getById)
2. template = selectEvent(save.id, save.currentAge, save.currentOverall, save.stage)
3. Build PendingCareerEvent snapshot: { id: hash(save.id + age + overall), ...template }
4. Validate snapshot with pendingEventSchema.parse()
5. UPDATE career_saves SET pending_event = $snapshot, updated_at = now()
     WHERE id = $careerId AND user_id = auth.uid()
       AND pending_event IS NULL AND stage <> 'retired'
   .select().maybeSingle()
6. null? → invalidate + throw StaleCareerError
```

**useResolveEvent** — mutationFn (with `{ optionIndex }`):
```
1. Validate input with resolveEventInputSchema.parse()
2. Get current save (from query cache or repository.getById)
3. if (!save.pendingEvent) throw new Error("No pending event to resolve")
4. effects = applyChoice(save, optionIndex)                        // pure
5. eventsResolved = save.eventsResolved + 1                        // absolute value, client-computed
6. UPDATE career_saves SET
     current_overall = effects.currentOverall,                    // absolute
     current_age     = effects.currentAge,                        // absolute
     stage           = effects.stage,                             // absolute
     current_team_id = effects.currentTeamId ?? null,             // absolute
     events_resolved = eventsResolved,                            // absolute (save.eventsResolved + 1)
     pending_event   = null,
     updated_at      = new Date().toISOString()
   WHERE id = $careerId AND user_id = auth.uid()
     AND pending_event IS NOT NULL
     AND pending_event->>'id' = save.pendingEvent.id              // event-id version guard
   .select().maybeSingle()
7. null? → invalidate + throw StaleCareerError
```

**Why the event-id guard serializes concurrent resolves**: Only one UPDATE can match the guard after another resolver has cleared `pending_event`. The absolute `eventsResolved` value is correct because the winning resolver is the only one whose write commits. See "Concurrency Model" section above.

**usePickDraftTeam** — mutationFn (with `{ teamId, offerIds }`):
```
1. Validate input with draftPickInputSchema.parse()
2. Pre-check: if (!offerIds.includes(teamId)) throw new InvalidTeamChoiceError(teamId)
3. UPDATE career_saves SET
     current_team_id = teamId,
     stage           = 'nba',
     updated_at      = now()
   WHERE id = $careerId AND user_id = auth.uid()
     AND stage = 'draft' AND pending_event IS NULL
   .select().maybeSingle()
4. null? → invalidate + throw StaleCareerError
```

**useRetireCareer** — mutationFn:
```
1. UPDATE career_saves SET
     stage      = 'retired',
     updated_at = now()
   WHERE id = $careerId AND user_id = auth.uid()
     AND stage = 'nba' AND pending_event IS NULL
   .select().maybeSingle()
2. null? → invalidate + throw StaleCareerError
```

### Zero-Row Behavior (shared across all conditional mutations)

```typescript
if (!data) {
  // 0-row update — another mutation already changed the row.
  // Invalidate the read query so the next render refetches.
  await queryClient.invalidateQueries({ queryKey: ["career-saves", careerId] });
  throw new StaleCareerError(
    "Career save is in a stale state; the page will refetch the current state."
  );
}
```

The hook does NOT issue a read. TanStack Query refetches `useCareerSave` automatically after invalidation. The page catches `StaleCareerError` and shows a transient state.

### Error Classes

```typescript
export class StaleCareerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleCareerError";
  }
}

export class InvalidTeamChoiceError extends Error {
  constructor(teamId: string) {
    super(`Invalid team choice: ${teamId}`);
    this.name = "InvalidTeamChoiceError";
  }
}
```

---

## Page State Branches

### 1. Landing Page: `src/app/(protected)/page.tsx` (+25 LOC, additive)

Add a `Card` linking to `/career` above the existing GM game list. No refactor of existing content.

**States**: Only the existing page states (loading, error, empty, games list). The new card is always rendered.

### 2. Career List + Create: `src/app/(protected)/career/page.tsx` (75 LOC, new)

```
┌─ states ──────────────────────────────────────────────────────────────┐
│ isLoading ──→ Spinner                                                 │
│ error      ──→ Error card with retry button                           │
│ !saves || saves.length === 0 ──→ Empty state + create form            │
│ saves.length > 0          ──→ Save list + "New Career" button         │
│                                                                       │
│ Create form (inlined, no /career/new route):                          │
│   Fields: firstName, lastName, position (select), college (select)    │
│   Zod validated on submit via createCareerSaveInputSchema             │
│   Submit: useCreateCareerSave.mutate(input)                           │
│   On success: router.push(`/career/${data.id}`)                       │
│   isPending: button shows "Creating..."                               │
└───────────────────────────────────────────────────────────────────────┘
```

### 3. Career Dashboard: `src/app/(protected)/career/[careerId]/page.tsx` (90 LOC, new)

```
┌─ states (checked in this order after loading/error) ─────────────────┐
│                                                                      │
│ isLoading ──→ Spinner                                                │
│ error      ──→ Error card                                            │
│ staleError ──→ "Refreshing current state..." banner                  │
│                                                                      │
│ save.pendingEvent !== null ──→                                       │
│   ┌─ Inline event card ────────────────────────────────────┐        │
│   │ prompt text                                              │        │
│   │ Option A button → useResolveEvent({ optionIndex: 0 })   │        │
│   │ Option B button → useResolveEvent({ optionIndex: 1 })   │        │
│   │ isPending → both buttons disabled, "Resolving..."       │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│ save.stage === 'draft' && pendingEvent === null ──→                  │
│   ┌─ Draft picker ─────────────────────────────────────────┐        │
│   │ pickNbaOffers(save.id, teams) → 3 team cards            │        │
│   │ Each card: "Sign with [Team]" button                    │        │
│   │ onClick: usePickDraftTeam({ teamId, offerIds })         │        │
│   │ isPending → buttons disabled                            │        │
│   └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│ save.stage === 'college' && pendingEvent === null ──→                │
│   "Advance Season" button → useRollEvent()                           │
│   isPending → "Advancing..."                                         │
│                                                                      │
│ save.stage === 'nba' && pendingEvent === null ──→                    │
│   "Advance Season" button → useRollEvent()                           │
│   "Retire" button → useRetireCareer()                                │
│   isPending → buttons disabled                                       │
│                                                                      │
│ save.stage === 'retired' ──→ Legacy block                            │
│   Player name, final overall, age, college, NBA team,                │
│   events_resolved. No buttons; terminal state.                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Stat sheet** (shown when `pendingEvent === null` and `stage !== 'retired'`): displays `firstName lastName`, position, college, age, overall, current team, `events_resolved` count. Always visible on the dashboard regardless of stage branch.

**Invalid team scenario**: If the team catalog has fewer than 3 unique IDs after dedup (empty database, or a catalog consisting entirely of duplicates), `pickNbaOffers` throws. The page should catch this and render an error card — but in normal operation the teams table is always populated with 30 distinct teams by the data ingestion script. This is a startup-edge-case guard, not a normal page branch.

---

## Testing Strategy

### File: `tests/domain/entities/CareerSave.test.ts` (~53 LOC)

| # | Test | What | Assertions |
|---|------|------|------------|
| 1 | `applyChoice` applies college effects | GIVEN a CareerSave with a pending college rivalry event, WHEN option 0 is chosen, THEN `currentOverall` increases by 2, `currentAge` increases by 1, `stage` becomes 'draft' | 3 |
| 2 | `applyChoice` clamps overall to 40 (floor) | GIVEN a save with `currentOverall = 40` and an event with `overallDelta = -5`, WHEN resolved, THEN `currentOverall` is 40 (clamped, not 35) | 1 |
| 3 | `applyChoice` clamps overall to 99 (ceiling) | GIVEN a save with `currentOverall = 98` and an event with `overallDelta = +5`, WHEN resolved, THEN `currentOverall` is 99 (clamped, not 103) | 1 |
| 4 | `parseSupabaseRow` valid row | GIVEN a valid snake_case Supabase row with a well-formed `pending_event` JSONB, WHEN parsed, THEN returns a `CareerSave` with correct dates, camelCase fields, and parsed pendingEvent | 1 |
| 5 | `parseSupabaseRow` malformed JSONB | GIVEN a row with `pending_event: { kind: "bogus", prompt: 123 }`, WHEN parsed, THEN `supabaseRowSchema.parse` throws `ZodError` | 1 |
| 6 | `selectEvent` deterministic | GIVEN the same `(saveId, age, overall, stage)`, WHEN called twice, THEN returns the same `CareerEventTemplate` both times | 1 |
| 7 | `selectEvent` filters by stage | GIVEN `stage = 'college'`, WHEN `selectEvent` is called, THEN the returned template's `appliesTo` includes `COLLEGE` (not an NBA-only template) | 1 |
| 8 | `pickNbaOffers` returns 3 distinct teams | GIVEN a list of 30 teams and a `saveId`, WHEN called, THEN returns exactly 3 teams with unique `id` values | 2 |
| 9 | `pickNbaOffers` deterministic | GIVEN the same inputs, WHEN called twice, THEN returns identical team arrays (same order) | 1 |
| 10 | `pickNbaOffers` rejects catalog with <3 unique IDs | GIVEN a team list where fewer than 3 unique IDs remain after dedup (too few total entries, or duplicates that collapse to <3 unique), WHEN called, THEN throws | 1 |
| 11 | `draftPickInputSchema` rejects duplicate `offerIds` | GIVEN an input with duplicate UUIDs in `offerIds` (e.g. `['a', 'a', 'b']`) and a valid `teamId`, WHEN `draftPickInputSchema.parse(input)` is called, THEN throws `ZodError` | 1 |

**Test pattern**: Follows `tests/domain/entities/Game.test.ts` — vitest, `describe`/`it`, no test framework fixtures.

**Not in scope for MVP**: Hook integration tests, conditional UPDATE SQL tests, mutation stale-state tests, page rendering tests.

---

## 3-PR Boundaries (Reviewable Chunks, All < 400 LOC)

### PR1 — Domain + Tests (~280 LOC)

**Files**: `scripts/schema.sql` (modify +35), `src/domain/entities/CareerSave.ts` (new 125), `src/domain/constants/career-events.ts` (new 45), `src/domain/repositories/CareerSaveRepository.ts` (new 20), `tests/domain/entities/CareerSave.test.ts` (new 53), `src/domain/entities/index.ts` (modify +1), `src/domain/repositories/index.ts` (modify +1)

**Subtotal**: 35 + 125 + 45 + 20 + 53 + 1 + 1 = **280 LOC** ✓ (< 400)

**What**: Schema with 4 CHECKs and 1 RLS. Entity, all zod schemas (including resolveEventInputSchema, draftPickInputSchema with .refine() for distinct UUIDs, pendingEventSchema), `parseSupabaseRow`, `applyChoice`. Event library with `selectEvent` + `pickNbaOffers` (Fisher-Yates shuffle over deduplicated catalog, distinct-offer IDs validated). Repository interface (no `update`). 11 unit tests covering `applyChoice` progression+clamping, `parseSupabaseRow` valid/malformed, `selectEvent` deterministic+filtered, `pickNbaOffers` distinct+stable+reject-catalog-with-fewer-than-3-unique-IDs (too-small and duplicate-heavy), `draftPickInputSchema` rejects-duplicate-offerIds. 2 barrel exports.

**Demoability**: Not asserted. No UI, no hooks. Domain code is testable via `bun vitest run`.

### PR2 — Infra + Hooks (251 LOC)

**Files**: `src/infrastructure/repositories/SupabaseCareerSaveRepository.ts` (new 100), `src/application/hooks/career/useCareer.ts` (new 150), `src/infrastructure/repositories/index.ts` (modify +1)

**Subtotal**: 100 + 150 + 1 = **251 LOC** ✓ (< 400)

**What**: Supabase implementation with `parseSupabaseRow` delegation + `current_overall: 60` on create. 7 hooks in one file: 2 reads, 5 mutations. All conditional UPDATEs use absolute-value `.update()` + `.maybeSingle()` + zero-row invalidation. Resolve computes `eventsResolved = save.eventsResolved + 1` client-side and passes it as an absolute value. Draft pick hook zod-validates input then pre-checks `offerIds.includes(teamId)`. Error classes (`StaleCareerError`, `InvalidTeamChoiceError`). Barrel export.

**Demoability**: Not asserted. No pages yet. Hooks are testable from a temporary page or React DevTools.

### PR3 — Presentation (190 LOC)

**Files**: `src/app/(protected)/page.tsx` (modify +25), `src/app/(protected)/career/page.tsx` (new 75), `src/app/(protected)/career/[careerId]/page.tsx` (new 90)

**Subtotal**: 25 + 75 + 90 = **190 LOC** ✓ (< 400)

**What**: Landing card (strictly additive). Career list + create form (inlined, no `/career/new`). Career dashboard with inline event card, draft picker, advance/retire buttons, and legacy block. All 7 page state branches covered. `StaleCareerError` caught and shown as transient banner. `pickNbaOffers` called from dashboard to compute offer list.

**Demoability**: Full end-to-end flow: create → college resolve → draft pick → NBA loop → retire.

---

## What is NOT in the MVP (Deferred)

See `exploration.md` § "What is NOT in the MVP" for the full 27-item list. Key design-affecting deferrals:

| Deferred | Concrete design impact |
|----------|----------------------|
| No `career_events` / separate event history table | Single JSONB column. No FK, no second RLS. |
| No salary / skills / potential columns | `CareerSave` has no `salary`, `skills`, or `potential` fields. |
| No custom save title | `firstName lastName` is the save identifier. |
| No `/career/new` route | Create form inlined on the list page. |
| No `/career/[id]/event` route | Event card rendered inline on the dashboard. |
| No `/career/[id]/layout.tsx` | Single page component, no layout nesting. |
| No Zustand `useCareerCreateStore` | Form state managed locally in the page component via `useState`. |
| No `PendingCareerEvent` DB CHECK | Postgres `CHECK (jsonb_typeof(pending_event) = 'object')` deferred; Zod catches on read. |
| No soft delete / `useDeleteCareerSave` | Hard delete out of scope for MVP. |
| No RPC for any mutation | Four conditional UPDATEs expressed as Supabase JS `.update()` chains. |
| No `current_potential` / `rookie_salary` / `skills` columns | `CareerSave` fields are fixed to the 12 columns defined above. |
| No DB-level state-machine enforcement | Only the 4 inline CHECK constraints. Lifecycle guards are cooperative-client. |
| No generic `Partial<CareerSave>` update | `CareerSaveRepository` has no `update` method. |

---

## Reconciliation with the LOC Forecast (Gate-Corrected)

| # | File | LOC | Type | Change from prior |
|---|------|-----|------|-------------------|
| 1 | `scripts/schema.sql` | +35 | modify | — |
| 2 | `src/domain/entities/CareerSave.ts` | 125 | new | +5 (resolveEventInputSchema, draftPickInputSchema with .refine() for distinct UUIDs, z.enum position/college) |
| 3 | `src/domain/constants/career-events.ts` | 45 | new | +10 (selectEvent, Fisher-Yates pickNbaOffers) |
| 4 | `src/domain/repositories/CareerSaveRepository.ts` | 20 | new | — (no `update`, consistent with design) |
| 5 | `src/infrastructure/repositories/SupabaseCareerSaveRepository.ts` | 100 | new | — (current_overall: 60 added inline) |
| 6 | `src/application/hooks/career/useCareer.ts` | 150 | new | — (absolute snapshot in resolve, zod validates inputs) |
| 7 | `src/app/(protected)/page.tsx` | +25 | modify | — |
| 8 | `src/app/(protected)/career/page.tsx` | 75 | new | — |
| 9 | `src/app/(protected)/career/[careerId]/page.tsx` | 90 | new | — |
| 10 | `tests/domain/entities/CareerSave.test.ts` | 53 | new | +18 → +23 (selectEvent ×2, pickNbaOffers ×3, draftPickInputSchema duplicate rejection) |
| 11 | `src/domain/entities/index.ts` | +1 | modify | — |
| 12 | `src/domain/repositories/index.ts` | +1 | modify | — |
| 13 | `src/infrastructure/repositories/index.ts` | +1 | modify | — |
| | **Total** | **~721** | | +33 → +43 from gate corrections + validator findings |

**PR breakdown**:
- PR1: 35 + 125 + 45 + 20 + 53 + 1 + 1 = **280** ✓ (< 400)
- PR2: 100 + 150 + 1 = **251** ✓ (< 400)
- PR3: 25 + 75 + 90 = **190** ✓ (< 400)

Headroom: ~79 LOC under the 800-line hard stop. All PRs under the 400-LOC high-review-tier threshold.

---

## Open Questions

None. All design decisions are resolved in this document. The gate corrections are incorporated. The exploration resolved the 9 original gate findings. The proposal passed its gate.
