# Historical Era Snapshots Specification

## Purpose

Define the MVP historical-data path for the 2010/LeBron era: real 2010-11 roster membership with deterministic approximate contracts, copied into isolated game-scoped state.

## Requirements

### Requirement: HIST-001 Historical roster template source

The system MUST provide immutable historical roster templates keyed by `season_year`, populated for 2010 from NBA API roster data. Each row MUST identify season, team, and player membership.

#### Scenario: Load a 2010 roster template

- GIVEN NBA API roster data for the 2010-11 season
- WHEN the historical loader runs
- THEN it MUST emit 2010 template rows identifying the season, team, and player
- AND gameplay changes MUST NOT mutate those template rows.

### Requirement: HIST-002 Approximate contract templates

The system MUST provide deterministic or repeatable approximate historical contract templates compatible with existing contract fields: start/end years, `salary_y1` through `salary_y5`, options, and guarantees. Product copy MUST NOT claim exact historical accuracy.

#### Scenario: Generate approximate contracts

- GIVEN a historical roster template player
- WHEN the loader generates a contract template
- THEN it MUST populate fields compatible with game-scoped contracts
- AND repeated generation MUST be deterministic or repeatable for review and debugging.

### Requirement: HIST-003 Season-aware seeding

`seed_game_data` MUST read `games.season_year`. When templates exist for the game season, it MUST copy roster templates to `game_player_states` and contract templates to new game-scoped `contracts` rows without mutating templates.

#### Scenario: Create a 2010 historical game

- GIVEN 2010 roster and contract templates exist
- WHEN a user creates a 2010/LeBron game
- THEN the game MUST receive 2010 roster membership and new game-scoped approximate contracts
- AND existing roster and dashboard reads MUST continue to use game-scoped data.

### Requirement: HIST-004 Safe modern fallback

For a season without historical templates, game creation MUST remain playable through an explicit fallback path.

#### Scenario: Create a modern game

- GIVEN a user selects the modern/default era
- WHEN no templates exist for that season
- THEN game creation MUST use the existing fallback behavior
- AND the migration MUST NOT invalidate existing saves.

### Requirement: HIST-005 Repeated-game isolation

Multiple games created from the same season templates MUST receive isolated state. `contracts` rows MUST be scoped by distinct `game_id` values, and `game_player_states` MUST remain unique per `(game_id, player_id)`.

#### Scenario: Create two 2010 games

- GIVEN 2010 templates exist
- WHEN a user creates two 2010 games
- THEN both games MUST retain their own game-scoped contract rows
- AND neither creation MUST consume or mutate shared templates.

### Requirement: HIST-006 Era metadata

`SeasonEra` metadata MUST mark 2010/LeBron and 1995/Jordan as backed by historical data once templates are loaded. User-facing copy MUST distinguish real rosters from approximate contracts.

#### Scenario: Describe 2010 historical fidelity

- GIVEN a user views or selects the 2010 era
- THEN the UI MUST describe real 2010-11 rosters with approximate generated contracts
- AND it MUST NOT promise exact historical salaries, contract terms, CBA rules, or cap rules.

#### Scenario: Describe 1995 historical fidelity

- GIVEN a user views or selects the 1995 era
- THEN the UI MUST describe real 1995-96 rosters with approximate generated contracts
- AND it MUST NOT promise exact historical salaries, contract terms, CBA rules, or cap rules.

### Requirement: HIST-007 Architecture boundaries

The implementation MUST preserve Clean/Hexagonal boundaries: domain remains pure TypeScript; SQL and migrations own persistence; scripts own NBA ingestion and contract generation; and presentation MUST NOT learn SQL details.

### Requirement: HIST-008 Fail-closed guard for historical seasons

`seed_game_data` MUST fail closed for every season declared historical in `SeasonEra` when roster and contract templates are not loaded. The error MUST direct the operator to run the corresponding era loader before creating games in that season.

#### Scenario: Create a 1995 game without templates

- GIVEN no 1995 historical roster or contract templates exist
- WHEN a user attempts to create a 1995/Jordan game
- THEN `seed_game_data` MUST raise an exception
- AND the error MUST indicate that 1995 templates are not loaded and direct the operator to run `scripts/seed_jordan_rosters.py`.

#### Scenario: Create a 1995 game with templates

- GIVEN 1995 roster and contract templates exist
- WHEN a user creates a 1995/Jordan game
- THEN the game MUST receive 1995 roster membership and new game-scoped approximate contracts
- AND existing roster and dashboard reads MUST continue to use game-scoped data.

### Requirement: HIST-009 Approximate contract truthfulness

All generated historical contracts MUST be labeled or documented as approximate. Product copy, comments, and runbooks MUST NOT present generated salaries as exact historical values.

#### Scenario: Review 1995 contract generation

- GIVEN a generated 1995 historical contract template
- THEN its salary values MUST fall within the era-calibrated tier ranges defined for the 1995-96 salary cap context
- AND the loader source code or runbook MUST state that values are approximate and not real CBA contracts.
