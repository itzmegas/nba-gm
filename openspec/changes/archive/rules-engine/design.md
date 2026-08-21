# Design: rules-engine

## Technical Approach

The rules-engine change will be implemented entirely within the pure TypeScript domain layer, specifically inside `src/domain/services/`, utilizing the entities in `src/domain/entities/`. To enforce the exact NBA business rules specified in the `proposal.md` and `specs/`, we will refactor the existing `SalaryCapCalculator` and `TradeValidator` to replace hardcoded, simplified logic with deterministic, standard-compliant algorithms driven by a new centralized configuration (`src/domain/constants/nba-rules.ts`). We will also introduce `RosterValidator` and `ContractGenerator` as pure, stateless service classes to handle roster limits and max salary generation respectively. We will adopt custom domain errors (`DomainError`) to provide rich, type-safe error context rather than plain strings in validation results.

## Architecture Decisions

### Decision: Stateless Functional Services

**Choice**: Refactor existing domain services (`SalaryCapCalculator`, `TradeValidator`) and implement new ones (`RosterValidator`, `ContractGenerator`) as pure, stateless classes containing deterministic methods, with zero external dependencies (no DB, no API calls).
**Alternatives considered**: Procedural module exports (e.g., `export function validateTrade()`); Stateful classes holding the `Team` and `Contracts` as instance properties.
**Rationale**: Existing domain services already use the stateless class pattern (`export class TradeValidator`). Maintaining this pattern ensures consistency across the codebase while still achieving the functional purity requested in the proposal. All required context (contracts, current year) is passed as arguments to the methods.

### Decision: Centralized NBA Rules Constants

**Choice**: Create `src/domain/constants/nba-rules.ts` as the single source of truth for salary cap figures, tax brackets, aprons, and matching tiers.
**Alternatives considered**: Environment variables (`.env`); Database configuration table.
**Rationale**: These rules represent core domain invariants for the current season's engine. Storing them in code avoids I/O overhead (DB) and deployment complexity (env vars) for business logic that rarely changes mid-season. It directly supports the requirement for a framework-agnostic rules engine.

### Decision: Structured Validation with Custom Domain Errors

**Choice**: Define a hierarchy of custom `DomainError` classes (e.g., `SalaryMatchingError`, `HardCapError`). Validation methods will return a structured object (e.g., `{ isValid: boolean; errors: DomainError[] }`) rather than throwing exceptions.
**Alternatives considered**: Throwing exceptions on the first failure; Returning arrays of plain strings (current `TradeValidator` approach).
**Rationale**: Returning a structured validation result allows the engine to collect and report *all* violations at once (crucial for complex trades), improving the user experience. Upgrading from plain strings to custom error objects satisfies the requirement for "custom domain errors", providing machine-readable error codes or metadata alongside human-readable messages.

## Data Flow

