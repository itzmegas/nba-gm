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
- Strategy: ask-on-risk; user-selected feature-branch-chain, with 800 authored changed lines per reviewable delivery slice (additions plus deletions, generated files excluded). Child slices depend on their immediate predecessor; integrate the complete playable feature before targeting develop. No remote publication is authorized.
- Planning forecast: FA-02a was initially estimated at 450–650 lines. The completed API/evidence slice is 269 authored changed lines; the dependent SQL/harness/documentation slice is estimated at 681 lines. Together the feature work is approximately 950 lines, delivered as separate slices rather than compressed or omitted. Later units still require forecasts.
- Running committed authored count: 881 (612 + 269). FA-01 work-unit commit: 36f3325e5026057de15d41e2ac5e291e27939264 (612 additions, no deletions); FA-02a1 API/evidence commit: fc0ebfb10a93336849a70fc39a3fbc7c4c16baa7 (269 authored changed lines).
- Delivery slice 1: domain engine, `feat/free-agency-domain` at 36f3325e5026057de15d41e2ac5e291e27939264. Delivery slice 2: FA-02a1 API/evidence, commit fc0ebfb10a93336849a70fc39a3fbc7c4c16baa7. Delivery slice 3: FA-02a2 SQL, transaction harness and documentation, based on slice 2 and still pending. Delivery slice 4: FA-02b internal signing and effective-contract reads, dependent on slice 3. Local slice branches preserve predecessor boundaries; draft tracker and child PR creation remain separately authorized future actions.
- Current implementation branch: `feat/free-agency-offers-sql`, based on fc0ebfb10a93336849a70fc39a3fbc7c4c16baa7. The feature tracker remains on `feat/free-agency-market` at the slice-1 boundary 36f3325e5026057de15d41e2ac5e291e27939264. The chain is `feat/free-agency-domain` → `feat/free-agency-offers` → `feat/free-agency-offers-sql`; unrelated trades-regression commits remain excluded.
- RDD: on by default. FA-01 workspace candidate (611 additions) was approved and acknowledged under lineage review-41fb86f41ca27646; authority burned. FA-02a1's exact five-file, 269-line staged projection had SHA-256 `dc22a9cd4d09a7bd07d38420377e179e928b74899bad7c819f0f4745baf88223`; native reliability review approved and acknowledged it under lineage review-54d5dc74b3892046; authority burned. The post-commit assessment was medium, 269 lines, `review_due=false`, under budget. Keep the approval and assessment distinct; do not relabel the candidate as `already_reviewed`. Next source-review boundary is the uncommitted FA-02a2 SQL/harness slice.
- The 800-line budget replaces the default 400-line delivery heuristic for this feature; it is not a reason to omit tests or compress code. Native risk assessment and review requirements remain unchanged.
- Default test-first policy: observe deterministic RED, implement GREEN, then refactor. TDD configuration source and exact runner must be confirmed before delegation.
- Candidate focused runner: bunx vitest run <verified test paths>; verify configuration before execution.
- Required closure check: bun biome check. Include relevant type checks and full checks once their actual commands are confirmed.
- Live database/transaction verification requires an available authorized local test environment; static SQL assertions are not functional transaction proof.

## Tasks
- [x] FA-01: Domain eligibility, offer validation and explainable evaluation.
  - Route: delegated direct; preparation and multiple non-trivial implementation files require a bounded writer.
  - Acceptance: save-specific eligible pool, malformed/illegal offer rejection, deterministic evaluation reasons, shared human/AI rules and focused behavior tests.
  - Evidence: commit 36f3325e5026057de15d41e2ac5e291e27939264; focused 8/8, Biome and TypeScript passed; native approved/acknowledged with two non-blocking follow-ups. Runtime harness: N/A, pure domain API only. Rollback: remove the two new domain/test files without affecting existing runtime behavior.
