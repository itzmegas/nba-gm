# Contract Engine Specification

## Purpose

Defines the limits and constraints on player contract structures, primarily focusing on maximum salary calculations based on years of NBA experience.

## Requirements

### Requirement: Maximum Salary by Experience (0-6 Years)

The system MUST restrict the maximum first-year salary of a player with 0 to 6 years of NBA experience to 25% of the current salary cap.

#### Scenario: Max contract for a 4-year veteran

- GIVEN the current salary cap is $140,588,000
- AND a free agent has 4 years of NBA experience
- WHEN the system calculates their maximum allowable first-year salary
- THEN the maximum salary MUST be $35,147,000 (25% of $140,588,000)

### Requirement: Maximum Salary by Experience (7-9 Years)

The system MUST restrict the maximum first-year salary of a player with 7 to 9 years of NBA experience to 30% of the current salary cap.

#### Scenario: Max contract for an 8-year veteran

- GIVEN the current salary cap is $140,588,000
- AND a free agent has 8 years of NBA experience
- WHEN the system calculates their maximum allowable first-year salary
- THEN the maximum salary MUST be $42,176,400 (30% of $140,588,000)

### Requirement: Maximum Salary by Experience (10+ Years)

The system MUST restrict the maximum first-year salary of a player with 10 or more years of NBA experience to 35% of the current salary cap.

#### Scenario: Max contract for a 12-year veteran

- GIVEN the current salary cap is $140,588,000
- AND a free agent has 12 years of NBA experience
- WHEN the system calculates their maximum allowable first-year salary
- THEN the maximum salary MUST be $49,205,800 (35% of $140,588,000)

### Requirement: Minimum Salary Exception

The system MUST allow teams to sign players to the league minimum salary exception regardless of their current cap space.

#### Scenario: Over-cap team signing a minimum player

- GIVEN a team is over the salary cap
- AND the team has an open roster spot (less than 15 players)
- WHEN the team attempts to sign a free agent to a minimum salary contract
- THEN the system MUST approve the signing
