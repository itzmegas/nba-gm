# Tasks: Player Career Mode

## Delivery Plan

- **Chain strategy**: `feature-branch-chain`.
- **PR order**: PR1 → PR2 → PR3.
- **Branch rule**: PR1 targets the tracker/feature branch, PR2 targets PR1's branch, PR3 targets PR2's branch; only the tracker branch lands on `main`.
- **Budget**: authoritative authored ledger is 827 lines (PR1 390 + PR2 256 + PR3 59 + runtime coverage 92 + bounded correction 30). The user explicitly approved this 27-line size exception; no implementation PR exceeds 400.
- **Scope rule**: implement the approved final design only; no deferred features, no RPCs, no GM-table writes.
- **Actual progress**: PR1 is complete at 390 authored lines, PR2 at 256, PR3 at 59, runtime coverage at 92, and the bounded correction at 30; authoritative cumulative count is 827, including authenticated cache keys and stage-matched roll guards.
- **Verification coverage**: 17/17 requirements and 36/36 scenarios accepted; 23 have direct runtime/runtime-seam evidence and 13 are authorized source-backed residuals where real database/browser harnesses are not configured.

## Phase 1: PR1 — Domain, schema, pure functions, focused tests

**Start boundary**: begin from the approved exploration/proposal/spec/design only.

**Finish boundary**: `scripts/schema.sql`, `src/domain/entities/CareerSave.ts`, `src/domain/constants/career-events.ts`, `src/domain/repositories/CareerSaveRepository.ts`, `src/domain/entities/index.ts`, `src/domain/repositories/index.ts`, and `tests/domain/entities/CareerSave.test.ts` are the only intended content changes in this unit.

**Dependencies**: none; this is the foundation for PR2 and PR3.

**Verification**: `bun biome check` and `bun vitest run tests/domain/entities/CareerSave.test.ts`.

**Rollback boundary**: revert only the schema DDL, domain entity/constants/repository interface, barrel exports, and the focused vitest file.

- [x] 1.1 Update `scripts/schema.sql` with the `career_saves` table, the four CHECK constraints, the owner RLS `FOR ALL` policy, and the `idx_career_saves_user_id` index; do not add history tables, RPCs, or GM-table writes.
- [x] 1.2 Create `src/domain/entities/CareerSave.ts` with `CAREER_STAGE`, `CAREER_POSITION`, `COLLEGES`, `CareerSave`, `PendingCareerEvent`, `CareerEventEffects`, `careerSaveSchema`, `supabaseRowSchema`, `pendingEventSchema`, `createCareerSaveInputSchema`, `resolveEventInputSchema`, `draftPickInputSchema`, `parseSupabaseRow`, and `applyChoice`.
- [x] 1.3 Create `src/domain/constants/career-events.ts` with the 4 hard-coded templates, deterministic `selectEvent`, and deterministic `pickNbaOffers` over a team-ID-deduplicated catalog.
- [x] 1.4 Create `src/domain/repositories/CareerSaveRepository.ts` with read/list/create only; keep lifecycle writes out of the repository contract.
- [x] 1.5 Update `src/domain/entities/index.ts` and `src/domain/repositories/index.ts` to export the new domain surface needed by PR2 and PR3.
- [x] 1.6 Add `tests/domain/entities/CareerSave.test.ts` covering `applyChoice` progression/clamping, valid and malformed `parseSupabaseRow`, deterministic and stage-filtered `selectEvent`, deterministic distinct `pickNbaOffers`, duplicate-heavy and too-small catalog rejection, and `draftPickInputSchema` duplicate `offerIds` rejection.

## Phase 2: PR2 — Infrastructure repository, hooks, conditional updates

**Start boundary**: branch from PR1 only after the PR1 domain contract is green.

**Finish boundary**: `src/infrastructure/repositories/SupabaseCareerSaveRepository.ts`, `src/application/hooks/career/useCareer.ts`, and `src/infrastructure/repositories/index.ts` are the only intended content changes in this unit.

**Dependencies**: PR1 must be merged or otherwise present in the branch chain.