- [ ] FA-02: Runtime offers, contracts and atomic signing persistence.
  - Route: delegated direct; SQL and infrastructure changes require bounded implementation.
  - Acceptance: owned-save access, retained immutable provenance, unified active-contract reads, competing-offer safety, rollback and duplicate-resolution protection.
  - [ ] FA-02a: Explicit simulated enrollment and save-owned pending offers; repository, migration 020, domain availability evidence and tests. This parent task remains open until both child slices are committed and verified. No instant signing or automatic real-world availability inference.
    - [x] FA-02a1: Domain availability evidence and pending-offer repository API. Five files only: `src/domain/freeAgency/freeAgencyMarket.ts`, `src/domain/freeAgency/FreeAgencyRepository.ts`, `src/infrastructure/freeAgency/SupabaseFreeAgencyRepository.ts`, `tests/domain/freeAgency/freeAgencyMarket.test.ts`, and `tests/infrastructure/freeAgency/SupabaseFreeAgencyRepository.test.ts`. Evidence: commit fc0ebfb10a93336849a70fc39a3fbc7c4c16baa7; 269 authored changed lines; review candidate SHA-256 dc22a9cd4d09a7bd07d38420377e179e928b74899bad7c819f0f4745baf88223; reliability approved and acknowledged under review-54d5dc74b3892046. Non-blocking suggestions remain recorded; no correction was opened.
    - [ ] FA-02a2: Migration 020 and canonical schema mirror, SQL invariants, disposable PostgreSQL harness/fixtures, and this documentation update. Estimated 681 lines. The SQL/API implementations are not yet committed or independently reviewed; the repository calls the future RPC names, but no SQL RPC implementation is yet part of the committed chain.
  - [ ] FA-02b: Internal atomic signing and effective-contract overlay; migration 021, repositories, runtime provenance and transaction tests. Forecast 650–950 lines; one cohesive slicing pass if actual candidate exceeds 800.
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
FA-01 committed and checked off. Independent verification confirmed two full-suite failures on the unchanged base and identified numeric overflow; the writer corrected it with observed assertion RED followed by GREEN. Native reliability review was granted, approved and acknowledged.

FA-02a1 is committed on `feat/free-agency-offers` after slice 1 (`feat/free-agency-domain` at 36f3325e5026057de15d41e2ac5e291e27939264). The feature-tracker branch remains at the slice-1 boundary. The FA-02a2 SQL/harness/documentation slice is in progress on `feat/free-agency-offers-sql`, based on the API commit. The authorized disposable PostgreSQL 17.11 container passed the transaction harness and was then removed by the parent using only the approved local Docker socket. No container is currently running; the image remains, and no volumes were created or deleted. This fixture proves FA-02a behavior against minimal compatible tables, not the full production migration chain. No live application database was accessed. Delivery topology is a feature-branch chain with an 800-line budget per slice; later tasks remain pending.

## FA-01 implementation notes

- The domain API accepts only explicitly classified unrestricted free agents whose game player state is active and teamless, with matching player/game identity and no resolved active contract. Missing or unclassified contract data is not proof of availability. The later source adapter must establish `confirmed-unrestricted-free-agent` from an authoritative classification; this unit does not infer it from salary gaps.
- Offers are flat annual salary for one to five years. Shared evaluation validates salary/year inputs, game isolation, supported salary maximum, in-season roster maximum (15), and cap room or the verified years-of-service minimum salary exception. The caller-provided payroll must include all cap charges it knows; this unit does not infer cap holds. No other exception, Bird right, RFA, term-specific financial rule, signing, or expiration is modeled.
- Minimums come from `MinimumSalarySchedule`; season cap and salary tiers come from `nba-rules`. Unknown minimum schedules fail closed. The evaluator returns stable reason codes plus detail and deterministic scores.
- Simulation policy defaults to money/opportunity/team-quality weights of 0.60/0.25/0.15. Opportunity and team quality are explicit 0–100 inputs; these are tunable simulated team context, not asserted player preferences or personality data.
- Verification: `bunx vitest run tests/domain/freeAgency` passed (8/8); `bun biome check` passed (245 files); `bunx tsc --noEmit` passed. Full `bunx vitest run` had 44/46 files pass and 290/291 tests pass; `tests/components/dashboard.test.tsx` (missing mocked `Sun` export) and the Spanish date NBSP assertion in `tests/i18n/formatters.test.ts` were reproduced on archived untouched base `35e83ff258f3cca582543631398e134770c66a34` with installed dependencies.
- Native review: approved with non-blocking observations R3-illegal-offer-positive-score and R3-roster-max-legal-unasserted. No correction was opened. Follow-up: define the score contract for illegal offers before ranking competing offers; strengthen the full-roster test to assert legal=false. Findings do not authorize further source edits or reopen this candidate.
- Commit assessment: medium, review_due=true, slice_budget_reached. Exact committed range (612 additions) was separately consented, approved and acknowledged under lineage review-3cc068d25c8a591d; authority burned. Review found no new issues and retained the two suggestions. The native assessment still uses its own slice threshold; the user-selected 800-line delivery budget did not change native risk selection.

