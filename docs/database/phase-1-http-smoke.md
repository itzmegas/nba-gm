# Phase 1 HTTP smoke: synthetic Auth and repository game access

**PASS: two authorized complete HTTP cycles on 2026-11-06.** This is the first
integration slice, not complete Phase 1 or security clearance. The four active
migrations are installed on TEST. Do not reset or replay them before this test.

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
bun run --no-env-file test tests/infrastructure/supabase/integrationSafety.test.ts tests/infrastructure/repositories/SupabaseGameRepository.test.ts
bun run --no-env-file scripts/test-supabase-integration.ts wmtezjoitjmjynyvkyke
bun biome check
```

Run the remote command twice only if repeat-run creation/deletion is authorized.
A second successful run establishes repeatability, not broader gameplay coverage.

Preflight requires empty `games`, `teams`, `draft_picks`, `game_pick_inventory`
and both fixture account IDs absent. Existing accounts are never adopted or
overwritten. Successful cleanup verifies all four application tables are empty.

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

**Prepared scope only; not implemented or remotely authorized.** Keep the initial
runner unchanged until the expanded lifecycle and its local guard tests are ready.
Do not repeat the completed smoke merely to reconfirm historical evidence.

Use two additional fixed synthetic players in the existing one-team/one-game
lifecycle. Reserve IDs `f3000000-0000-4000-8000-000000000001` and
`f3000000-0000-4000-8000-000000000002`; use no real NBA/provider identity.

| Fixture | Count | Purpose |
| --- | ---: | --- |
| `players` | 2 | Synthetic static identities, no live import |
| `game_player_states` | 2 | Both owned by the synthetic team in the run-created game |
| `game_contract_identities` | 2 | Canonical identity coverage for both players |
| `game_contract_agreements` | 2 | Standard-cap-and-matching agreements |
| `game_contract_seasons` | 2 | One known 2026–27 salary per agreement: 1,000,000 and 2,000,000 |
| `game_runtime_contracts` | 1 | Second player: 2026–27 simulated agreement at 3,000,000 |

Owner-session assertions must use `SupabasePlayerStateRepository` for roster
creation/read, `SupabaseGameContractRepository` for canonical/effective reads,
and `SupabaseContractRepository` for compatibility projection. Expect exactly
two roster players; first salary 1,000,000 from canonical coverage and second
3,000,000 from runtime precedence. Compare persisted canonical rows before/after
reads; no legacy `contracts` row should be created. Static
`SupabasePlayerRepository.getByTeamId` is not the gameplay roster source.

Use unrelated-user and anonymous sessions for direct table reads as well as
applicable repository reads. Capture HTTP status and visible IDs per relation;
repository exceptions/empty results alone do not prove isolation. Record broad
baseline exposure as FAIL against an isolation expectation, not a reason to
enable 057/058 or silently weaken assertions. No denied RPC calls are needed.

Before execution, extend preflight counts to every touched table, require both
player IDs absent, validate fixture payloads and narrowly scope new write routes.
The current fetch guard checks origin/method/path and delete filters, **not POST
body identities or service-role versus owner-session privileges**. Its unit
tests prove those implemented boundaries, not arbitrary fixture-write safety.
Add local rejection tests for new payloads/routes before widening the allowlist.

Cleanup must track confirmed creations, verify game-child cascades using HTTP,
then delete only the two run-created static players and existing scoped picks/team.
Verify all touched tables empty and both Auth IDs 404 in the runner itself.
Do not adopt uncertain writes, sweep tables, or turn a cleanup failure into PASS.
The existing runner's final empty-table checks do not themselves verify Auth 404;
that was an additional historical check after cycle two.

Provider snapshots/materialization, a second team and trades, free-agency offers,
simulation, and rejected-write rollback are subsequent T5 increments. This small
projection fixture does not establish provider acquisition/materialization or
full gameplay. Each broader lifecycle needs its own exact authorization.

Remote execution gate, once locally implemented/reviewed: request a single bounded
expanded lifecycle on `wmtezjoitjmjynyvkyke`, explicitly reading only the existing
`.env.test.local` TEST URL/public/service-role values, using in-memory synthetic
password sessions, the listed fixture writes/reads and exact cleanup. No SQL,
migrations, history repair, DEV, configuration copy or automatic second cycle.
