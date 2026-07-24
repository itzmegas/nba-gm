# Player Career Mode Specification

## Purpose

Define the isolated, one-table MVP for creating and advancing a fictional player career from landing entry through one college event, the draft, NBA events, retirement, and a legacy summary.

## Requirements

### Requirement: Landing entry

The protected landing page MUST provide an additive entry to Player Career without changing GM-mode behavior or requiring another route for creation.

#### Scenario: Enter career mode

- GIVEN an authenticated owner is on the protected landing page
- WHEN the owner selects the Player Career entry
- THEN the system navigates to `/career`
- AND the GM tables, list, and actions remain unchanged

### Requirement: Create and validate a fictional player

The system MUST create a career save containing the owner's first name, last name, position, college, current overall exactly 60, age 18, stage `college`, zero resolved events, no team, and no pending event. The user MUST NOT provide the initial overall. Inputs MUST be validated with Zod before persistence, and the save MUST have no custom title or canonical player reference.

#### Scenario: Create a valid career

- GIVEN the owner submits valid first name, last name, position, and one supported college
- WHEN the create action succeeds
- THEN exactly one owner-scoped career save is created with the specified identity and the defined initial state

#### Scenario: Persist the fixed initial state

- GIVEN the owner submits valid creation fields
- WHEN the create action succeeds
- THEN `currentOverall` is exactly 60, `currentAge` is 18, `stage` is `college`, `eventsResolved` is 0, `currentTeamId` is null, and `pendingEvent` is null

#### Scenario: Reject invalid creation input

- GIVEN a submitted name, position, or college is missing or outside the supported domain values
- WHEN the create action is validated
- THEN the action rejects the input and MUST NOT persist a career save

### Requirement: Owner isolation

The system MUST persist career saves in the single `career_saves` aggregate and MUST enforce owner isolation with RLS keyed to the authenticated user. Career operations MUST NOT write to `players`, `contracts`, `game_player_states`, or `teams`.

#### Scenario: Owner reads only owned careers

- GIVEN two authenticated owners each have career saves
- WHEN either owner lists or loads career saves
- THEN only that owner's rows are returned

#### Scenario: Cross-owner mutation is unavailable

- GIVEN an owner knows another owner's career identifier
- WHEN the owner attempts any career mutation
- THEN RLS prevents the mutation and no other owner's row changes

### Requirement: College event resolves directly to draft

The system MUST provide exactly one deterministic college event with two choices. Each choice MUST advance age by one, apply its defined overall effect, and transition the save directly from `college` to `draft`; resolving the event MUST be the draft declaration.

#### Scenario: Resolve the college event

- GIVEN a college-stage save has an immutable pending college event
- WHEN the owner selects either valid choice
- THEN the selected effect is applied
- AND age increases by one
- AND stage becomes `draft`
- AND the pending event is cleared
- AND `events_resolved` increases by one in the same operation

#### Scenario: No separate declaration path

- GIVEN a college event has been resolved
- WHEN the dashboard renders the save
- THEN it shows the draft offer selection
- AND it does not show a separate Declare for the Draft action

### Requirement: Deterministic draft offers

The system MUST deduplicate the read-only team catalog by team identifier before selection, reject a catalog with fewer than three unique team identifiers, and deterministically derive exactly three distinct NBA team offers from the career save identifier. The draft-pick input MUST contain exactly three offer identifiers and MUST reject duplicate offer identifiers before the update.

#### Scenario: Same career produces stable offers

- GIVEN the same draft-stage save and unchanged team catalog
- WHEN draft offers are derived more than once
- THEN the same three team identifiers are returned in the same order

#### Scenario: Pick an offered team

- GIVEN a save is in `draft` with no pending event and three displayed offers
- WHEN the owner selects one of those offers
- THEN the save enters stage `nba` with the selected team identifier

#### Scenario: Reject a non-offered team

- GIVEN a draft-stage save displays three offer identifiers
- WHEN the client submits a team identifier not included in those offers
- THEN the mutation rejects before issuing its update
- AND the career save remains unchanged

#### Scenario: Reject a duplicate-ID catalog

- GIVEN the team catalog has many entries but fewer than three unique team identifiers after deduplication
- WHEN draft offers are derived
- THEN the function rejects the catalog

#### Scenario: Reject duplicate offer input

- GIVEN the draft-pick input contains duplicate offer identifiers
- WHEN the mutation input is validated
- THEN the mutation rejects before issuing its update
- AND the career save remains unchanged

### Requirement: NBA event loop

The system MUST provide three deterministic NBA event templates, each with two choices and pure-data effects. Advancing an eligible NBA save MUST select one event deterministically from the save identifier, current age, and current overall; NBA event resolution MUST keep stage `nba`.