## FA-02 exploration notes
- Mutable runtime offers/contracts must overlay immutable imported snapshots; signing must atomically update game player state and reject competing offers with replay protection.
- Server-side legality must derive ownership, roster and payroll from authoritative state, not trust submitted scores or client payroll.
- Imported data classifies contracts, not UFA availability, and modern seed excludes teamless players. Use explicit simulation-bootstrap enrollment without fabricating observed-standard provenance; fixtures/bootstrap enrollment does not assert real-world availability. Playable pool population policy remains separate from the persistence engine.
- At the initial exploration, no postgres/initdb/pg_ctl/psql/supabase tools or local DB harness were found in PATH/repository. For FA-02a2, the user-authorized isolated Docker PostgreSQL fixture was used and later removed; no host, cloud, or application database was accessed, and no credentials were read.
- Candidate surfaces FA-02a: scripts/schema.sql; src/domain/freeAgency/freeAgencyMarket.ts; tests/domain/freeAgency/freeAgencyMarket.test.ts; scripts/migrations/020_free_agency_offers.sql; src/domain/freeAgency/FreeAgencyRepository.ts; src/infrastructure/freeAgency/SupabaseFreeAgencyRepository.ts; tests/infrastructure/freeAgency/SupabaseFreeAgencyRepository.test.ts; tests/infrastructure/supabase/freeAgencyOffersInvariant.test.ts; this task document. Migration 020/021 names confirmed available.
- FA-02a focused runner: `bunx vitest run tests/domain/freeAgency/freeAgencyMarket.test.ts tests/infrastructure/freeAgency/SupabaseFreeAgencyRepository.test.ts tests/infrastructure/supabase/freeAgencyOffersInvariant.test.ts`; passed 14/14 across the assembled candidate. The exact transaction harness `bun scripts/test-free-agency-postgres.ts 2dccfd47a5949b9675a47184e20d6db66ccaeb40ecd7a65b590f685284ccc0e7` passed against the isolated fixture before its removal. `bun biome check` passed (250 files); `bunx tsc --noEmit` passed. Full `bunx vitest run` had 46/48 files pass; the only failures were the known base failures `tests/components/dashboard.test.tsx` (missing mocked `Sun`) and the Spanish date NBSP assertion in `tests/i18n/formatters.test.ts`. The SQL harness uses minimal compatible fixtures and does not replay full production migrations or prove production-wide RLS/trigger behavior.
- Current execute_trade_transactional transfers legacy contracts only. Direct owner roster-write policies require integrity controls before signing; runtime-overlay reads must preserve complete legacy fallback and use effective roster ownership. Provider registry wiring is not required for constructor-injected persistence.

## FA-02a implementation notes

- Explicit simulated availability is represented separately from imported observed-contract evidence. Service-role bootstrap enrollment requires an active modern save with materialized contract coverage and an active teamless game player without a current game agreement; it never writes imported contracts or observed provenance. Teamless players are not enrolled automatically, so the offer market can remain empty until an authorized bootstrap supplies player IDs.
- The committed repository API calls RPC names, but the corresponding SQL RPC implementations await FA-02a2. There is no public signing or acceptance API in FA-02a. The SQL candidate defines authenticated offer submission to derive save owner, selected team, simulation date, player state, enrollment, active agreement absence, payroll, and roster size from authoritative rows. The request cannot supply a team, due date, legality flag, payroll, or score. Reusing a request ID with the same offer returns its existing pending row; changing that payload fails.
- Submission checks supported 2026-27 minimum salary and cap-derived maximum, one-to-five years, the selected team's current cap room (with only the modeled minimum-salary exception), and the 15-player roster maximum. Other seasons fail closed. Cap legality is checked at submission but pending offers reserve no cap or roster room; FA-02b must recheck authoritative finances and roster before resolution. There is no acceptance, signing, or concurrency-resolution API in this unit.
- Migration 020 is mirrored by 173 authored lines in `scripts/schema.sql`. The PostgreSQL harness uses a disposable local PostgreSQL 17 container with minimal compatible auth/game/contract fixtures. It proved the candidate migration's function and table behavior against those fixtures; it does not replay full production schema migrations or prove application-wide snapshot triggers/RLS policies. Parent removed the test container after success.
