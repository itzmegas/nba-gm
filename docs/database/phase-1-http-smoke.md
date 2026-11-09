# Phase 1 HTTP smoke: synthetic Auth and repository game access

**PASS: two authorized complete HTTP cycles on 2026-11-06.** This is the first
integration slice, not complete Phase 1 or security clearance. The four active
migrations are installed on TEST. Do not reset or replay them before this test.

**Current TEST state (2026-11-09): expanded canonical HTTP slice PASS, including
cleanup.** Owner roster/effective/compatibility repository reads, canonical
salaries 1,000,000 and 2,000,000, unchanged canonical rows, and isolation passed.
All nine countable tables ended empty and both Auth fixtures returned 404.
Owner runtime view was empty for the new game; unrelated runtime reads were
empty and anonymous access was denied (401/42501). Populated runtime creation,
precedence, and global runtime-table emptiness remain UNVERIFIED.

The user authorized necessary synthetic Phase 1 HTTP cycles on the existing TEST
using `.env.test.local`, including exact fixture cleanup, without confirmation per
cycle. No DEV, schema, grants, migrations, resets or denied-RPC crash probe.

Historical read-only reconciliation before the completed cleanup confirmed exactly one synthetic game
(`ae7fc204-f00c-4113-a7c5-438efa3d8ddd`), one synthetic team, two synthetic
players, two roster states, two canonical identities/agreements/seasons, 14 draft
picks and 14 game-pick inventory rows; no legacy contract rows. The owner account
exists and the secondary account is absent. Runtime-contract table contents remain
UNVERIFIED because service-role SELECT is denied. This historical residue was subsequently removed.

**Cleanup sequence, explicitly authorized on 2026-11-09:** exact preflight
matched; canonical seasons, agreements, identities and roster states each deleted
with HTTP 204 and verified zero; owner Auth DELETE returned HTTP 200 and lookup
404; game/inventory cascade checks were zero. The initial batched player DELETE
was safely rejected by the local guard before fetch. After correcting and testing
that guard, a fresh scoped preflight confirmed only the two fixture players, 14
picks and team remained. Their exact deletes each returned HTTP 204. Final checks
returned zero for all nine accessible fixture tables and 404 for both Auth IDs.
Runtime-contract table contents remain UNVERIFIED; no SQL or runtime-table query
was used.

The authorized read-only check of `game_player_attributes` for the exact game and
two fixture players returned HTTP 200 with zero rows. Local migration 022 shows
the canonical identity and agreement tables each have `ON DELETE RESTRICT` FKs
to roster states, which explains the failed state deletion. A changed cleanup
order must remove only the exact dependent canonical rows first and requires
separate authorization.

## Observed results

Both cycles ran `bun run --no-env-file scripts/test-supabase-integration.ts wmtezjoitjmjynyvkyke`
and exited 0, with no API RPC invocations.

| Scenario | Both cycles | Observable evidence |
| --- | --- | --- |
| Auth health | PASS | GET health: 200 |
| PostgREST health | PASS | Anonymous SDK HEAD `teams`: 200 |
| Empty fixture baseline | PASS | Four application table counts zero; both Auth fixture IDs 404 |
| Synthetic accounts and sign-in | PASS | Admin creation 200; password token requests 200 for both users |
| Team and repository game creation | PASS | POST team/game: 201; repository GET and round-trip: 200/matching state |
| Owner listing | PASS | Repository returns exactly the created game |
| Unrelated-user and anonymous game reads | PASS | HTTP 200 with no visible game; unrelated repository listing empty |
| Automatic pick inventory | PASS | Authenticated HEAD count 14 |
| Bounded fixture cleanup | PASS | Auth DELETE 200; scoped pick/team DELETE 204; all four table counts zero |
| Final Auth cleanup | PASS | Additional read-only check after cycle two: both fixture IDs 404 |

The first preflight attempt stopped at OpenAPI-root GET 401 **before any fixture
creation**. Anonymous and service-role SDK table HEAD requests both returned 200.
The runner was corrected to test ordinary PostgREST access through the SDK rather
than requiring publishable-key access to OpenAPI. The unnecessary root endpoint
is now rejected by its request guard; the new regression test was observed failing
before that correction and passing afterward. This was a runner-health prerequisite
defect, not an observed failure of table access or synthetic credentials.

Local validation: 10 focused tests (five safety, five existing game-repository),
TypeScript and Biome pass. The private dedicated configuration was created with
mode 0600 and is gitignored; `.env.local` was not modified. User selected direct
verification without subagents; no independent security review is claimed.

## Scope and authorization

The runner accepts only TEST `wmtezjoitjmjynyvkyke`, never DEV. Obtain explicit
authorization for this exact target, credential source and lifecycle before
running it. It creates and deletes fixtures; permission to inspect is insufficient.

