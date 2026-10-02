# Free-agency decision market

## Objective
Implement a save-specific unrestricted free-agent market with explainable offers, basic AI competition, game-time resolution, safe signing, and sporting impact.

## Problem and scope
The existing navigation has no playable market. Canonical imported contract snapshots are immutable after initialization; runtime contracts require a separate live-state boundary without weakening imported provenance.

Authorized: currently available players without a team in the save; salary and duration offers; shared human/AI legality; atomic roster and contract resolution; market UI; roster-aware simulation strength.

Excluded: real-world synchronization, new-game start-date choices, contract expiration, offseason rollover, Bird renewals, restricted free agents, sign-and-trade, and advanced negotiation.

## Constraints
- Domain stays independent of infrastructure and presentation.
- Never infer free agency from missing future salary observations.
- Preserve immutable imported contract data and save isolation.
- Enforce ownership, transactional signing and double-signing protection server-side.
- Player preferences are simulated factors, not asserted real-world facts.
- Offers resolve on simulated time advancement, not on submission. Next-day resolution is the proposed initial policy.
- Use Bun, strict TypeScript, alias imports, Biome, and existing testing conventions.
- No remote execution, publishing, push, or PR creation is authorized.

## Delivery and verification
- Strategy: ask-on-risk with a user-selected review budget of 800 authored changed lines (additions plus deletions, generated files excluded). Split into coherent reviewable slices when the budget is exceeded; chain topology remains undecided until slicing is needed.
- Planning forecast: 1,200–2,000 authored changed lines across five units, excluding generated files; provisional, not measured.
- Running committed authored count: 0. Work-unit commits: none.
- Current branch: feat/free-agency-market, created from develop at 35e83ff258f3cca582543631398e134770c66a34; unrelated trades-regression commit excluded.
- RDD: on by default. FA-01 workspace candidate (611 additions) was approved and acknowledged under lineage review-41fb86f41ca27646; authority burned. No commit boundary established yet.
- The 800-line budget replaces the default 400-line delivery heuristic for this feature; it is not a reason to omit tests or compress code. Native risk assessment and review requirements remain unchanged.
- Default test-first policy: observe deterministic RED, implement GREEN, then refactor. TDD configuration source and exact runner must be confirmed before delegation.
- Candidate focused runner: bunx vitest run <verified test paths>; verify configuration before execution.
- Required closure check: bun biome check. Include relevant type checks and full checks once their actual commands are confirmed.
- Live database/transaction verification requires an available authorized local test environment; static SQL assertions are not functional transaction proof.

## Tasks
- [ ] FA-01: Domain eligibility, offer validation and explainable evaluation.
  - Route: delegated direct; preparation and multiple non-trivial implementation files require a bounded writer.
  - Acceptance: save-specific eligible pool, malformed/illegal offer rejection, deterministic evaluation reasons, shared human/AI rules and focused behavior tests.
- [ ] FA-02: Runtime offers, contracts and atomic signing persistence.
  - Route: delegated direct; SQL and infrastructure changes require bounded implementation.
  - Acceptance: owned-save access, retained immutable provenance, unified active-contract reads, competing-offer safety, rollback and duplicate-resolution protection.
- [ ] FA-03: Game-day market resolution and basic AI participation.
  - Route: delegated direct; SQL/day-advance integration spans multiple non-trivial files.
  - Acceptance: no instant signing, identical single-day/range semantics, shared legality, explicit resolution ordering and replay protection.
- [ ] FA-04: Market screen, offer submission and cache refresh.
  - Route: delegated direct; presentation and application hooks require multiple files.
  - Acceptance: existing dashboard navigation reaches the market, clear status/reasons, updated roster/payroll/market after resolution.
- [ ] FA-05: Roster-aware sporting impact.
  - Route: delegated direct; simulation formula and integration require bounded implementation and tests.
  - Acceptance: save-specific acquisitions affect team strength with deterministic regression tests; formula documented before integration.

## Progress and next step
FA-01 domain implementation and focused checks completed. Independent verification confirmed two full-suite failures on the unchanged base and identified numeric overflow; the writer corrected it with observed assertion RED followed by GREEN. Native reliability review was granted, approved and acknowledged. FA-01 remains unchecked until its work-unit commit is recorded.

Record the first work-unit commit after explicit commit authorization, then plan FA-02 persistence. Monitor the 800-line review budget and resolve chain topology when slicing is needed. Future tasks remain pending. This post-acknowledgement tracking-only update is not part of the 611-line reviewed candidate; executable source and tests remain unchanged.

## FA-01 implementation notes

- The domain API accepts only explicitly classified unrestricted free agents whose game player state is active and teamless, with matching player/game identity and no resolved active contract. Missing or unclassified contract data is not proof of availability. The later source adapter must establish `confirmed-unrestricted-free-agent` from an authoritative classification; this unit does not infer it from salary gaps.
- Offers are flat annual salary for one to five years. Shared evaluation validates salary/year inputs, game isolation, supported salary maximum, in-season roster maximum (15), and cap room or the verified years-of-service minimum salary exception. The caller-provided payroll must include all cap charges it knows; this unit does not infer cap holds. No other exception, Bird right, RFA, term-specific financial rule, signing, or expiration is modeled.
- Minimums come from `MinimumSalarySchedule`; season cap and salary tiers come from `nba-rules`. Unknown minimum schedules fail closed. The evaluator returns stable reason codes plus detail and deterministic scores.
- Simulation policy defaults to money/opportunity/team-quality weights of 0.60/0.25/0.15. Opportunity and team quality are explicit 0–100 inputs; these are tunable simulated team context, not asserted player preferences or personality data.
- Verification: `bunx vitest run tests/domain/freeAgency` passed (8/8); `bun biome check` passed (245 files); `bunx tsc --noEmit` passed. Full `bunx vitest run` had 44/46 files pass and 290/291 tests pass; `tests/components/dashboard.test.tsx` (missing mocked `Sun` export) and the Spanish date NBSP assertion in `tests/i18n/formatters.test.ts` were reproduced on archived untouched base `35e83ff258f3cca582543631398e134770c66a34` with installed dependencies. Parent owns FA-01 checkbox changes; FA-01 remains unchecked.
- Native review: approved with non-blocking observations R3-illegal-offer-positive-score and R3-roster-max-legal-unasserted. No correction was opened. Follow-up: define the score contract for illegal offers before ranking competing offers; strengthen the full-roster test to assert legal=false. Findings do not authorize further source edits or reopen this candidate.
