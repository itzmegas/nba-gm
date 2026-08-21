# Salary Cap Engine Specification

## Purpose

Defines the business rules for calculating a team's salary cap space, luxury tax penalties, and cap holds based on the NBA soft cap system.

## Requirements

### Requirement: Cap Space Calculation

The system MUST calculate available cap space by subtracting total active salaries and cap holds from the current season's salary cap. If the result is negative, the system MUST return 0 for cap space.

#### Scenario: Team with mixed active salaries and cap holds

- GIVEN the current season salary cap is $140,588,000
- AND a team has $100,000,000 in active guaranteed salaries
- AND the team has $20,000,000 in cap holds for free agents
- WHEN the system calculates cap space
- THEN the cap space MUST be $20,588,000

#### Scenario: Team exceeding the salary cap

- GIVEN the current season salary cap is $140,588,000
- AND a team has $150,000,000 in active salaries
- WHEN the system calculates cap space
- THEN the cap space MUST be 0

### Requirement: Luxury Tax Calculation

The system MUST calculate the luxury tax penalty progressively using standard tax rates based on $5M brackets above the luxury tax line.

#### Scenario: Team is $12M over the standard tax line

- GIVEN the luxury tax line is $170,814,000
- AND a standard taxpayer team has a total salary of $182,814,000 ($12,000,000 over)
- WHEN the system calculates the luxury tax bill
- THEN the tax MUST be $21,250,000
- AND the calculation MUST be: ($5,000,000 * 1.50) + ($5,000,000 * 1.75) + ($2,000,000 * 2.50)

### Requirement: Cap Holds

The system MUST apply a cap hold to unsigned free agents based on their Bird rights to prevent teams from using cap space while retaining the ability to re-sign their own players.

#### Scenario: Team has full bird rights

- GIVEN a player with a previous salary of $10,000,000 (below average)
- AND the player has Full Bird rights (3+ years on team)
- WHEN the cap hold is applied
- THEN the system MUST apply a cap hold of 150% of the prior salary ($15,000,000)
