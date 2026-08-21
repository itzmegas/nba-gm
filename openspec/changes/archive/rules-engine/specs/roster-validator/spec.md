# Roster Validator Engine Specification

## Purpose

Defines the rules and constraints regarding minimum and maximum roster sizes during the regular season and offseason.

## Requirements

### Requirement: Active Roster Maximum

The system MUST enforce a hard maximum limit of 15 standard roster spots (active and inactive) during the regular season.

#### Scenario: Team attempting to sign a 16th player during the season

- GIVEN the current date is during the regular season
- AND a team currently has 15 players on standard contracts
- WHEN the team attempts to sign a new free agent to a standard contract
- THEN the system MUST reject the signing
- AND return an error indicating the roster limit is exceeded

### Requirement: Offseason Roster Maximum

The system MUST allow up to 21 players on the roster during the offseason.

#### Scenario: Team signing up to 21 players in the offseason

- GIVEN the current date is during the offseason
- AND a team currently has 15 players on the roster
- WHEN the team attempts to sign 6 additional players
- THEN the system MUST approve the signings

### Requirement: Minimum Players Dressed

The system MUST require a team to have at least 8 active players available to start a regular season game.

#### Scenario: Team with less than 8 active players

- GIVEN a team is scheduled to play a regular season game
- AND the team has only 7 active players due to injuries and inactive spots
- WHEN the game simulation attempts to start
- THEN the system MUST halt the simulation for that game
- AND require the team to dress at least 8 players