| Operation | Exact scope |
| --- | --- |
| Auth setup | Two confirmed synthetic accounts; no confirmation email is sent |
| Fixture accounts | `f1000000-0000-4000-8000-000000000001` and `f1000000-0000-4000-8000-000000000002` |
| Synthetic emails | `courtside-phase1-owner@example.invalid`, `courtside-phase1-other@example.invalid` |
| Team | `f2000000-0000-4000-8000-000000000001`, synthetic `nba_id = -900001` |
| Sign-in | Two password sessions using the publishable key, not the service role |
| Game | One initializing modern 2026 game, created/read through `SupabaseGameRepository` |
| Trigger effects | Fourteen draft picks for the synthetic team, 2026–2032, and fourteen game inventory rows |
| Isolation | Unrelated-user repository read and unrelated/anonymous HTTP table reads |
| Cleanup | Delete only accounts successfully created by this run, with fixture metadata checked again; their games/inventory cascade. Delete only this team's 2026–2032 picks and the run-created team |

Fixture identities and business values are deterministic; passwords are generated
in memory per run and never logged or saved. Database-generated game/pick IDs and
timestamps are not deterministic. No NBA/provider import, real data copy, reset,
history repair, schema change, RPC invocation or proposal application is included.
The existing game-insert trigger runs as part of the normal PostgREST write.

## Dedicated configuration

After authorization, create the gitignored `.env.test.local` manually or through
an explicitly approved credential-copy operation. Do not uncomment or change DEV
variables. Do not commit or display real keys.

```dotenv
TEST_SUPABASE_URL="https://wmtezjoitjmjynyvkyke.supabase.co"
TEST_PUBLISHABLE_KEY="<TEST publishable key>"
TEST_SERVICE_ROLE_KEY="<TEST server-only service-role key>"
```

This file must contain only those three assignments. Use `--no-env-file` to stop
Bun from automatically loading application environment files. The runner parses
the dedicated file explicitly; it never falls back to application environment variables, ambient
credentials, a linked CLI project or `TEST_DATABASE_URL`. Service-role usage stays
in the server-side Bun script; it is not a browser configuration.

## Run after explicit lifecycle approval

```sh
bun run --no-env-file test tests/infrastructure/supabase/integrationSafety.test.ts tests/infrastructure/repositories/SupabaseGameRepository.test.ts tests/infrastructure/repositories/SupabasePlayerStateRepository.test.ts tests/infrastructure/contracts/SupabaseGameContractRepository.test.ts tests/infrastructure/repositories/SupabaseContractRepository.test.ts
bun run --no-env-file scripts/test-supabase-integration.ts wmtezjoitjmjynyvkyke
bun biome check
```

Run the remote command twice only if repeat-run creation/deletion is authorized.
A second successful run establishes repeatability, not broader gameplay coverage.

The initial game smoke preflight required four empty application tables. The
expanded roster slice preflights nine globally countable tables (`games`, `teams`,
`draft_picks`, `game_pick_inventory`, `players`, `game_player_states`,
`game_contract_identities`, `game_contract_agreements`, `game_contract_seasons`)
and both fixture account IDs absent. Existing accounts are never adopted or
overwritten. On a complete run, cleanup verifies all nine countable tables are
empty and both fixture accounts return 404 inside the runner itself.

Requests are restricted to the exact TEST origin and a small Auth/table allowlist.
Cross-origin requests, redirects, RPC paths, schema operations, unfiltered deletes,
other user IDs and unrelated team/pick deletions are rejected before fetch. Logs
contain only operation labels plus HTTP method/path/status, never tokens, passwords,
keys, request bodies, query strings or raw errors.

## Failure handling and evidence boundaries

- On a failure, stop and inspect the reported stage. There is no reset or sweep mode.
- A timeout after a server-side write can leave a fixture without a confirmed local
  success response. The runner does not delete uncertain/pre-existing resources.
  Reconcile that exact fixture separately with explicit authorization.
- A cleanup failure is FAIL, not PASS. Dependent team/pick deletion is skipped when
  fixture user cleanup fails; this preserves evidence rather than broadening deletion.
- PASS requires observed HTTP responses, real Auth sessions, repository persistence,
  isolation checks and successful cleanup. Local guard tests are not that evidence.
- These game-read checks do not establish isolation for contracts or other tables.
  The baseline retains known broad-read/TRUNCATE grants. No security PASS is claimed.
- Roster seeding, canonical contracts, trades, free agency, simulation and rejected
  write rollback remain UNVERIFIED. Expand fixtures and authorization for each slice.
- The denied-RPC crash probe remains prohibited; PostgreSQL 17.6 is not fix evidence.

The progress and consent log is [the feature task](../../odd/tasks/phase-1-supabase-integration.md).

## Next bounded slice — roster and modern contract projection

**Implemented and HTTP verified for canonical projection and roster reads.**
The latest cycle exited 0 with complete cleanup. Earlier failed attempts and
their residue are historical; they do not describe the current TEST state.

Use two additional fixed synthetic players in the existing one-team/one-game
lifecycle. Reserved IDs `f3000000-0000-4000-8000-000000000001` and
`f3000000-0000-4000-8000-000000000002`; agreements use fixed IDs
`f4000000-0000-4000-8000-000000000001`/`…0002`; no real NBA/ESPN identity.

