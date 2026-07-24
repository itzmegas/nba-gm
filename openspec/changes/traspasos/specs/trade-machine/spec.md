# Trade Machine Specification

## Purpose

The active-game dashboard SHALL provide a minimal two-team trade machine for player-only trades. The page SHALL use existing game-scoped roster data and existing trade simulation and execution behavior without changing domain, application, infrastructure, or database contracts.

## ADDED Requirements

### Requirement: Render the trade-machine route

The system SHALL render the trade-machine page at `/games/{gameId}/dashboard/trades` for an active saved game instead of returning a not-found response. The page SHALL identify the active game's season and provide controls for selecting the two participating teams.

#### Scenario: Active game opens the trade machine
- **GIVEN** a saved game exists for `{gameId}` and its teams and rosters are available
- **WHEN** the user navigates to `/games/{gameId}/dashboard/trades`
- **THEN** the page renders the trade-machine interface
- **AND** the active season context is visible

#### Scenario: Game data is unavailable
- **GIVEN** the game is loading or cannot be resolved
- **WHEN** the trade-machine route renders
- **THEN** the page shows a loading or unavailable state
- **AND** it does not present an executable trade action

### Requirement: Select two distinct teams

The system MUST allow the user to select a team for each side of the trade from the active game's available teams. The two selected team identifiers MUST be distinct before the proposal can be simulated or executed.

#### Scenario: Select two different teams
- **GIVEN** the active game has at least two available teams
- **WHEN** the user selects team A for the first side and team B for the second side
- **THEN** both selections are displayed
- **AND** player selection is available for each selected roster

#### Scenario: Prevent the same team on both sides
- **GIVEN** team A is selected for the first side
- **WHEN** the user selects team A for the second side
- **THEN** the page indicates that the teams must be different
- **AND** Try Trade and Execute Trade remain unavailable

### Requirement: Toggle eligible contracted players

The system MUST list only players with an eligible active contract for each selected team and MUST allow each listed player to be toggled into or out of that team's outgoing package.

#### Scenario: Add and remove a contracted player
- **GIVEN** a selected team has a player with an eligible contract
- **WHEN** the user toggles that player on
- **THEN** the player appears in that team's outgoing package
- **AND** the package reflects the player's contract salary
- **WHEN** the user toggles the same player off
- **THEN** the player is removed from the outgoing package

#### Scenario: Exclude an uncontracted player
- **GIVEN** a roster contains a player without an eligible contract
- **WHEN** the roster is shown in the trade machine
- **THEN** that player is not selectable
- **AND** the player cannot enter the outgoing package through the page

#### Scenario: No eligible players exist
- **GIVEN** a selected roster contains no eligible contracted players
- **WHEN** its player picker renders
- **THEN** the page shows a useful empty state explaining that no eligible players are available
- **AND** the rest of the trade machine remains usable

### Requirement: Build domain-compatible trade packages

The system MUST construct the domain `TradePackage` shape from the local team and player selections. Each package MUST identify the team, include its team name, contain selected player assets with their player and contract data, and use an empty incoming-assets collection for simulation input. The page MUST NOT use the incompatible legacy Zustand trade-store package shape.

#### Scenario: Build a player-only proposal
- **GIVEN** two distinct teams and zero or more eligible selected players on each side
- **WHEN** the user requests a simulation
- **THEN** the submitted value contains exactly two domain-compatible team packages
- **AND** every outgoing asset has type `player` and the corresponding player and contract
- **AND** no picks or cash assets are submitted

#### Scenario: Incomplete package context
- **GIVEN** a selected team or required player contract data is not available
- **WHEN** the user attempts to simulate
- **THEN** no malformed package is submitted
- **AND** the page shows that the proposal is not ready

### Requirement: Simulate and display trade feedback

The system SHALL use the existing trade simulation hook when the user selects Try Trade. While simulation is loading, the page MUST show progress and MUST NOT allow execution. After simulation, the page MUST display the returned validity, every returned validation error, every returned warning, and both teams' validation details.

