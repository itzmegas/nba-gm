# Phase 2 — Server-authoritative trades
Objective: one authenticated trade operation in the existing Next.js/Supabase application. Branch: `test/phase-1-supabase-integration`; baseline: `1fb0388`.
Delivery: local only; user authorized the delivery commit in L3, no push/PR or remote access. Runner: Bun/Vitest, Biome, TypeScript and disposable local PostgreSQL. Forecast: 700–1000 authored lines; no publishing authorized.

## Specs

- S1: "Una operación autenticada de trade dentro del servidor Next.js existente"; "Validación de entrada."; "Identidad obtenida de la sesión, no del payload."; "Ownership y estado autoritativo cargados en servidor."
- S2: "Reglas de negocio sin confiar en salarios/roster enviados por el cliente."; "Atomicidad y garantías frente a concurrencia."; "Errores definidos y pruebas de integración."; "Evaluación explícita de cualquier bypass por invocación directa del RPC."
- S3: "No reescribir el backend, agregar otro servicio/ORM ni migrar todas las lecturas."; "Preservá cambios existentes. Usá Bun, Biome y las capas actuales."
- S4: "No accedas a proyectos remotos ni leas/reutilices credenciales por autorización heredada de otra sesión. Cualquier operación remota requiere confirmar destino, credencial/sesión y operaciones exactas."; "No reproduzcas ese crash ni actives las propuestas 057/058."
- S5: "Si, vamos con esta entrega local primero." Approval refers to the proposed session-backed endpoint, locked authoritative SQL validation, and explicit rejection when hard-cap authority is missing. No new hard-cap persistence model is authorized. Player trades must fail closed with `HARD_CAP_UNKNOWN`; no cap defaults or fabricated values. Picks-only trades cannot affect payroll/roster and may execute with existing asset safeguards.
- S6: Preserve client preview and history reads. Reject extra request fields rather than trusting identity, salary, roster, or cap snapshots. Acceptance: HTTP boundary tests, transactional SQL state comparisons, direct authenticated RPC parity, and per-game concurrency checks in disposable local state. Remote HTTP remains UNVERIFIED.

## Tasks

- [x] T1 — S1–S3,S5–S6; inline (one dependent behavior, no writer trigger); strict request/result/error contract, application port, authenticated Next route, HTTP execution adapter and UI hook; observed missing-module RED then 32 focused GREEN; commit: this work-unit commit.
- [x] T2 — S2,S4–S6; inline (same dependent operation, no writer trigger); independent migration strengthening both RPC names with authoritative game/team/asset checks and fail-closed player gate; missing-RPC RED and SQL rejection/hash rollback/direct-RPC/concurrency GREEN; commit: this work-unit commit.
- [x] T3 — S1–S6; inline plus per-action checking worker and independent verifier for risk items 2/3/4; 1225 tests/146 files, TypeScript and isolated Biome PASS, SQL probes PASS, independent verifier no blockers; workspace Biome baseline-only manifest FAIL; commit: this work-unit commit.

## Log

### L1 — Authorized scope (2026-11-10)

Original implementation objective, verbatim:

> Objetivo de Fase 2:
> Una operación autenticada de trade dentro del servidor Next.js existente, con:
> - Validación de entrada.
> - Identidad obtenida de la sesión, no del payload.
> - Ownership y estado autoritativo cargados en servidor.
> - Reglas de negocio sin confiar en salarios/roster enviados por el cliente.
> - Atomicidad y garantías frente a concurrencia.
> - Errores definidos y pruebas de integración.
> - Evaluación explícita de cualquier bypass por invocación directa del RPC.
>
> No reescribir el backend, agregar otro servicio/ORM ni migrar todas las lecturas.

User approval, verbatim: "Si, vamos con esta entrega local primero."