| Fixture | Count | Purpose |
| --- | ---: | --- |
| `players` | 2 | Synthetic static identities, no live import |
| `game_player_states` | 2 | Both owned by the synthetic team in the run-created game |
| `game_contract_identities` | 2 | Canonical identity coverage for both players |
| `game_contract_agreements` | 2 | Standard-cap-and-matching agreements |
| `game_contract_seasons` | 2 | One known 2026–27 salary per agreement: 1,000,000 and 2,000,000 |
| `game_runtime_contracts` | Deferred | TEST PostgREST grants INSERT only to `postgres`; direct service-role fixture INSERT returns 403/42501 |

The active migration's `guard_game_player_state_writes` trigger explicitly
rejects authenticated/anonymous direct roster INSERTs (`P0001: Direct roster
insertion is not permitted`). Seed the two synthetic roster states through the
server-side fixture role, then exercise owner-session reads through
`SupabasePlayerStateRepository`; do not bypass the trigger or mislabel direct
authenticated insertion as a supported application workflow. Owner assertions
also use `SupabaseGameContractRepository` for canonical/effective reads and
`SupabaseContractRepository` for compatibility projection. The runner asserts
exactly two roster players and canonical salaries 1,000,000 and 2,000,000.
Runtime-contract precedence is deferred until a permitted application write
workflow is identified. Canonical agreement/season rows are
snapshotted before and compared after reads; no legacy `contracts` row may be
created (admin count stays zero for the game). Static
`SupabasePlayerRepository.getByTeamId` is not the gameplay roster source.

Canonical identity/agreement/season rows have no authenticated INSERT policy;
the server-side admin session sets them up, matching the real materialization
boundary. The owner session writes `games` through its
repository; roster state fixture creation is server-side because the integrity
trigger forbids direct client inserts despite table INSERT grants/RLS policy.
This test proves owner roster visibility/read behavior, not a client
roster-creation workflow.

Isolation: unrelated authenticated session reads five game-scoped relations
directly (expect zero visible rows, no error) and via the roster and contract
repositories (empty arrays). Anonymous reads are expected to return zero for
`game_player_states` but SQLSTATE `42501` for canonical contract and runtime
tables whose SELECT grant excludes `anon`; record that as denied access, not a
successful empty read. The runner records HTTP status/code per request.
Static `players`/`teams` retain baseline public read; that exposure stays
documented, not asserted as isolation. No denied RPC calls are needed or used.

The fetch guard now enforces, beyond destination/route/method/redirect/timeout:
per-role write routes (admin: team/players/canonical/roster fixture setup; owner:
games; reader: none); direct runtime-contract INSERTs are outside the allowlist.
POST body validation keeps every insert
inside the synthetic fixture identities (no NBA/ESPN ids, no foreign
players/agreements/teams, UUID game references, owner-only `games.user_id`), and
player deletes scoped to the two fixture IDs. Unit tests cover each rejection.

Preflight requires nine globally countable empty tables (`games`, `teams`, `draft_picks`,
`game_pick_inventory`, `players`, `game_player_states`, `game_contract_identities`,
`game_contract_agreements`, `game_contract_seasons`) and both fixture account IDs
absent; an empty `players` table doubles as the player-ID absence guard.
`game_runtime_contracts` cannot be globally counted or written by the runner's
service-role client through this TEST PostgREST API: INSERT is granted only to
`postgres`, and SELECT is granted to `authenticated` but not service_role/anon.
The authenticated security-invoker view is readable; runtime-contract creation
through an application workflow remains UNVERIFIED. No SQL or grant change is part
of this test. Cleanup order:
validate the run-created game's owner, team and synthetic name; delete exact
canonical seasons → agreements → identities → roster states, checking zero rows
after every step; then run-created Auth users and their game cascade, the two
run-created static players, scoped 2026–2032 picks and the run-created team.
Cleanup requests are bound to the current game's UUID, not a historical game.
Any child delete/count failure prevents dependent Auth/static deletes. Final in-runner
checks: all nine countable tables count zero and both fixture accounts return 404.

Provider snapshots/materialization, a second team and trades, free-agency offers,
simulation, and rejected-write rollback are subsequent T5 increments. This small
projection fixture does not establish provider acquisition/materialization or
full gameplay. Each broader lifecycle needs its own exact authorization.

Current execution authorization covers necessary Phase 1 synthetic cycles on
`wmtezjoitjmjynyvkyke`, reading only existing `.env.test.local` HTTP credentials,
in-memory password sessions and exact fixture cleanup. No SQL, schema/grant
changes, migrations, history repair, DEV, configuration copy or crash probe.

### Runtime creation boundary

`SupabaseFreeAgencyRepository.submitOffer` invokes `submit_free_agency_offer`,
which creates a pending offer, not a runtime contract. Runtime rows are created
by internal offer resolution; the active migration revokes authenticated access
to `resolve_free_agency_offer` and `resolve_due_free_agency_market`. Canonical
snapshot materialization instead requires 30 team versions and does not create
runtime contracts. Do not bypass grants or repeat the known denied-RPC probe.
The current two-player canonical fixture cannot prove populated runtime behavior.
