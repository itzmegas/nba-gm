# Proposal: rules-engine

## Intent

Implement the core NBA Business Rules domain logic as defined in the updated `docs/NBA_BUSINESS_RULES.md`. This change is critical for the MVP simulation to accurately enforce constraints on team building, salary caps, trades, and contract negotiations. By establishing pure domain services for these rules, we ensure a highly cohesive, framework-agnostic rules engine at the core of the Clean/Hexagonal Architecture.

## Scope

### In Scope
- **Salary Cap Engine**: Calculate team cap space, luxury tax lines, and cap holds based on the 2024-25 cap values and rules.
- **Trade Validator Engine**: Implement salary matching logic with 3-tier rules (taxpayer, non-taxpayer, room) and apron restrictions.
- **Roster Validator**: Enforce in-season (12-15) and offseason (up to 21) roster limits, plus minimum requirements.
- **Contract Generator**: Calculate maximum salary constraints based on years of experience tiers (25/30/35%) and Bird rights.

### Out of Scope
- UI/Presentation layer updates to consume these rules (deferred to a later phase).
- Database schema changes or Supabase migrations (handled in infrastructure separately).
- Complex exceptions like Bi-Annual Exception (BAE) or complex injury exceptions.

## Approach

Create pure TypeScript modules in the `src/domain/services/` layer to handle the business logic, adhering strictly to the Hexagonal Architecture pattern. The engines will consume domain entities (Team, Player, Contract) and output validation results or calculated values. 
- Use functional programming principles for deterministic rule evaluation.
- Return structured validation objects (e.g., `{ isValid: boolean; errors: string[] }`) for operations that can fail.
- Define constants for salary cap figures, max percentage tiers, and roster limits in a centralized configuration file within the domain layer.

## Affected Areas

| Area | Layer | Impact | Description |
|------|-------|--------|-------------|
| `src/domain/services/salary-cap.service.ts` | Domain | New | Calculates cap space, tax, and holds |
| `src/domain/services/trade-validator.service.ts` | Domain | New | Evaluates trade legality (salary matching/aprons) |
| `src/domain/services/roster-validator.service.ts` | Domain | New | Enforces 15-man active/inactive limits |
| `src/domain/services/contract.service.ts` | Domain | New | Calculates max salary limits by experience |
| `src/domain/constants/nba-rules.ts` | Domain | New | Centralized rules/cap figures |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rule misinterpretation (e.g., trade matching tiers) | Medium | Write exhaustive unit tests directly translating from `docs/NBA_BUSINESS_RULES.md`. |
| Performance overhead on large calculations | Low | Use pure functional mapping; domain logic should be lightweight and deterministic. |
| Type complexity with nested Player/Contract entities | Medium | Leverage strict TypeScript interfaces/types at the domain boundary. |

## Rollback Plan

Delete the newly created files in `src/domain/services/` and `src/domain/constants/`. Since these are pure domain additions with no incoming dependencies yet, rollback carries zero risk to existing application, infrastructure, or presentation layers.

## Dependencies

- Existing TS interfaces/types for `Team`, `Player`, and `Contract` in the domain layer.
- `docs/NBA_BUSINESS_RULES.md` as the source of truth.

## Success Criteria

- [ ] `SalaryCapEngine` correctly calculates available cap space for a team with mixed contract types.
- [ ] `TradeValidator` successfully approves or rejects trades across all 3 salary matching tiers.
- [ ] `RosterValidator` flags teams with < 8 or > 15 players during the season.
- [ ] `ContractGenerator` accurately limits max salaries for 0-6, 7-9, and 10+ year veterans.
- [ ] `bun biome check` passes with zero errors for all new domain files.
