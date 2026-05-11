# Migration 004 — Deprecation Notice for `players.team_id` in gameplay

## Status

`players.team_id` is **DEPRECATED for gameplay purposes**.

## Authoritative source for roster assignment

For all gameplay logic, roster ownership and player-team assignment must come from:

- `game_player_states.team_id`

## Why `players.team_id` still exists

`players.team_id` is retained for now only for:

1. **ETL / initial seeding** of real NBA data into the static catalog
2. **Default roster initialization** when creating a new game (players start from real-world teams)

## Mandatory query rule

All gameplay queries **MUST** use `game_player_states` and **MUST NOT** use `players.team_id`.

## Future direction

Once ETL and initialization flows are fully based on `game_player_states`, evaluate:

- making `players.team_id` nullable by default, or
- removing `players.team_id` entirely from gameplay-related assumptions.

Until then, treat `players.team_id` as a legacy/static-data aid, not a gameplay source of truth.