**Verification**: `bun biome check` and `bun vitest run` if any hook/repository tests are added during the unit; otherwise keep the domain vitest suite green as the regression floor.

**Rollback boundary**: revert only the repository implementation, career hook file, and the infrastructure export.

- [x] 2.1 Create `src/infrastructure/repositories/SupabaseCareerSaveRepository.ts` with `getById`, `getByUserId`, and `create`, delegating row parsing to `parseSupabaseRow` and setting `current_overall` to 60 on create.
- [x] 2.2 Create `src/application/hooks/career/useCareer.ts` with the 7 hooks from the design: `useCareerSaves`, `useCareerSave`, `useCreateCareerSave`, `useRollEvent`, `useResolveEvent`, `usePickDraftTeam`, and `useRetireCareer`.
- [x] 2.3 Implement the four narrow conditional updates in the hooks only: roll, resolve, draft pick, and retire; keep the repository read/list/create-only and avoid generic `Partial<CareerSave>` updates.
- [x] 2.4 Enforce the cooperative-client limitation in hook logic and comments: lifecycle `WHERE` guards are consistency checks, not a security boundary, and authenticated owners can bypass them only through direct Supabase calls on their own row.
- [x] 2.5 Implement zero-row handling with `maybeSingle()`, query invalidation, and `StaleCareerError`; keep the draft-pick precheck for `offerIds.includes(teamId)` plus duplicate `offerIds` validation, and do not add RPCs.
- [x] 2.6 Update `src/infrastructure/repositories/index.ts` to export `SupabaseCareerSaveRepository`.

## Phase 3: PR3 — Presentation, list/create, dashboard states

**Start boundary**: branch from PR2 only after the hook layer is green and stable.

**Finish boundary**: `src/app/(protected)/page.tsx`, `src/app/(protected)/career/page.tsx`, and `src/app/(protected)/career/[careerId]/page.tsx`, plus the strictly necessary stale-refetch sequencing correction in `src/application/hooks/career/useCareer.ts`.

**Dependencies**: PR2 must be merged or otherwise present in the branch chain.

**Verification**: `bun biome check` and `bun vitest run` as the regression floor; keep PR3 at or below 150 authored lines, record the user-approved 827-line size exception, and verify no deferred route or GM-table edits were introduced.

**Rollback boundary**: revert only the landing card, career list/create page, and career dashboard page.

- [x] 3.1 Add an additive `Player Career` entry to `src/app/(protected)/page.tsx` that links to `/career` and leaves the existing GM page untouched.
- [x] 3.2 Create `src/app/(protected)/career/page.tsx` with the career list plus inlined create form, using existing UI primitives and only the required loading/error/empty states; do not add `/career/new`.
- [x] 3.3 Create `src/app/(protected)/career/[careerId]/page.tsx` with the required dashboard branches: pending event, draft offers, NBA advance/retire, stale refresh, and retired legacy summary.
- [x] 3.4 Keep the dashboard logic additive and hermetic: no Declare button, no extra route/layout/store/components/history/GM writes, and no deferred features.
- [x] 3.5 Wire the dashboard to the hook outputs and state branches required by the spec only; keep copy, markup, and branching minimal.

## Result Contract

- **status**: success
- **executive_summary**: Created the PR-scoped implementation task breakdown for `player-career-mode` with the approved 3-way chain, exact file boundaries, and verification/rollback rules.
- **artifacts**: `openspec/changes/player-career-mode/tasks.md`; Engram topic `sdd/player-career-mode/tasks`.
- **progress**: PR1 complete (6/6 tasks) at 390 authored lines; PR2 complete (6/6 tasks) at 256; PR3 complete (5/5) at 59; runtime coverage at 92; bounded correction at 30; authoritative total 827.
- **next_recommended**: archive the change under the explicit user-approved 27-line size exception.
- **risks**: The 827-line total exceeds the default 800-line hard stop by 27 lines; this is an explicit user-approved size exception, not an accidental overrun.
- **skill_resolution**: `sdd-tasks`, `chained-pr`, `work-unit-commits`, `ponytail`.
