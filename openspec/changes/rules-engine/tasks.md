# Tasks: rules-engine

## Phase 1: Domain Entities & Types

- [x] 1.1 Create `src/domain/errors/index.ts` to define custom domain errors (`DomainError`, `SalaryMatchingError`, `HardCapError`, `RosterSizeError`).
- [x] 1.2 Update `src/domain/entities/Player.ts` (if exists, else create) to include `yearsOfExperience: number` field to support max salary calculations.
- [x] 1.3 Update `src/domain/entities/Trade.ts` (if exists, else create) to change `TradeValidationResult` to use `errors: DomainError[]` instead of plain strings.

## Phase 2: Rules Config

- [x] 2.1 Create `src/domain/constants/nba-rules.ts` to define all centralized constants: `SALARY_CAP`, `LUXURY_TAX`, aprons, matching tiers, max salary multipliers, and roster limits for the 2024-25 season.

## Phase 3: Domain Services

- [x] 3.1 Refactor/Create `src/domain/services/SalaryCapCalculator.ts` to calculate cap space using constants from `nba-rules.ts`. Implement cap holds (150% for Full Bird) and the progressive luxury tax calculation logic.
- [x] 3.2 Refactor/Create `src/domain/services/TradeValidator.ts` to enforce the 3-tier salary matching rules (non-taxpayer $7.5M/$29M/$29M+, taxpayer, second apron) and return structured validation objects with `DomainError` instances.
- [x] 3.3 Create `src/domain/services/RosterValidator.ts` to strictly enforce roster limits: minimum 12, maximum 15 in-season, and maximum 21 in the offseason.
- [x] 3.4 Create `src/domain/services/ContractGenerator.ts` to calculate maximum salary limits constrained by experience tiers (0-6 yrs: 25%, 7-9 yrs: 30%, 10+ yrs: 35%).

## Phase 4: Unit Tests

- [x] 4.1 Create `tests/domain/services/SalaryCapCalculator.test.ts` to verify cap space math, test cap holds functionality, and assert exact progressive luxury tax calculations against $5M brackets.
- [x] 4.2 Create `tests/domain/services/TradeValidator.test.ts` to verify all matching scenarios: Non-taxpayer low/mid/high, Taxpayer, and Second Apron strict dollar-for-dollar matching.
- [x] 4.3 Create `tests/domain/services/RosterValidator.test.ts` to verify in-season vs offseason boundary limits.
- [x] 4.4 Create `tests/domain/services/ContractGenerator.test.ts` to verify max salary limits for each tier against the base cap.
