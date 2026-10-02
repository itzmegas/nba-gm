# Trades regression coverage

Path: `odd/tasks/trades-regression-coverage.md`
Base: local `develop` at `35e83ff`; branch: `test/trades-regression-coverage`.

## Objective and scope

Add one local-only, reviewable regression-test work unit for trade season propagation, roster/loading guards, and team imagery already implemented on `develop`. Authorized changes: this document and genuinely new tests in `tests/application/services/TradeEngine.test.ts` and `tests/presentation/trades/TradesPage.test.tsx`. Do not change implementation, manifests, historical task docs, or existing domain threshold tests. No push, PR, fetch, remote inspection, credential use, or native review lifecycle is authorized.

Route: delegated two-file test work unit selected because the service and presentation tests are nontrivial; execute locally without spawning child agents. TDD mode is unknown and must not be assumed enabled. Runner: Bun with Vitest (`bun x vitest run`).

## Tasks

- [x] TRC-01 Compare historical branch tests against `develop`; select nonduplicated behavior coverage.
- [x] TRC-02 Add season-propagation service regression and UI roster/season/loading/imagery regressions.
- [x] TRC-03 Run focused Vitest, TypeScript, Biome, build, and full Vitest; establish equivalent unchanged-base evidence for full-suite failures.
- [x] TRC-04 Inspect diff and commit one scoped conventional work unit; record SHA in the Engram mirror.

## Acceptance and evidence

Focused tests and applicable scoped checks pass. Full-suite failures, if any, must be compared with unchanged `develop` and reported precisely, never labeled PASS. Final diff against `develop` contains only the two test paths and this document, with under 400 authored changed lines without compression. Runtime harness: N/A (tests exercise existing pure service/UI integration; no new runtime boundary). Historical full-suite failures reported before #7: dashboard Sun mock and Spanish NBSP; reproduced independently on unchanged current-base paths.

## Verification and delivery

- `bun x vitest run tests/application/services/TradeEngine.test.ts tests/presentation/trades/TradesPage.test.tsx`: 2 files, 5 tests passed.
- `bun x tsc --noEmit`, `bun x biome check .` (244 files), `bun run build`, and `git diff --check`: passed.
- `bun x vitest run`: **not passing**; 44/46 files passed, 288 tests passed, one failed test and one failed-to-load suite. Dashboard lacks `Sun` in its `lucide-react` mock; Spanish date expectation uses NBSP where runtime emitted an ordinary space.
- Equivalent base evidence: both failures reproduce with only `tests/components/dashboard.test.tsx` and `tests/i18n/formatters.test.ts` selected; the tests and implicated source are unchanged versus `develop` (candidate paths are limited to two trade tests and this document). No candidate trade test failed. Do not label full-suite result PASS.

Commit: planned `test(trades): cover season and imagery regressions`; final SHA belongs in the Engram mirror because a commit cannot contain its own hash. Rollback: revert the single candidate commit to remove only its tests and this task record.
