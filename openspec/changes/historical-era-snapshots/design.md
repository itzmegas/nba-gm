# Design: historical-era-snapshots

## Technical Approach

Historical roster and contract templates are immutable Supabase source data. `seed_game_data` validates the game and selected team, reads `games.season_year`, and selects the template path only when templates exist for that season. It copies roster templates into `game_player_states` and contract templates into new `contracts` rows scoped to the created game. Seasons without templates use the explicit existing fallback.

The Python loader reads service-role credentials from `.env.local`, fetches `CommonTeamRoster` from the NBA API for each `teams.nba_id` in 2010-11, upserts players, and emits roster templates plus deterministic approximate contract tiers. The UI keeps its existing game-scoped reads.

## Data Model

| Table | Key | Responsibility |
| --- | --- | --- |
| `historical_roster_templates` | `(season_year, team_id, player_id)` | Immutable roster membership source. |
| `historical_contract_templates` | `(season_year, team_id, player_id)` | Immutable, approximate contract source compatible with `contracts`. |
| `game_player_states` | game/player scoped | Mutable game roster state copied from templates. |
| `contracts` | `game_id` scoped | Mutable game contracts copied from templates. |

RLS permits authenticated reads of templates and service-role writes. The seed function is hardened with ownership, search-path, and execution controls.

## Seeding Flow

```text
Create game
  -> seed_game_data(game_id)
  -> validate game and selected team
  -> read games.season_year
  -> templates exist for season?
       yes -> copy roster templates to game_player_states
           -> copy contract templates to contracts(game_id)
       no  -> use modern/default fallback
```

## Architecture Decisions

### Immutable templates, mutable game state

Templates are reusable source data. A game receives copies rather than references so creating or simulating one game cannot alter another.

### Approximate, reproducible contracts

The loader generates contract tiers rather than representing historical salaries as exact facts. This keeps the MVP playable and debuggable without claiming historical CBA or contract fidelity.

### Persistence stays outside presentation

SQL owns template persistence and seeding. The loader owns NBA API ingestion. `SeasonEra` only exposes fidelity metadata; UI components continue to read current game-scoped data and do not learn database implementation details.

## Non-goals

This design does not introduce exact historical contracts, historical CBA/cap rules, 1995 templates, historical stats/ratings/injuries/drafts/awards, a player-profile rewrite, or production licensing automation.