- Git: clean at `1fb0388` (Engram sync only above `0f46957`); Phase 1 local document remains authoritative. Historical 1191-test evidence is not a fresh check.
- Read-only mapping found no authoritative hard-cap source. Approval explicitly accepted fail-closed behavior; no persistence model or privileged identity handoff will be invented. This limits operational player-trade availability and must remain visible in the delivery report.
- Route: direct inline; SQL and HTTP are one dependent behavior, not independent parallel writer units. Risk: items 2 (session/ownership), 3 (existing RPC contract and shared execution path), 4 (transaction ordering).
- SQL inspection corrected the exploration handoff: active runtime overrides canonical, not the reverse. A SECURITY DEFINER owner may invoke internal helpers despite authenticated EXECUTE revocation; do not infer otherwise.
- Local source/migration files may be edited; no deployed database, credentials, permissions or migration application. Disposable local database execution is verification only, with explicit local Docker socket and no network or host mounts.

### L2 — Implementation and verification (2026-11-10)

- Added strict command schema, transaction port, application use case, session-backed route and HTTP adapter. UI execution sends identifiers only and explicitly disables mutation retries; client preview and history reads remain unchanged. The route returns the committed transaction UUID without a second history lookup.
- New versioned RPC avoids accidentally calling the weaker deployed function when migration is absent. The compatibility RPC delegates to the same gate. No new tables, cap defaults, privileged actor handoff or duplicate unreachable payroll logic. Player transfers remain unavailable; full player trade rules are NOT implemented.
- RED: new command/route/HTTP-adapter imports failed before implementation. GREEN: 32 focused tests including existing hook and unchanged preview. Existing hook success test updated to mock the new HTTP boundary rather than the old execution engine.
- SQL RED on the original four migrations: expected P2007 received missing-function 42883. Initial fixture readiness accepted the image's temporary init server; fixed by checking final TCP listener. A variable/alias collision produced 42702; corrected. GREEN: exact active-chain replay plus fifth migration; rejected-state hashes, late rollback, immutable canonical terms, pick success/history, direct-RPC parity, one winner/one stale concurrent transfer and revalidation after a concurrent game-state writer. Own tmpfs containers removed after every attempt. No denied anonymous RPC invoked.
- TypeScript initially found untyped Bun.sleep; replaced by standard node:timers/promises without dependencies. Source normalization completed using Biome on exact changed surfaces.
- Isolated full-suite worker: 1220 tests/146 files PASS; compiler PASS; Biome PASS (467 files). Workspace Biome FAIL only unchanged .engram/manifest.json missing final newline; baseline HEAD last byte 0x7d confirms pre-existing. No unrelated formatting repair.
- Independent risk 2/3/4 verifier: all S1–S6 met for the local fail-closed scope, no blockers. Ten additional HTTP probes, actual authenticated RPC rejection hashes/exact errors, reversed concurrent asset order, transferability revalidation and compatibility outputs passed. Baseline/candidate preview/history regressions: 18 tests each PASS; core preview/history files byte-identical. Retained meaningful probes as repository regressions; final checks pending after adoption.
- RDD status reads clone-local OFF; unchanged. No native review started, no commits/push/PR, no remote or credential access, no deployed migration or permission changes, no 057/058. Remote Auth/PostgREST remains UNVERIFIED. Next: final regression readback, scratch cleanup and exact full Engram mirror synchronization.
- Final adopted probes: 19 route tests PASS and SQL runner including authenticated exact-error/hash parity PASS. Updated isolated full suite: 1225 tests/146 files PASS, TypeScript PASS, Biome 467 files PASS. No source changes after the independent verification; only its test probes were retained. All three tasks close only for the explicitly limited local fail-closed slice, not full player trading or remote acceptance.

### L3 — Commit authorization (2026-11-10)

- User, verbatim: "Hace el commit primero antes de continuar".
- Commit the verified local delivery as one coherent behavior, with its migration, tests and documentation; it exceeds the advisory review-size heuristic because splitting HTTP and database authority would leave an incomplete operation. No push or PR is authorized.
- Rollback boundary: revert this work-unit commit to remove the local Phase 2 endpoint, HTTP execution path, fifth migration candidate and associated tests/docs together. No deployed schema rollback is involved: the migration was applied only in discarded local fixtures.
- Pre-commit Git readback matched the previously verified candidate; no unrelated changes. Existing global Biome manifest failure remains unchanged; do not claim a fresh full-suite run for this commit-only action.
