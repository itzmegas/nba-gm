# Modern Contract Trade Compatibility — Local Validation Report

**Recommendation: GO for further local validation; NO-GO for staging or production promotion.** The migration passed disposable PostgreSQL regression coverage and a fresh Supabase CLI replay. Platform-image behavior and SQL-side salary matching remain unverified or out of scope.

## Scope and safety

- Validated `supabase/migrations/20261104190000_modern_contract_trade_compatibility.sql` without expanding trade business rules.
- Database tests ran only in disposable local environments with synthetic data.
- No production/staging access, deployment, commit, or remote migration operation occurred.
- The active migration chain was replayed with the new migration. Proposals 057/058 remained outside the active CLI chain; a separate disposable PostgreSQL run tested the migration together with both proposals.
- The prohibited crashing anonymous-RPC probe was not run.

## Contract-source precedence

The migration preserves the existing legacy and runtime acceptance paths, then adds a narrowly scoped canonical branch:

1. Existing legacy contract evidence (`contracts`) remains accepted.
2. Existing runtime contract evidence (`game_runtime_contracts`) remains accepted and takes precedence over canonical salary projection in the TypeScript repository.
3. Canonical evidence is accepted only for a modern game when an agreement exists for the game/player, its cap treatment is `standard-cap-and-matching`, and a non-null salary exists for `games.season_year`.
4. Historical games do not use the new canonical branch. Canonical identity without a qualifying agreement and current-season salary is insufficient.

Trade ownership is taken from `game_player_states.team_id`; imported agreement team IDs remain provenance and are not rewritten. The SQL RPC validates contract presence, not salary matching.

## Regression matrix

| Case | Result | Evidence |
|---|---|---|
| Modern canonical-only player with known current-season salary | **PASS** | Trade transfers ownership; no legacy contract is created. |
| Missing current-season salary | **PASS** | Rejected; complete captured state is unchanged. |
| Missing agreement / identity-only coverage | **PASS** | Rejected; complete captured state is unchanged. |
| Excluded cap treatment | **PASS** | Rejected; complete captured state is unchanged. |
| No contract coverage | **PASS** | Rejected; complete captured state is unchanged. |
| Historical-era canonical exclusion | **PASS** | Canonical-only trade rejected; historical roster remains unchanged. |
| Legacy-only historical trade | **PASS** | Roster and legacy contract ownership transfer. |
| Runtime-only trade | **PASS** | Roster transfer succeeds; runtime terms remain unchanged. |
| Runtime plus canonical evidence | **PASS** | Runtime contract remains unchanged; repository tests verify runtime projection precedence. |
| Canonical plus legacy evidence | **PASS** | Trade succeeds; canonical records remain unchanged and legacy ownership transfers. |
| Duplicate player asset | **PASS** | Rejected; complete captured state is unchanged. |
| Invalid or wrong-owner player | **PASS** | Rejected; complete captured state is unchanged. |
| Cross-game player/pick | **PASS** | Rejected; complete captured state is unchanged. |
| Non-transferable or wrong-owner pick | **PASS** | Rejected; complete captured state is unchanged. |
| Multi-asset failure after a valid player asset | **PASS** | Roster ownership, contracts, picks, trade history, and snapshots match pre-state. |
| Repeat trade after ownership changes | **PASS** | Current roster owner governs transfer; imported agreement remains unchanged. |
| Concurrent trades with disjoint assets | **PASS** | Both calls complete; two trades and expected ownership changes are recorded. |
| Agreement and season records remain unchanged | **PASS** | Full rows compared before/after successful trades. |
| RPC security settings and grants | **PASS** | `SECURITY DEFINER`, constrained `search_path`, authenticated execution, anon/PUBLIC revoked. |
| Baseline without the migration | **PASS (expected failure)** | Reproduces `Player contract is missing` for canonical-only trade. |

The SQL regression fixture is `tests/infrastructure/supabase/modernContractTradeCompatibility.postgres.sql`. Concurrent coverage is in `scripts/test-supabase-step31.py`.

## Migration replay and checks

| Check | Result |
|---|---|
| `python3 scripts/test-supabase-step31.py --modern-contract-trade-compatibility` | **PASS** — 450-player season/postseason/offseason gameplay, SQL matrix, and concurrent trades. |
| `python3 scripts/test-supabase-step31.py` | **PASS** — migration plus inactive proposals in disposable PostgreSQL; revoked helper calls return `42501`. |
| `python3 scripts/test-supabase-step31.py --baseline` | **EXPECTED FAIL** at canonical-only trade, reproducing the defect. |
| `bunx --no-install supabase db reset --local --network-id courtside-baseline-step2-loopback` | **PASS** — applied `20260206190001_initial_schema.sql`, `20260206190014_enable_rls.sql`, `20261102170000_reconcile_legacy_through_056.sql`, then the trade migration. |
| `bunx --no-install supabase db lint --local --fail-on error --network-id courtside-baseline-step2-loopback` | **PASS** — warnings only, in unrelated existing functions. |
| Focused trade and contract repository tests | **PASS** — 33 tests. |
| `bun run typecheck` | **PASS**. |
| `bun biome check` | **PASS** — 450 files. |
| `git diff --check` | **PASS**. |
| `bun run test` | **PARTIAL** — 138/142 test files passed; 4 unrelated documentation `.cjs` files fail with “No test suite found”; 1,104 tests passed. |

## Security and atomicity

- The function retains `SECURITY DEFINER`, `search_path = pg_catalog, public`, its UUID/JSONB signature, and authenticated-only execution grants.
- Game, player-state, legacy-contract, and pick row locks remain in place.
- Exceptions roll back earlier mutations in the trade statement. The regression fixture compares roster ownership, legacy contracts, picks, executed trades, and asset snapshots before and after rejected trades.
- Canonical agreement, season, and runtime term records remain unchanged by transfers.

## Remaining risks and unverified items

- The SQL RPC does not enforce salary matching, hard caps, or roster limits; those remain TypeScript responsibilities. Direct RPC callers are not protected by those application checks.
- SQL tests verify source acceptance and immutable runtime terms; effective salary precedence is additionally covered by existing TypeScript repository tests, not calculated by the trade RPC.
- Supabase CLI replay validates migration application, not full Auth/PostgREST runtime behavior on the Supabase image.
- The known Supabase-image denied-RPC crash remains unresolved. Vanilla PostgreSQL permission checks do not establish behavior on that image; the prohibited crash probe was not repeated.
- The four full-suite failures are outside this migration and remain unresolved.

## Changed files

- `supabase/migrations/20261104190000_modern_contract_trade_compatibility.sql`
- `tests/infrastructure/supabase/step31-gameplay.sql`
- `tests/infrastructure/supabase/modernContractTradeCompatibility.postgres.sql` (new)
- `scripts/test-supabase-step31.py`
- `docs/database/modern-contract-trade-compatibility.md`
- `odd/tasks/modern-contract-trade-compatibility.md`
- `docs/database/modern-contract-trade-validation-report.md` (this report)

No application business rules, historical migrations, validated baseline, or active Supabase migration files other than the new trade migration were modified.