The rules engine operates entirely within memory, decoupled from the application or infrastructure layers.

    Client / App Layer
         │
         ▼
    [Input Data] (Team, Player, Contract Arrays)
         │
         ├─→ SalaryCapCalculator.getFinancialStatus(contracts)
         │     └─→ Reads NBA_RULES
         │     └─→ Returns { capSpace, taxBill, apronStatus }
         │
         ├─→ TradeValidator.validateTrade(teamA, teamB, pkgA, pkgB)
         │     └─→ Uses SalaryCapCalculator
         │     └─→ Evaluates 3-Tier matching & Aprons
         │     └─→ Returns { isValid, errors: DomainError[] }
         │
         └─→ RosterValidator / ContractGenerator
               └─→ Returns boolean or Max Salary Number

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/constants/nba-rules.ts` | Create | Centralized rules, cap figures, and multipliers for the 2024-25 season. |
| `src/domain/errors/index.ts` | Create | Base `DomainError` and specific errors (`SalaryMatchingError`, etc.). |
| `src/domain/services/SalaryCapCalculator.ts` | Modify | Update to calculate cap holds and progressive luxury tax using `nba-rules.ts`. |
| `src/domain/services/TradeValidator.ts` | Modify | Refactor to use the 3-tier salary matching rules (non-taxpayer $7.5M/$29M, taxpayer, and second apron limits) and custom domain errors. |
| `src/domain/services/RosterValidator.ts` | Create | New service to enforce 12-15 in-season and up to 21 offseason roster limits. |
| `src/domain/services/ContractGenerator.ts` | Create | New service to calculate max salary based on 0-6 (25%), 7-9 (30%), and 10+ (35%) years of experience tiers. |
| `src/domain/entities/Trade.ts` | Modify | Update `TradeValidationResult` to use `errors: DomainError[]` instead of `string[]`. |
| `src/domain/entities/Player.ts` | Modify | Add `yearsOfExperience` field to support max salary calculation logic. |

## Interfaces / Contracts

```typescript
// src/domain/constants/nba-rules.ts
export const NBA_RULES = {
  SALARY_CAP: 140_588_000,
  LUXURY_TAX: 170_814_000,
  FIRST_APRON: 178_132_000,
  SECOND_APRON: 188_931_000,
  MATCHING_TIERS: {
    NON_TAXPAYER_LOW: { maxOutgoing: 7_500_000, incomingMultiplier: 1.75, flatBonus: 100_000 },
    NON_TAXPAYER_MID: { maxOutgoing: 29_000_000, flatBonus: 5_000_000 },
    NON_TAXPAYER_HIGH: { incomingMultiplier: 1.25, flatBonus: 100_000 },
    TAXPAYER: { incomingMultiplier: 1.25, flatBonus: 100_000 },
    SECOND_APRON: { incomingMultiplier: 1.0, flatBonus: 0 }
  },
  MAX_SALARY_TIERS: {
    TIER_1: 0.25, // 0-6 years
    TIER_2: 0.30, // 7-9 years
    TIER_3: 0.35  // 10+ years
  },
  ROSTER_LIMITS: {
    IN_SEASON_MIN: 12,
    IN_SEASON_MAX: 15,
    OFFSEASON_MAX: 21
  }
} as const;

// src/domain/errors/index.ts
export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SalaryMatchingError extends DomainError {
  constructor(message: string) {
    super("SALARY_MATCHING_VIOLATION", message);
  }
}

export class HardCapError extends DomainError {
  constructor(message: string) {
    super("HARD_CAP_VIOLATION", message);
  }
}

export class RosterSizeError extends DomainError {
  constructor(message: string) {
    super("ROSTER_SIZE_VIOLATION", message);
  }
}

// src/domain/entities/Trade.ts (updated)
import { DomainError } from "../errors";

export interface TradeValidationResult {
  isValid: boolean;
  errors: DomainError[];
  warnings: string[];
  details: {
    teamA: TeamTradeDetails;
    teamB: TeamTradeDetails;
  };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | SalaryCapCalculator | Verify cap space math, including cap holds and the exact progressive luxury tax calculation from specs. |
| Unit | TradeValidator | Mock trades across all 5 matching scenarios (Non-tax low/mid/high, Taxpayer, Second Apron) to assert proper `DomainError` generation. |
| Unit | RosterValidator | Test in-season vs offseason boundaries (12, 15, 21). |
| Unit | ContractGenerator | Test generation of max salaries for 3 YOE tiers against the base cap. |

## Migration / Rollout

No migration required. The `src/domain` layer has no external dependencies or database impact. The changes strictly refactor and extend the existing isolated business logic.

## Open Questions

- [ ] Does a player's `yearsOfExperience` need to be explicitly added to the `Player` entity to support the `ContractGenerator`, or will we derive it from `createdAt` / `startYear`? (Assumption: will be added to `Player.ts` or passed explicitly).
- [ ] What is the precise active/inactive split for `RosterValidator`? The proposal mentions 12-15 limits but standard rules sometimes allow up to 15 + 3 two-way contracts.
