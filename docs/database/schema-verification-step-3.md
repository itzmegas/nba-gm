# Step 3 — correction compatibility results

**NO-GO for staging promotion or production deployment. GO for continued local investigation.**
SQL contract-read isolation passes after 057, and 058 passes synthetic ownership checks.
Gameplay proof is partial: two legacy PostgreSQL suites fail, and a denied anonymous
RPC execution crashed the local PostgreSQL process. No production connection was used.

Evidence: 2026-11-04; base `d460a5b22130e1a443db0358fac6d07cb2145b30`.
Read [Step 2](schema-verification-step-2.md), [runbook](deployment-runbook.md),
and [Step 1](../SUPABASE_MIGRATION_RECONCILIATION_STEP_1.md) first.

## Security and integrity verdicts

| Scenario | Result |
|---|---|
| Baseline anonymous / cross-user contract SELECT | FAIL by design; both synthetic owners' rows exposed; negative control reproduced |
| Corrected anonymous contract/team/player SELECT | **PASS**: zero rows |
| Corrected owner SELECT, both users | **PASS**: exact expected contract UUID, not just row count |
| Corrected cross-user SELECT / UPDATE / DELETE | **PASS**: no foreign rows visible or mutable |
| Cross-user schedule and pick helper invocation | **PASS**: exact owner-guard refusal |
| Anonymous helper effective EXECUTE grants | **PASS**: all three false after 057; all three true before |
| Anonymous helper actual invocation | **UNAVAILABLE**: PostgreSQL process terminated with signal 11, not a clean permission-denied result |
| Cross-user INSERT / ownership reassignment rejection | **PASS**: authoritative-write trigger rejects P0001, not an assumed RLS 42501 |
| Service-role contract read/update, roster promotion, materialization | **PASS** |
| 058 valid existing rows / new historical contracts | **PASS** |
| 058 pre-existing NULL ownership | **PASS**: refuses exact expected error, no invented ownership/deletion |
| NULL insert after 058 | **PASS**: SQLSTATE 23502 and exact message |
| NULL update after 058 | **PASS**: service-role update rejects 23502 without changing fixture data |
| Lock contention, production-scale scan | Not tested |

057 removes only the three legacy permissive policies and explicit anon helper grants.
Authenticated catalog policies and owner-scoped contract policies remain; service access
is unchanged. 058 changes only legacy `contracts.game_id`, not modern game-contract copies.
No demonstrated proposal defect required revision. Both files remain byte-identical and inactive.

## Application impact inventory

All locations are repository-relative; SQL references identify final definitions in `scripts/schema.sql`.

| Application surface | Affected access and conclusion |
|---|---|
| `src/infrastructure/repositories/SupabaseTeamRepository.ts:41–69` | All three team reads require authenticated catalog access; retained |
| `src/infrastructure/repositories/SupabasePlayerRepository.ts:14–74` | All five player queries require authenticated catalog access; retained |
| `src/infrastructure/repositories/SupabaseContractRepository.ts:20–137,221–244` | Legacy ID/player/team/active/expiring/all reads and create/update/delete; reads already filter game, writes map gameId. Other users now receive empty results; getById/getByPlayerId map read errors to null |
| Same repository `:140–218`; `src/infrastructure/contracts/SupabaseGameContractRepository.ts:133–270` | Modern materialization sentinel/identity/agreement/season readers use separate owner-scoped tables; unchanged |
| `src/application/hooks/roster/useRoster.ts:23–40` | Composes team/player/contract repositories; authenticated owner path preserved |
| `src/application/contracts/materializeModernGameContracts.ts:259–265,399–408` | Embedded players/teams plus service-only materialize RPC; authenticated catalog reads retained |
| `src/application/ratings/materializeGamePlayerAttributes.ts:52` | Embedded players/teams requires authenticated catalog; retained |
| `src/application/roster/currentRosterRefresh.ts:237,298,315–322,348–351` | Authenticated teams read/seed and service-only promote_current_roster; SQL path passes |
| `src/application/hooks/games/useCreateGame.ts:77–124`; `src/app/api/roster-refresh/route.ts:46` | Authenticated seed, schedule and rollback RPCs; helper grants to authenticated remain |
| `src/infrastructure/repositories/SupabaseTradeRepository.ts:39` | execute_trade_transactional changes legacy ownership or runtime roster without rewriting modern snapshots; final-schema regression passes |
| `src/infrastructure/repositories/SupabaseFreeAgencyRepository.ts:179,239,251`; `src/app/api/free-agency/bootstrap/route.ts:48` | Market/list/offer RPCs and service import_initial_free_agents depend on player/contract evidence; market read passes, complete signing progression not established |
| `src/infrastructure/repositories/SupabaseOffseasonRepository.ts:34`, `SupabaseOffseasonContractRepository.ts:39,56`, `SupabaseOffseasonPlayerOptionRepository.ts:46`, `SupabasePlayerStateRepository.ts:19,33` (same directory) | Entry/preparation/options/release RPCs use legacy, canonical and runtime evidence. Owner checks/security-definer paths unchanged; entry/preparation pass on final schema, remaining assertions use migration-boundary suites |
| `src/application/hooks/simulation/useAdvanceDay.ts:18`, `useAdvanceRange.ts:62` | advance_simulation_day delegates final qualification/postseason/rating logic; terminal no-advance behavior passes, full corrected-season progression unproven |
| `scripts/verify-db.ts:12–87`, `scripts/seed-teams.ts:45–56` | Operational service-role queries/writes, not runtime; not executed because they consume ambient application environment |