#### Scenario: Roll an NBA event

- GIVEN an NBA-stage save has no pending event
- WHEN the owner advances the season
- THEN exactly one deterministic NBA event snapshot is persisted
- AND the save remains in stage `nba`

#### Scenario: Resolve an NBA event

- GIVEN an NBA-stage save has a pending NBA event
- WHEN the owner selects a valid choice
- THEN its effects are applied with overall clamped to 40–99
- AND age changes according to the choice
- AND stage remains `nba`
- AND the event is cleared
- AND `events_resolved` increases by one

### Requirement: Immutable pending-event snapshot

The system MUST store the complete selected event, including its identifier, prompt, kind, and choices, as a nullable pending-event snapshot. The snapshot MUST be used for resolution rather than reselecting a template.

#### Scenario: Resolve from the stored snapshot

- GIVEN a pending event snapshot exists
- WHEN the event library changes after the event was rolled
- THEN resolution uses the stored prompt, choices, and effects
- AND it does not silently substitute a newly selected event

#### Scenario: Do not roll twice

- GIVEN a non-retired save already has a pending event
- WHEN the owner advances the season again
- THEN no second pending event is created
- AND the existing snapshot remains unchanged

### Requirement: Deterministic roll and atomic idempotent resolve

Roll, resolve, draft pick, and retirement MUST use narrow conditional single-row updates. Resolve MUST compute the absolute `eventsResolved` value as `validatedCurrentSnapshot.eventsResolved + 1` on the client and send that value in the same conditional row update as the effects, pending-event clear, and next stage. It MUST NOT require a SQL expression, RPC, or raw SQL. A resolve MUST be idempotent and guarded by the pending event identifier.

#### Scenario: Duplicate resolve is harmless

- GIVEN one request has successfully resolved event identifier `E`
- WHEN the same request is submitted again for `E`
- THEN the conditional update affects zero rows
- AND the effects and `events_resolved` are not applied a second time

#### Scenario: Stale event loses a race

- GIVEN two tabs attempt to resolve the same pending event
- WHEN the first conditional update succeeds
- THEN the second update affects zero rows because the event is cleared
- AND the second path invalidates the career query and reports stale state

#### Scenario: Resolve uses an absolute client-computed count

- GIVEN a validated current snapshot has `eventsResolved = 5` and a pending event
- WHEN the owner resolves the event
- THEN the single conditional update sends `eventsResolved = 6` as an absolute value
- AND no SQL increment expression or RPC is required

### Requirement: Repository and lifecycle mutation boundaries

The `CareerSaveRepository` contract MUST expose only read/list/create operations: `getById`, `getByUserId`, and `create`. It MUST NOT expose generic update or deletion operations. Lifecycle writes MUST remain narrow hooks for roll, resolve, draft pick, and retirement.

#### Scenario: Repository exposes no generic lifecycle write

- GIVEN the career repository contract is consumed by application code
- WHEN its operations are inspected
- THEN only `getById`, `getByUserId`, and `create` are available
- AND lifecycle writes are performed through their dedicated hooks

### Requirement: Cooperative lifecycle guards and owner isolation

Lifecycle `WHERE` predicates for stage, pending-event state, and event identifier MUST be treated as cooperative-client concurrency and data-consistency checks. RLS MUST enforce owner isolation by authenticated user. The MVP MUST document that an authenticated owner can bypass lifecycle filters through direct Supabase calls on their own row; this is an accepted limitation and MUST NOT be replaced with invented RPC or database state-machine enforcement.

#### Scenario: Lifecycle guard rejects a stale well-behaved client

- GIVEN a lifecycle row has changed before a hook submits its conditional update
- WHEN the hook's stage or pending-event guard matches zero rows
- THEN the hook reports stale state and invalidates the career query

#### Scenario: RLS remains the owner boundary

- GIVEN an authenticated owner attempts to mutate another owner's career row
- WHEN the direct Supabase operation is evaluated
- THEN RLS prevents access regardless of lifecycle filters

#### Scenario: Direct owner calls may bypass lifecycle filters

- GIVEN an authenticated owner calls Supabase directly for their own row
- WHEN the owner omits the application lifecycle predicates
- THEN the operation is not blocked by those predicates
- AND this accepted MVP limitation does not introduce an RPC or state-machine trigger

### Requirement: Stale conditional mutations refresh state

When a conditional mutation affects zero rows, the application MUST invalidate the career query and expose a stale-career error; it MUST NOT claim to have returned current state or perform a compensating generic update. The subscribed read query MUST refetch and the UI MUST expose a transient refreshing state.

#### Scenario: Stale action refreshes

