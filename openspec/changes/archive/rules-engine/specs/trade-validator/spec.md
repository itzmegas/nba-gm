# Trade Validator Engine Specification

## Purpose

Defines the salary matching rules and restrictions for NBA trades across taxpayer, non-taxpayer, and apron tiers.

## Requirements

### Requirement: Non-Taxpayer Trade Validation (Under $7.5M outgoing)

The system MUST allow a non-taxpayer team to take back up to 175% of their outgoing salary plus $100,000 if the outgoing salary is $7,500,000 or less.

#### Scenario: Non-taxpayer taking back 175% salary

- GIVEN a team's post-trade salary remains below the luxury tax line
- AND the team is sending an outgoing salary of $5,000,000
- WHEN the trade matching rule is applied
- THEN the team MUST be allowed to take back up to $8,850,000 in incoming salary ($5,000,000 * 1.75 + $100,000)

### Requirement: Non-Taxpayer Trade Validation ($7.5M to $29M outgoing)

The system MUST allow a non-taxpayer team to take back their outgoing salary plus $5,000,000 if the outgoing salary is between $7,500,000 and $29,000,000.

#### Scenario: Non-taxpayer taking back outgoing plus $5M

- GIVEN a team's post-trade salary remains below the luxury tax line
- AND the team is sending an outgoing salary of $15,000,000
- WHEN the trade matching rule is applied
- THEN the team MUST be allowed to take back up to $20,000,000 in incoming salary ($15,000,000 + $5,000,000)

### Requirement: Non-Taxpayer Trade Validation ($29M+ outgoing)

The system MUST allow a non-taxpayer team to take back their outgoing salary times 125% plus $100,000 if the outgoing salary is $29,000,000 or more.

#### Scenario: Non-taxpayer taking back outgoing times 125%

- GIVEN a team's post-trade salary remains below the luxury tax line
- AND the team is sending an outgoing salary of $30,000,000
- WHEN the trade matching rule is applied
- THEN the team MUST be allowed to take back up to $37,600,000 in incoming salary ($30,000,000 * 1.25 + $100,000)

### Requirement: Taxpayer Trade Validation

The system MUST allow a taxpayer team (above the tax line but below the second apron) to take back up to 125% of their outgoing salary plus $100,000.

#### Scenario: Taxpayer taking back 125% salary

- GIVEN a team's post-trade salary is above the luxury tax line but below the second apron
- AND the team is sending an outgoing salary of $15,000,000
- WHEN the trade matching rule is applied
- THEN the team MUST be allowed to take back up to $18,850,000 in incoming salary ($15,000,000 * 1.25 + $100,000)

### Requirement: Second Apron Trade Validation

The system MUST strictly restrict second apron teams from taking back more incoming salary than their outgoing salary (dollar-for-dollar matching only).

#### Scenario: Second apron team making a trade

- GIVEN a team is above the second tax apron
- AND the team is sending an outgoing salary of $15,000,000
- WHEN the trade matching rule is applied
- THEN the team MUST NOT be allowed to take back more than $15,000,000 in incoming salary
