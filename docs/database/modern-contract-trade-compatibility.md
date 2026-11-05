# Modern contract trade compatibility — design and implementation status

**Status: implemented and locally validated; NO-GO for staging or production promotion.**
Status reconciled: 2026-11-05. The correction is in
`supabase/migrations/20261104190000_modern_contract_trade_compatibility.sql`.
The [local validation report](modern-contract-trade-validation-report.md) records
executed regression tests, migration replay, and remaining risks. This documentation
update does not rerun those checks or authorize remote application.

The sections below preserve the original 2026-11-04 investigation and design,
including its proposed test matrix and acceptance checklist. They are historical
requirements, not a current implementation backlog. For the environment strategy
and next steps, see the [development and testing plan](development-testing-plan.md).

## Original recommendation

Add modern canonical contract evidence to the existing
`execute_trade_transactional` contract-presence check through a new, independent
SQL migration. Do not create legacy contract copies or modify canonical agreements.
The existing TypeScript compatibility projection already supports canonical salaries.

This corrects `Player contract is missing`; it does **not** make salary matching
server-authoritative. Existing staging/production NO-GO conditions remain in force.

## Original scope and references

The original investigation was design-only. Preserve the validated baseline, historical
migrations, existing data, and separate security proposals. Do not weaken trade
validation or fabricate missing contract values.

Required context:

- [Step 3.1 validation](schema-verification-step-3-1.md)
- [Step 3 validation](schema-verification-step-3.md)
- [Deployment runbook](deployment-runbook.md)
- [NBA business rules](../NBA_BUSINESS_RULES.md)

Source line references below describe the inspected revision and may move later.

## Root cause before the correction and execution flow

1. The trade page constructs player assets from roster compatibility contracts
   (`src/app/(protected)/games/[gameId]/dashboard/trades/page.tsx:96-165`).
2. `SupabaseContractRepository` projects modern effective contracts, including
   canonical current-season salaries
   (`src/infrastructure/repositories/SupabaseContractRepository.ts:140-218`).
3. `TradeValidator` calculates incoming/outgoing salaries and post-trade payroll,
   then checks matching, roster size, and supplied hard-cap limits
   (`src/domain/services/TradeValidator.ts:83-178`).
4. `useTrades` calls `TradeEngine`, which validates by default and delegates
   execution (`src/application/hooks/trades/useTrades.ts:40-62`;
   `src/application/services/TradeEngine.ts:23-57`).
5. `SupabaseTradeRepository` sends player/pick identifiers to the RPC, not the
   salary figures calculated in TypeScript
   (`src/infrastructure/repositories/SupabaseTradeRepository.ts:35-66`).
6. Before the correction, the SQL function accepted contract evidence from `contracts` or
   `game_runtime_contracts`, but never `game_contract_agreements`. Canonical-only
   players therefore raised `Player contract is missing`
   (`scripts/schema.sql:2381-2386`).

The pre-correction definition is `scripts/schema.sql:2321-2423`, mirrored in
`supabase/migrations/20261102170000_reconcile_legacy_through_056.sql:907-1002`.
The compatibility migration supersedes it in the active chain; `scripts/schema.sql`
remains an unchanged legacy bootstrap artifact. The still earlier definition in
`scripts/schema.sql:845-940` is also superseded.
Step 3.1 recorded the failure with 450 canonical-only players
(`schema-verification-step-3-1.md:61-67`).

## Contract-source precedence

Canonical agreements are not universally authoritative across eras.

| Game context | Existing effective source / proposed compatibility rule |
|---|---|
| Historical `jordan` or `lebron` | The adapter reads legacy `contracts`; preserve historical behavior. |
| Modern with active runtime contract | Runtime terms override canonical terms. |
| Modern with canonical agreement and no active runtime | Use the known salary for `games.season_year`. |
| Modern player without canonical identity coverage or runtime | Preserve the existing legacy fallback. |
| Modern identity-only coverage, missing agreement, or missing current-season salary | Do not silently substitute legacy terms or invent values. |
| Modern with no effective entries and no canonical materialization | Preserve the existing whole-game legacy fallback. |
| Modern with materialization but no effective entries | Do not revive legacy contracts through the whole-game fallback. |

