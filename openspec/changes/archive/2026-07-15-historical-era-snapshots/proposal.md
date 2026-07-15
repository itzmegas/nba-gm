# Proposal: historical-era-snapshots

## Intent

Selecting the 2010/LeBron era creates a game with real 2010 roster membership and approximate generated contracts. The roster source is the NBA API. Contracts are deliberately approximate and must never be presented as exact historical terms.

## Scope

### In Scope

- Immutable historical roster and contract templates keyed by `season_year`.
- Real 2010-11 roster membership sourced through the NBA API.
- Deterministic, repeatable approximate contract templates.
- Season-aware `seed_game_data` copying templates into game-scoped player states and contracts.
- Safe modern fallback when no historical templates exist.
- Era metadata and copy that distinguish real rosters from approximate contracts.

### Out of Scope

- Exact historical contracts, salaries, CBA rules, or salary-cap rules.
- 1995 historical templates.
- Historical stats, ratings, injuries, drafts, awards, or a profile-model rewrite.
- Production external-data licensing automation.

## Affected Areas

| Area | Layer | Impact |
| --- | --- | --- |
| Historical templates and `seed_game_data` | Infrastructure | Persist immutable templates and copy them into game-scoped state. |
| NBA roster loader | Infrastructure scripts | Ingest 2010-11 roster membership and generate approximate contracts. |
| `SeasonEra` and creation copy | Domain / Presentation | Declare supported historical data and its fidelity. |
| Active contract lookup | Infrastructure | Respect the selected historical season context. |

## Success Criteria

- Two 2010 games retain separate game-scoped data.
- Modern/default game creation remains playable when templates are absent.
- The 2010 UI states that rosters are real and contracts are approximate.
- The product does not claim exact historical contract accuracy.

## Risks

| Risk | Mitigation |
| --- | --- |
| NBA API availability or payload changes | Keep ingestion in an explicit script and retain loaded templates in Supabase. |
| Historical contracts interpreted as authoritative | Keep copy explicit that contracts are generated approximations. |
| Shared state between historical games | Copy templates to rows scoped by `game_id`; preserve templates as source data. |

## Rollback Plan

Disable historical-era selection or remove the historical template migration and loader data. Existing games continue to use their already game-scoped rows; no gameplay mutation is written back to templates.
