# Proposal: Jordan Era Snapshots

## Intent

New 1995 games receive modern players and salaries because `seed_game_data` falls back without templates. Provide 1995-96 opening-season rosters and approximate era-calibrated contracts without changing existing saves.

## Scope

### In Scope

- Load opening-season 1995-96 rosters through a configured entry point using shared primitives.
- Preserve franchise IDs, including Seattle under `1610612760`.
- Generate deterministic, approximate 1995 salary tiers.
- Make every historical-data-backed era fail closed when templates are missing.
- Affect new games only.
- Reuse player identities without overwriting global profiles.

### Out of Scope

- Trades, exact contracts/CBA, backfills, seasonal biographies, and historical names unless mapping requires them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `historical-era-snapshots`: Extend templates, fidelity, and fail-closed seeding to 1995.

## Approach

Keep parallel era entry points backed by configurable validation, contract, identity-safe persistence, and idempotency primitives. The NBA API spike passed: Chicago returned 15 rows, franchise `1610612760` returned 13 Seattle rows, and required fields (`PLAYER_ID`, `PLAYER`, `POSITION`, `NUM`, `TeamID`) were present. Migration 008 generalizes the 2010-only guard. This extends PLAN.md Phase 1.

## Affected Areas

| Area | Layer | Impact |
| --- | --- | --- |
| Historical loader scripts and shared module | Infrastructure scripts | Share safe primitives; add 1995 configuration. |
| `scripts/migrations/008_jordan_era_snapshots.sql`, `scripts/schema.sql` | Infrastructure | Generalize fail-closed seeding. |
| `src/domain/entities/SeasonEra.ts` | Domain | Declare Jordan historical support and fidelity. |
| `openspec/specs/historical-era-snapshots/spec.md` | Specification | Add 1995 and generic guard behavior. |

## Delivery Plan

Use two Feature Branch Chain children: (1) shared loader foundation preserving 2010; (2) 1995 ingestion, guard, metadata, and delta spec. Each targets its parent, stays below 400 changed lines, and includes focused verification.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| NBA API instability | Medium | Validate fields; persist via a rerunnable loader. |
| Cross-era profile contamination | Medium | Reuse IDs without updates; insert only missing identities. |
| Approximation presented as fact | Medium | Label generated contracts and tiers as approximate. |
| Partial delivery | Low | Keep the tracker draft/no-merge until both children verify. |

## Rollback Plan

Restore the prior seed function and metadata, remove only 1995 templates, and retain game-scoped rows. Never reseed existing games.

## Dependencies

- NBA API `CommonTeamRoster`, template tables, and franchise mappings.

## Success Criteria

- [ ] New 1995 games receive opening-season players and approximate era-calibrated contracts.
- [ ] Missing templates abort historical seeding; modern fallback remains playable.
- [ ] Existing 1995 games and global player profiles remain unchanged.
- [ ] Both chained work units remain within the 400-line review budget.