Evidence: `SupabaseContractRepository.ts:140-218,237-258` and
`src/infrastructure/contracts/SupabaseGameContractRepository.ts:105-130,151-249`.

Current ownership comes from `game_player_states.team_id`. The canonical
agreement's imported `team_id` is provenance, not necessarily the current owner.
Migration 022 removed the composite team linkage; canonical snapshots remain
immutable (`scripts/schema.sql:2202-2216,1135-1152`). Do not rewrite agreement team
IDs or reject repeat trades because imported team provenance is stale.

Canonical materialization is restricted to owned, initializing modern games and
the game's season (`scripts/schema.sql:1577-1601`). Season rollover is not
implemented (`docs/NBA_BUSINESS_RULES.md:565-589`); this proposal does not define it.

## Salary, cap, and eligibility

- For a canonical player, use the current-season salary, not an average, initial
  season salary, or remaining guaranteed amount.
- Count each player's effective salary once, assigned to the current roster owner.
- Runtime terms override canonical terms; do not sum both.
- Preserve existing legacy exclusions and release-cap-charge accounting. Release
  charges are not contract salary transferred with a player.
- A canonical identity alone is not sufficient evidence of a tradable contract.

Existing payroll SQL excludes runtime-covered players from canonical totals and
excludes canonical/runtime-covered players from legacy fallback
(`scripts/schema.sql:3963-3979`). The modern TypeScript adapter also selects one
effective source.

The proposed canonical SQL branch requires all of:

1. `games.season_era_id = 'modern'`.
2. An agreement for the same game and player.
3. `cap_treatment = 'standard-cap-and-matching'` on the associated classification.
4. A `game_contract_seasons` row for the current game season with non-null salary.

The treatment restriction is an explicit proposed defensive rule. Current
materialization creates agreements only for standard classifications
(`scripts/schema.sql:1702-1737`), but the effective TypeScript projection has no
explicit treatment filter. Regression fixtures must verify consistent behavior.
Missing salary remains unknown; it must not become zero through fallback.

Keep existing legacy/runtime acceptance paths unchanged in this narrowly scoped
fix. Their existing eligibility limitations are not evidence that every stored
contract row is universally valid.

## Atomicity, ownership, and draft picks

Preserve the function's existing transactional structure and checks:

- Game ownership and bilateral asset validation.
- Duplicate-asset and nonparticipant-sender rejection.
- Locks on the game, player state, applicable legacy contract rows, and picks.
- Current player ownership validation before transfer.
- Pick game/inventory identity, ownership, and `is_transferable` checks.
- Roster ownership transfer, legacy contract ownership updates where applicable,
  and trade history insertion within the same statement.

Exceptions propagate and roll back earlier statement mutations. Canonical and
runtime salary terms must remain unchanged by a transfer.
Evidence: `scripts/schema.sql:2347-2417`.

### Pre-existing gaps, not repaired by this proposal

- SQL does not enforce salary matching, roster size, or cap limits; those checks
  are performed in TypeScript. `TradeEngine` exposes `shouldValidate=false`.
- The SQL runtime evidence gate checks table presence, while effective runtime
  reads use `game_active_runtime_contracts`, filtering `released_at IS NULL`.
  That active view alone does not enforce current-season eligibility
  (`scripts/schema.sql:3788-3795`).

Do not claim that extending the evidence gate closes these trust gaps. Moving
matching to authoritative SQL or harmonizing all eligibility paths requires
separate scope and regression design.

## Required files and migration strategy

| Surface | Proposed change |
|---|---|
| `supabase/migrations/<timestamp>_modern_contract_trade_compatibility.sql` | Replace the effective RPC definition, preserving signature, locks, checks, privileges, and security configuration; add only the scoped canonical evidence branch. |
| `tests/infrastructure/supabase/step31-gameplay.sql` | Replace the expected known blocker with successful transfer and unchanged-canonical-state assertions. |
| SQL trade regression fixtures | Cover source combinations, invalid assets, rollback, and repeat/concurrent transfers. Reuse relevant coverage in `freeAgencyTradeSerialization.postgres.sql`. |
| `tests/infrastructure/repositories/SupabaseContractRepository.test.ts` | Verify effective salary precedence, current-owner projection, and no double counting. |
| `tests/domain/services/TradeValidator.test.ts` | Pin matching using canonical projected salary and retain existing limits. |
| Database validation documentation and runbook | Record new local evidence, migration ordering, and unresolved deployment blockers. |