SQL dependency roots: seed/picks/schedule `:779–985,1333–1369`; materialization `:1794–1976`;
trade `:2321–2402`; financial/market/release `:3910–4263,6577+`; rollback/ratings/promotion
`:4792–4935`; final simulation `:6221–6291`; offseason evidence `:6407–6456`.
No application RPC caller of seed_game_pick_inventory was found; game insertion invokes
the separate inventory trigger. Its trigger-function ACL and the immutability trigger ACL
remain outside 057: EXECUTE alone does not make a trigger function an ordinary RPC.
No required application edit was identified for authenticated owner workflows; unauthenticated
catalog consumers, if introduced externally, must authenticate rather than restore public reads.

## Observed checks

`PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-supabase-step3.py` runs synthetic probes
against the loopback-only reconstructed schema, wraps proposal bodies and fixtures in
rollback transactions, and checks all public application table-data/catalog hashes afterward.
It prints UNAVAILABLE for anonymous denied-RPC runtime proof; process exit 0 is not full approval.
It preserves ordinary proposal BEGIN/COMMIT files by stripping only their transaction wrappers.

| Check | Observed result |
|---|---|
| New final-schema baseline/corrected probes | PASS: access, legacy/modern/runtime trades, service roster promotion, authenticated creation/seed/schedule/picks, 30 modern estimated contracts and 30 historical contracts, offseason entry/preparation, market, terminal simulation |
| Differential workflow output | PASS: baseline/corrected creation/promotion/materialization stdout identical; both SQL runs exit 0 |
| Existing baseline proposal probes | PASS: access, helper ACLs, valid/invalid NULL data and rollback hashes |
| Supabase local pgTAP | PASS: 12 tests, original baseline behavior remains intact |
| Existing offseason entry/contracts/player-options runners | PASS: three suites including ownership, history and concurrency checks |
| Existing possession-engine / postseason-qualification runners | PASS; 50 parity scenarios, 18 clinch days, six transitions, three rollback checks reported for qualification |
| Existing free-agency pending/signing-context/signing/write-integrity | PASS: four suites; pending runner used scratch-only fixed-ID/root adaptation with isolation checks retained |
| Existing free-agency-days | FAIL: `Eligible candidates are missing player image identifiers`; later phases unverified |
| Existing player-attributes | FAIL: `Qualification requires 15 teams in each conference`; scratch-only fixed-ID/root adaptation retained checks |
| `bun run typecheck` | PASS |
| `bun run test` | 1,104 tests / 138 files pass; four docs CJS collections fail; Step 2 reported the same collection class, current run also reports missing docs data files |
| `bun biome check` | FAIL: existing `.engram/manifest.json` formatting; no fix applied |

The existing legacy runners operate on canonical migration boundaries, **not** on the
corrected final schema; do not confuse their passes with full corrected gameplay coverage.
Their failing code/fixtures are unchanged in this work. No proposal is applied by them.
The new fixture has one synthetic player per team and estimated salary classifications:
it proves database orchestration/ownership, not realistic full-roster sporting simulation,
observed provider-contract parsing, HTTP joins, sign-in or session handling.

## Remaining blockers and recommendation

1. Investigate the local PostgreSQL signal-11 failure before trusting denied-RPC execution.
   Two bounded attempts (caught PL/pgSQL call, then direct call) closed the connection;
   recovery completed and subsequent public data/catalog hashes matched. Root cause is unproven.
2. Repair or explicitly disposition the two failing legacy fixture suites separately, then
   prove full corrected simulation/free-agency progression with realistic synthetic rosters.
3. Add Auth/PostgREST/client end-to-end coverage; the rehearsal stack has no running API/Auth services.
4. Rehearse lock contention, backup/restore, staging rollout and current NULL counts with separate
   destination/session authorization. Nothing here authorizes staging or production writes.

**Staging promotion: NO-GO pending those proofs. Production: NO-GO.** No app source,
baseline, legacy migration, proposal or migration-history file was changed. No migration
was promoted, registered, pushed or repaired. RDD remains clone-locally disabled.

Independent verification: PARTIAL. Replayed the main probe in fresh external scratch,
confirmed all 73 protected files match the base, and independently checked rejected
cross-owner insert/reassignment and NULL update with complete public fixture snapshots.
Those boundary cases are now retained in the main runner. Historical suite results
were not independently rerun; exhaustive inventory and complete gameplay remain unproved.