- GIVEN a save changed in another tab before an action is submitted
- WHEN the conditional action affects zero rows
- THEN the career query is invalidated
- AND the UI shows a refreshing/error state
- AND the current save is obtained through the normal query refetch

### Requirement: Guarded retirement

The system MUST allow manual retirement only from `nba` with no pending event. Retirement MUST set stage to `retired` and MUST NOT be available from `college` or `draft`.

#### Scenario: Retire an NBA career

- GIVEN an NBA-stage save has no pending event
- WHEN the owner selects Retire
- THEN the save transitions to `retired`
- AND no new event can be rolled or resolved

#### Scenario: Reject premature retirement

- GIVEN a save is in `college` or `draft`, or has a pending event
- WHEN the owner attempts to retire
- THEN the conditional mutation affects zero rows
- AND the save remains unchanged

### Requirement: Legacy summary

The retired-career dashboard MUST show a compact legacy summary containing final overall, age, college, NBA team, and `events_resolved`. It MUST NOT require a separate history table.

#### Scenario: Display legacy

- GIVEN a save is retired
- WHEN the owner loads its dashboard
- THEN the defined five legacy values are displayed
- AND no event-history table is displayed

### Requirement: Database and row parsing invariants

The database MUST enforce age at least 18, overall 40–99, nonnegative `events_resolved`, and stages `college`, `draft`, `nba`, or `retired`. Zod MUST validate creation and mutation inputs at runtime, parse complete Supabase rows, and reject malformed pending-event JSONB rather than returning an invalid domain entity.

#### Scenario: Reject malformed persisted event

- GIVEN Supabase returns a career row whose pending event does not match the event schema
- WHEN the row crosses the infrastructure-to-domain boundary
- THEN parsing fails with a validation error
- AND no malformed career entity is exposed to the application

#### Scenario: Parse a valid persisted row

- GIVEN Supabase returns a valid snake-case career row with a well-formed pending event
- WHEN the row crosses the infrastructure-to-domain boundary
- THEN parsing returns a `CareerSave` with camel-case fields, `Date` values, and the parsed pending event

#### Scenario: Database rejects invalid state

- GIVEN a write attempts an invalid age, overall, event count, or stage
- WHEN the database evaluates the row
- THEN the write is rejected by the corresponding check constraint

### Requirement: Loading, error, and stale-refresh states

Career list and dashboard views MUST represent loading, ordinary error, and stale-refresh states. They MUST NOT render mutation controls as successful while the relevant query is loading or after an action has reported stale state.

#### Scenario: Initial load

- GIVEN a career list or dashboard query is pending
- WHEN the view renders
- THEN it shows a loading state instead of incomplete career data

#### Scenario: Read failure

- GIVEN a career query fails
- WHEN the view renders
- THEN it shows an error state and does not present the data as current

### Requirement: Focused validation contract

The focused validation contract MUST cover `applyChoice` progression and clamping; valid and malformed `parseSupabaseRow` results; deterministic and stage-filtered `selectEvent`; deterministic distinct `pickNbaOffers`; duplicate-ID catalog rejection; too-small catalog rejection; and `draftPickInputSchema` rejection of duplicate `offerIds` before the draft UPDATE. These validations MUST remain in scope for the MVP.

#### Scenario: Verify pure domain behavior

- GIVEN focused domain test inputs cover the listed valid and invalid cases
- WHEN the pure functions are tested
- THEN progression, floor-40 and ceiling-99 clamping, row parsing and rejection, deterministic stage-filtered event selection, deterministic exactly-three distinct offers, and duplicate `offerIds` rejection before the draft UPDATE are verified
- AND catalogs with fewer than three unique team IDs are rejected, including duplicate-heavy catalogs

### Requirement: GM-table isolation

The Player Career capability MUST be hermetic with respect to the GM aggregate. It MUST NOT create, update, delete, or otherwise integrate career data with GM players, contracts, game-player states, games, or cross-mode stores.

#### Scenario: Complete career flow leaves GM data unchanged

- GIVEN an owner creates, advances, drafts, and retires a career
- WHEN the flow completes
- THEN only the owner's career save and read-only team display are involved
- AND GM aggregate data is unchanged

## Explicit Non-Goals

The MVP MUST NOT include salary, skills matrices, potential, player history tables or history UI, multi-year college, real simulation, free agency, achievements, custom save titles, deletion or soft deletion, extra routes, extra stores, extra components, generic partial updates, custom RPCs, or cross-mode integration.

#### Scenario: Deferred feature request is out of scope

- GIVEN a request adds one of the listed non-goals
- WHEN the MVP is reviewed
- THEN the request is rejected as scope expansion and the approved one-table specification remains unchanged
