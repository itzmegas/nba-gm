# Delta for Historical Era Snapshots

This delta extends historical snapshot support from the 2010/LeBron dataset to the 1995-96 opening-season Jordan snapshot while preserving modern behavior, existing saves, and global player profiles.

## MODIFIED Requirements

### Requirement: HIST-001 Historical roster template source

The system MUST provide immutable historical roster templates keyed by `season_year`, including a configured 1995-96 opening-season template populated from validated NBA API roster responses. Each row MUST identify the season, franchise, and player membership. The 1995 template MUST preserve Seattle's franchise identity as NBA team ID `1610612760`.

#### Scenario: Load the 1995-96 opening-season templates

- GIVEN the NBA API returns roster rows for the configured 1995-96 season and supported franchises
- WHEN the historical loader runs
- THEN it MUST produce 1995 template rows containing the required player identity, position, jersey, team, and season fields
- AND Seattle rows MUST resolve to franchise `1610612760`
- AND gameplay MUST NOT mutate the shared template rows

#### Scenario: Reject an incomplete API roster response

- GIVEN a roster response is missing a required identity, team, or membership field
- WHEN the loader validates the response
- THEN it MUST reject that response rather than persist an ambiguous template row
- AND it MUST report the validation failure without creating partial historical membership

### Requirement: HIST-002 Approximate contract templates

The system MUST provide deterministic, approximate 1995 contracts compatible with the existing contract fields: start/end years, `salary_y1` through `salary_y5`, options, and guarantees. The 1995 salary tiers MUST be calibrated to the 1995 era rather than modern salary ranges. Product copy and persisted metadata MUST identify these values as approximate and MUST NOT claim exact historical contracts, CBA terms, or salaries.

#### Scenario: Generate a 1995 contract template

- GIVEN a player belongs to a validated 1995-96 roster template
- WHEN the contract template is generated
- THEN it MUST contain valid game-compatible salary and term fields
- AND its salary tier MUST fall within the configured 1995-era approximation policy
- AND repeated generation for the same stable inputs MUST produce the same result

#### Scenario: Keep approximate values truthful

- GIVEN a user views a 1995 roster, contract, or era description
- WHEN the application presents contract information
- THEN it MUST label the values as approximate/generated
- AND it MUST NOT present them as verified historical salary or contract facts

### Requirement: HIST-003 Season-aware seeding

`seed_game_data` MUST select templates by `games.season_year`. When a 1995 template exists, it MUST copy its roster membership and approximate contracts into new game-scoped rows without mutating shared templates or global player profiles.

#### Scenario: Create a new 1995 game

- GIVEN a new game has `season_year = 1995` and the 1995 roster and contract templates are available
- WHEN game data is seeded
- THEN the game MUST receive 1995-96 opening-season player membership rather than the modern roster
- AND the game MUST receive 1995-era approximate contracts
- AND all copied rows MUST be scoped to the new game

#### Scenario: Create two games from the same 1995 snapshot

- GIVEN 1995 templates exist
- WHEN two new 1995 games are created
- THEN each game MUST receive independent roster and contract rows
- AND neither operation MUST consume, mutate, or reassign the shared templates

### Requirement: HIST-004 Fail-closed historical era template guard

Historical-data-backed eras MUST fail closed when their required templates are missing, invalid, or incomplete. A historical seed MUST NOT silently fall back to the modern dataset. The modern/default era MUST retain its explicit playable fallback path.

#### Scenario: Missing 1995 templates abort historical seeding

- GIVEN a new game has `season_year = 1995` and no valid 1995 template is available
- WHEN `seed_game_data` runs
- THEN historical seeding MUST abort with an actionable error
- AND it MUST NOT insert a mixed-era roster or contracts
- AND the modern fallback MUST NOT be used for that game

#### Scenario: Missing modern templates preserve playability

- GIVEN a new game selects the modern/default era and no historical template is required
- WHEN `seed_game_data` runs
- THEN it MUST use the existing modern fallback behavior
- AND existing saves MUST remain readable and playable