#### Scenario: Valid simulation
- **GIVEN** two distinct teams have a constructible player-only proposal
- **WHEN** the user selects Try Trade and simulation succeeds with `isValid` true
- **THEN** the page displays a valid result
- **AND** it displays errors and warnings returned by the engine, if any
- **AND** Execute Trade becomes available

#### Scenario: Invalid simulation
- **GIVEN** the simulation returns `isValid` false
- **WHEN** the result is displayed
- **THEN** all returned errors and warnings are visible
- **AND** both teams' returned financial and roster details are visible when provided
- **AND** Execute Trade remains unavailable

#### Scenario: Simulation fails
- **GIVEN** the simulation request fails
- **WHEN** the failure is reported
- **THEN** the page shows an actionable failure state
- **AND** no execution is attempted

### Requirement: Show salary and financial context

The system MUST show outgoing salary for each selected team and MUST show the financial context returned by the trade validation result, including salary delta, projected roster size, over-cap status, and over-hard-cap status when available.

#### Scenario: Financial details are returned
- **GIVEN** a simulation result includes details for both teams
- **WHEN** the result is rendered
- **THEN** each side shows its outgoing salary
- **AND** each side shows incoming salary, salary delta, projected roster size, and cap-status values

#### Scenario: No simulation result exists
- **GIVEN** the user has changed selections or has not tried the proposal
- **WHEN** financial feedback renders
- **THEN** the page shows current outgoing-salary totals from the local selection
- **AND** projected validation values remain absent or clearly marked as unavailable

### Requirement: Gate execution and refresh game data

The system MUST use the existing trade execution hook only when the latest simulation is valid, the teams are distinct, required data is available, and no simulation or execution is in progress. After successful execution, the system MUST refresh the affected roster queries and clear or refresh stale proposal feedback. Execution failures MUST remain visible and MUST NOT be presented as success.

#### Scenario: Execute a valid trade
- **GIVEN** the latest simulation is valid for two distinct teams
- **WHEN** the user selects Execute Trade and execution succeeds
- **THEN** the existing execution behavior is invoked with the domain-compatible proposal
- **AND** affected roster data is refreshed
- **AND** the page no longer presents the prior result as an executable current proposal

#### Scenario: Execution is gated
- **GIVEN** simulation is loading, execution is loading, teams are identical, or the latest result is invalid or absent
- **WHEN** the user views or activates Execute Trade
- **THEN** the action is unavailable
- **AND** no execution request is made

#### Scenario: Execution fails
- **GIVEN** a valid proposal is submitted for execution
- **WHEN** the execution hook reports an error
- **THEN** the page displays the error
- **AND** it does not claim that rosters were updated successfully

### Requirement: Reset the local proposal

The system MUST provide Reset, which clears the locally selected players and simulation feedback without modifying persisted game, roster, or contract data.

#### Scenario: Reset an unsaved proposal
- **GIVEN** the user has selected players or received simulation feedback
- **WHEN** the user selects Reset
- **THEN** both outgoing packages are empty
- **AND** validation feedback is cleared
- **AND** persisted data is unchanged

### Requirement: Show safe empty and unavailable states

The system SHALL provide a non-error empty state when no players are selected and MUST avoid offering execution when teams, rosters, contracts, or validation data required for a valid proposal are unavailable.

#### Scenario: No players selected
- **GIVEN** two distinct teams are selected and neither side has selected a player
- **WHEN** the trade summary renders
- **THEN** both packages show an explicit empty state
- **AND** Try Trade and Execute Trade are not available until a valid simulation can be made

## Explicit Non-Goals

The trade machine SHALL NOT support three-to-five-team trades, draft picks, cash considerations, free-agent signings, contract modifications, a separate season selector, configurable trade rules, sharing, community voting, trending players, saved proposals, transactional hardening of `TradeEngine.executeTrade`, schema migrations, RLS changes, repository changes, domain-rule changes, legacy trade-store refactoring, or new dependencies.

#### Scenario: Unsupported trade assets are absent
- **GIVEN** the trade-machine MVP is rendered
- **WHEN** the user builds a proposal
- **THEN** the interface exposes no controls for picks, cash, free agents, contract edits, or additional teams
- **AND** the submitted proposal remains player-only and two-team