No production TypeScript change is currently demonstrated necessary. Change it
only if regression evidence reveals a concrete projection mismatch.

The new migration must follow the active catch-up migration. It must remain
separate from inactive proposals 057/058 and must not rewrite the validated
baseline, historical migrations, or `scripts/schema.sql` bootstrap mirror.
See the runbook's [migration inventory](deployment-runbook.md#artifacts-and-regeneration)
and [separate correction proposals](deployment-runbook.md#proposed-corrections-separate-future-work).

For local acceptance, apply the new migration after loading the baseline in an
isolated disposable database. Also test replay of the active migration chain plus
the new migration. A production deployment, data backfill, or schema-runner change
is not implicitly authorized or required by this design.

## Regression matrix

| Case | Required result |
|---|---|
| Modern canonical-only, known current salary | Trade succeeds; ownership changes, canonical snapshot does not. |
| Historical legacy-only | Existing behavior and salary projection remain unchanged. |
| Valid runtime-only | Existing execution works; runtime salary terms remain unchanged. |
| Canonical vs legacy; canonical vs runtime | Correct bilateral transfer and effective payroll without duplicates. |
| Runtime plus canonical for one player | Runtime precedence; exactly one salary contribution. |
| Canonical plus legacy for one player | No additive payroll or improper legacy fallback. |
| Repeat trade after first transfer | Current owner is authoritative despite stale imported agreement team. |
| Identity-only or absent current salary | Reject unsupported canonical eligibility; no fabricated values. |
| Excluded cap treatment | New canonical branch does not enable the player. |
| Canonical agreement in historical game | New modern branch does not activate. |
| Wrong sender, cross-game asset, duplicate player | Reject with all persisted state unchanged. |
| Wrong-owner, nontransferable, or duplicate pick | Reject; picks and history remain unchanged. |
| Valid first asset followed by invalid later asset | Roll back players, legacy ownership, picks, and history. |
| Invalid matching, hard cap, or roster size | Existing TypeScript validation rejects; do not claim direct-RPC enforcement. |
| Concurrent trades involving the same asset | No duplicate transfer or inconsistent ownership. |

Each rejected SQL operation must assert failure and compare pre/post state, not
only inspect an error message. Successful operations must assert both teams'
ownership, effective salaries, relevant history, unchanged immutable snapshots,
and absence of artificial legacy contracts.

## Original implementation plan and acceptance criteria

1. Reproduce the current canonical-only failure locally before implementation.
2. Add the separate migration and focused SQL regression coverage.
3. Verify baseline-plus-migration and active-chain-plus-migration in disposable
   databases, without applying inactive proposals as prerequisites.
4. Run the SQL source/rollback matrix and relevant TypeScript tests; run the
   repository's required `bun biome check` for changed supported files.
5. Record results and unresolved gaps before any deployment decision.

Original acceptance checklist (not a current progress tracker; recorded outcomes
are in the [validation report](modern-contract-trade-validation-report.md)):

- [ ] Canonical-only modern trades no longer fail with `Player contract is missing`.
- [ ] Missing/excluded canonical evidence is not silently accepted.
- [ ] No invented salary values, backfills, or artificial legacy contract rows.
- [ ] Canonical agreements, seasons, and provenance remain unchanged.
- [ ] Historical, legacy, and runtime behavior is preserved.
- [ ] Effective salaries are counted once and assigned to the current owner.
- [ ] Invalid trades fully roll back all relevant persisted state.
- [ ] Picks retain ownership, transferability, and identity protections.
- [ ] Function signature, privileges, security configuration, and locking are preserved.
- [ ] SQL-vs-TypeScript validation limits are documented accurately.

## Verification status and next step

The original investigation did not execute tests or change database state. Subsequent
implementation and local validation are recorded in the
[validation report](modern-contract-trade-validation-report.md); the correction is
no longer design-only. Those results do not prove live Auth/PostgREST behavior or
SQL-side salary matching, hard caps, and roster limits. The independent Supabase
security-runtime blocker and staging/production NO-GO remain unresolved.

Next, follow the [development and testing plan](development-testing-plan.md) to
prepare isolated integration coverage. Remote migrations and deployment remain
separately authorized operations.