### Requirement: HIST-005 Repeated-game isolation

Every new game MUST receive isolated game-scoped state. `contracts` rows MUST be scoped by the new `game_id`, and `game_player_states` MUST remain unique per `(game_id, player_id)`.

#### Scenario: Preserve isolation for 1995 games

- GIVEN two games are created from the 1995 templates
- WHEN either game's roster or contract state is changed
- THEN the other game's state MUST remain unchanged
- AND the shared 1995 templates MUST remain unchanged

### Requirement: HIST-006 Era metadata

`SeasonEra` metadata MUST mark 1995/Jordan as historically data-backed and distinguish real roster membership from approximate generated contracts. The metadata MUST continue to mark 2010/LeBron as supported historical data and modern as the canonical current dataset.

#### Scenario: Describe Jordan-era fidelity

- GIVEN a user views or selects the 1995/Jordan era
- THEN the UI MUST state that it uses 1995-96 opening-season rosters
- AND it MUST state that contracts are approximate/generated
- AND it MUST NOT promise exact historical salaries, contract terms, CBA rules, or cap rules

### Requirement: HIST-008 Safe player identity ingestion

Historical ingestion MUST reuse an existing global player identity when its stable NBA identity matches, and MUST insert a new global identity only when no matching identity exists. Historical ingestion MUST NOT overwrite global profile fields or move an existing player between teams; team membership belongs to the game-scoped/template data.

#### Scenario: Reuse an existing player identity

- GIVEN a 1995 API row has a stable NBA player ID matching an existing global player
- WHEN the row is ingested
- THEN the loader MUST reference the existing player identity
- AND it MUST NOT overwrite that player's global name, physical attributes, or current profile fields

#### Scenario: Insert a missing player identity safely

- GIVEN a 1995 API row has no matching global NBA player ID
- WHEN the row is ingested
- THEN the loader MUST insert the missing identity with validated fields
- AND it MUST associate historical team membership through the snapshot/game scope
- AND rerunning the loader MUST NOT create duplicate identities

### Requirement: HIST-009 New-game-only behavior

The change MUST apply only while creating and seeding new games. It MUST NOT backfill, rewrite, or reseed existing 1995, 2010, or modern games, and MUST NOT alter existing global player profiles.

#### Scenario: Existing games remain unchanged

- GIVEN an existing game and its game-scoped roster or contracts were created before this change
- WHEN the new templates or guard are deployed
- THEN those rows MUST remain unchanged
- AND no migration or loader operation MUST silently reseed that game

### Requirement: HIST-010 Regression safety and evidence

The implementation MUST preserve current modern behavior and 2010 historical behavior. Automated/static verification MUST cover template selection, contract determinism and era ranges, identity-safe ingestion, fail-closed branching, metadata, and new-game-only logic. Supabase validation MUST additionally be performed manually against the target project for RLS, template availability, representative 1995 creation, and existing-game immutability.

#### Scenario: Regression-check supported eras

- GIVEN the automated/static verification suite runs
- WHEN it exercises modern, 2010, and 1995 paths
- THEN modern creation MUST retain its current fallback behavior
- AND 2010 creation MUST retain real roster membership and approximate contracts
- AND 1995 creation MUST select only the 1995 snapshot

#### Scenario: Validate Supabase behavior manually

- GIVEN the implementation passes automated/static checks
- WHEN an authorized reviewer validates the Supabase project
- THEN RLS and foreign-key constraints MUST permit the intended service-side template load and game-scoped copy
- AND a representative new 1995 game MUST show the expected roster, Seattle franchise identity, and non-zero approximate contracts
- AND an existing game and global player profile MUST be unchanged after validation

## Evidence Classification

- **Automated/static evidence:** unit tests, script checks, TypeScript/SQL inspection, deterministic contract assertions, lint/format checks, and scenario-level seed/identity tests.
- **Required manual Supabase validation:** deployed schema and RLS behavior, actual template rows, representative new-game creation, and immutability checks against existing games and profiles.
