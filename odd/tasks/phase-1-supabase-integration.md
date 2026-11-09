# Phase 1 — Isolated Supabase integration
Objective: prepare isolated TEST and real Auth/PostgREST integration without changing DEV. Branch: `test/phase-1-supabase-integration`; baseline: `198ba06`.
Delivery: ask-on-risk; no publishing. Runner: Bun/Vitest and Biome; SQL checks complement, never replace, HTTP integration. Initial implementation forecast: 350–650 authored lines; resolve slicing before a commit exceeding the advisory budget.

## Specs

- S1: "Crea una nueva rama correspondiente para esta tarea"; "Verificá el estado de Git antes de modificar nada."; "preservá cualquier trabajo existente."
- S2: "Primero recuperá el contexto de Engram del proyecto nba-gm y revisá:" the five paths quoted in L1; "Reconciliar el plan documentado con el estado actual."
- S3: "Antes de cualquier acceso remoto, pedirme el destino exacto del proyecto TEST, la credencial/sesión autorizada y confirmar las operaciones concretas que ejecutarás."; "Confirmar disponibilidad del proyecto y registrar su versión de runtime."
- S4: "Preparar el esquema usando únicamente las cuatro migraciones activas identificadas en el runbook, sobre un destino vacío y confirmado como descartable."
- S5: "Preparar fixtures deterministas con usuarios y datos sintéticos, sin importaciones NBA en vivo ni copias de datos reales."
- S6: "Incorporar guardas que impidan ejecutar herramientas destructivas contra DEV u otro proyecto."
- S7: "Empezar por salud de Auth/PostgREST, autenticación y un flujo mínimo de creación/lectura de partida mediante los repositorios de la aplicación. Después ampliar según la Fase 1."
- S8: "No tocar el Supabase DEV existente."; "No resetear, borrar, reparar historial ni aplicar migraciones sin autorización explícita para esa operación y destino."; "No activar las propuestas 057/058."
- S9: "No repetir la prueba de RPC denegado que produjo el crash documentado; requiere evidencia de runtime seguro por separado."; "No considerar pruebas SQL como sustituto de integración HTTP."
- S10: "No implementar todavía la API de la Fase 2."; "No desplegar a staging/producción ni publicar cambios."; "Usar Bun y Biome; mantener las capas de la arquitectura existente."; "No mostrar secretos y mantener service-role exclusivamente del lado servidor."
- S11: "Reportá resultados como PASS/FAIL/UNVERIFIED, con evidencia observable y limitaciones."

## Tasks

- [x] T1 — S1–S3, S8–S11; inline (bounded local evidence); branch, documentation and read-only preflight reconciled; evidence in L2; commit: docs unit.
- [x] T2 — S3–S4, S6, S8–S11; inline (one understood remote operation, explicit target-bound consent); guarded cleanup committed, public namespace/default ACLs retained; evidence in L3; commit: remote operation only.
- [x] T3 — S4, S8–S11; inline (exact authorized payload application); four payloads committed and direct catalog/HTTP recheck PASS; user explicitly selected direct verification instead of a subagent and then requested continuation; independent remote verification not performed; evidence in L5–L6; commit: docs unit.
- [x] T4 — S5–S6, S8–S11; inline (no writer trigger); minimal deterministic fixture runner/guards and two explicitly authorized remote lifecycles PASS; local RED/GREEN and TypeScript/Biome PASS; no players/contracts/provider snapshots yet (expand under T5); evidence in L7–L8; commit: dce6ba1 (guards) and b3ba23d (runner).
- [ ] T5 — S7–S11; inline (no writer trigger); initial real Auth/repository game create/read/isolation PASS twice; roster/contracts/trades/free-agency/simulation and rejected-write rollback remain UNVERIFIED; expanded fixtures/remote operations need scoped authorization; evidence in L8; commit: docs unit for T5a, pending for the rest.
  - [x] T5a — Reconcile historical HTTP evidence and locally review initial runner/guards; prepare the bounded roster/canonical/runtime fixture specification; evidence in L9; commit: docs unit.
  - [ ] T5b — Implement expanded fixtures, payload/route guard regressions, repository assertions and bounded cleanup locally; then obtain exact remote lifecycle authorization.
  - [ ] T5c — Execute authorized roster/contracts HTTP slice and record persisted state, access matrix and cleanup; remaining T5 workflows stay open.

## Log

### L1 — Original request (2026-11-06)

```text
Crea una nueva rama correspondiente para esta tarea

Vamos a iniciar la Fase 1 del plan de testing de Courtside, manteniendo Supabase.

Primero recuperá el contexto de Engram del proyecto nba-gm y revisá:
- AGENTS.md
- docs/database/development-testing-plan.md
- docs/database/deployment-runbook.md
- docs/database/schema-verification-step-4.md
- docs/database/modern-contract-trade-validation-report.md

Verificá el estado de Git antes de modificar nada. El último estado conocido tenía HEAD 433cfb7 y docs/database/schema-verification-step-4.md sin seguimiento: preservá cualquier trabajo existente.

Objetivo autorizado:
Preparar un Supabase TEST separado del DEV actual, con esquema reproducible, datos sintéticos y pruebas de integración reales mediante Auth/PostgREST.

Orden de trabajo:
1. Reconciliar el plan documentado con el estado actual.
2. Antes de cualquier acceso remoto, pedirme el destino exacto del proyecto TEST, la credencial/sesión autorizada y confirmar las operaciones concretas que ejecutarás. Mi aprobación del enfoque no identifica esos datos ni autoriza usar credenciales ambientales.
3. Confirmar disponibilidad del proyecto y registrar su versión de runtime.
4. Preparar el esquema usando únicamente las cuatro migraciones activas identificadas en el runbook, sobre un destino vacío y confirmado como descartable.
5. Preparar fixtures deterministas con usuarios y datos sintéticos, sin importaciones NBA en vivo ni copias de datos reales.
6. Incorporar guardas que impidan ejecutar herramientas destructivas contra DEV u otro proyecto.
7. Empezar por salud de Auth/PostgREST, autenticación y un flujo mínimo de creación/lectura de partida mediante los repositorios de la aplicación. Después ampliar según la Fase 1.

Restricciones:
- No tocar el Supabase DEV existente.
- No resetear, borrar, reparar historial ni aplicar migraciones sin autorización explícita para esa operación y destino.
- No activar las propuestas 057/058.
- No repetir la prueba de RPC denegado que produjo el crash documentado; requiere evidencia de runtime seguro por separado.
- No considerar pruebas SQL como sustituto de integración HTTP.
- No implementar todavía la API de la Fase 2.
- No desplegar a staging/producción ni publicar cambios.
- Usar Bun y Biome; mantener las capas de la arquitectura existente.
- No mostrar secretos y mantener service-role exclusivamente del lado servidor.

Reportá resultados como PASS/FAIL/UNVERIFIED, con evidencia observable y limitaciones. Empezá por la revisión local y luego pedime únicamente el dato o autorización que realmente bloquee el siguiente paso.
No incluye autorización implícita para resets ni uso de credenciales: esos límites se confirman con el destino concreto en la nueva sesión.
```

### L2 — Local reconciliation and remote read-only authorization

- Engram project resolved to `nba-gm`; prior context recovered. Actual Git HEAD `198ba06` on clean `develop`; Step 4 already tracked. Created the requested branch without changing existing files.
- Read all five requested documents. Four active migration filenames match the runbook; Step 4's old three-file warning is stale. Historical SQL success is not HTTP evidence.
- User identified TEST `wmtezjoitjmjynyvkyke` and explicitly authorized reading only its credentials in `.env.local` without displaying or modifying them, plus bounded availability/runtime/schema/health inspection. Initial HTTP 521 occurred while user reported restoration; later Auth and OpenAPI returned 200.
- User supplied `TEST_DATABASE_URL`; direct PostgreSQL failed, hostname resolved only IPv6 (cause unproven). User replaced active URL with same-project Session pooler; the previous direct URL remains commented. Validate hostname, project-bound username, database and port before connecting; no ambient sessions.
- Runtime observed: PostgreSQL 17.6 x86_64/GCC 15.2.0; GoTrue v2.197.0. Earlier OpenAPI reported PostgREST 14.15; latest response after cleanup reported 14.5. No safe-runtime evidence for denied RPC was established.
- Initial catalog: 23 application tables, 12 functions, one sequence and `game_status` enum. Migration-history table absent. No application rows inspected or copied.

### L3 — Explicit cleanup consent and observed outcome

- User: "Si, confirmo y autorizo" for TEST public cleanup; further discovery found four internal Auth FK triggers and platform-owned default ACLs.
- User: "Si, perfecto, autorizo la limpieza" for removing application objects while preserving namespace/default ACLs, including automatic removal of four internal triggers for `games_user_id_fkey` and `career_saves_user_id_fkey` on `auth.users`.
- First cleanup transaction failed final empty-schema assertion because enum was omitted from the authorized inventory; subsequent read-only inventory confirmed complete rollback (23 tables, 12 functions, one sequence, four triggers).
- User: "si, autorizo" to include `public.game_status` and automatic array. Guarded transaction then committed; recursive dependencies restricted to approved Auth FK triggers and table-owned TOAST objects. Namespace, all default ACLs, extensions and managed relation/function/trigger metadata were compared before/after and preserved.
- PASS: separate postcommit query found zero public relations/functions/types. PASS: Auth and PostgREST HTTP 200; OpenAPI exposes zero tables and zero RPCs. No Auth/Storage user-data operations, migration, history repair, DEV access or crash probe occurred.

### L4 — Exact migration application authorization

- Parent requested authorization to apply only `20260206190001_initial_schema.sql`, `20260206190014_enable_rls.sql`, `20261102170000_reconcile_legacy_through_056.sql`, and `20261104190000_modern_contract_trade_compatibility.sql` against TEST `wmtezjoitjmjynyvkyke` using `TEST_DATABASE_URL`, without resets, repairs or proposals 057/058.
- User: "Si, mandale".
- Read-only local explorer: first two files have no transaction wrapper; latter two each have BEGIN/COMMIT. Catch-up changes postgres default ACLs but does not modify supabase_admin defaults. No top-level fixtures/imports. Expected 42 RLS-enabled tables, one view and 55 functions. History registration remains separate and is not performed by these payloads.
- Risk: item 2 (migration installs RLS, grants and SECURITY DEFINER functions); independent read-only verification follows application checks. Existing broad read/TRUNCATE grants are retained baseline exposure, not a security PASS. No meaningful runnable RED for executing unchanged, historically replayed SQL; verify hashes, prerequisites, resulting catalog and HTTP availability, without claiming workflow integration.

### L5 — Migration application and verification (2026-11-06)

- PASS: exact empty TEST identity, postgres role, platform Auth functions/table and six required roles checked before mutation. Platform-owned public defaults present. Applied only these unchanged payload bytes, sequentially, with confirmed commits:

| Migration | Bytes | SHA-256 |
| --- | ---: | --- |
| `20260206190001_initial_schema.sql` | 1845 | `c07ed43c8a43f702469cf43249bd98ee8ae383a7546f68ace7d8466eccc5a778` |
| `20260206190014_enable_rls.sql` | 657 | `d4a96b8fc6f99e242a299e69d127557559ab3661492544fe4c6931b0245b3937` |
| `20261102170000_reconcile_legacy_through_056.sql` | 316317 | `684b3df933330fbd40eaa3579472c0dd6140b2c2de7ce0649c44db42b4a85807` |
| `20261104190000_modern_contract_trade_compatibility.sql` | 5251 | `ba2d221bc1c5c3d79c21e86f4bb9f99d2f233c427a327fbd67bc4977e80c9495` |

- Execution: Bun SQL reserved connection, verified TLS, explicit TEST URL parsing (never ambient credentials); first two files in runner-managed transactions; latter two executed byte-for-byte with their own BEGIN/COMMIT. No history registration/repair; its table remains absent. Do not blindly rerun this chain against the now-populated schema.
- PASS, parent read-only postchecks: 42 tables/42 RLS enabled, one view, one sequence, 55 functions. Trade RPC retains SECURITY DEFINER, constrained search_path and postgres/authenticated/service_role ACL. `contracts.game_id` remains nullable (058 inactive). All three `supabase_admin` public default ACL entries identical before/after.
- PASS, parent HTTP postchecks: Auth HTTP 200 (GoTrue v2.197.0), PostgREST OpenAPI HTTP 200 (14.5), 43 exposed relation paths, 48 exposed RPC paths. No RPC was invoked. These are availability/catalog checks, not authenticated gameplay integration.
- Independent verifier: PASS for exact four local hashes, unchanged baseline payloads and target-predicate probes; UNVERIFIED for remote checks because its execution constraints prohibited networking. No replacement verifier/retry was launched; missing independent remote proof is a human decision, not a fabricated PASS.
- Verifier handling FAIL: its initial whole-workspace scratch copy included `.env.local`, contrary to explicit no-scratch-secrets instructions. No credential values printed. Parent removed the entire exact verifier-created scratch directory and confirmed it absent. Original environment unchanged. No raw credentials or scratch contents retained in this document.
- Parent spot check: trade payload SHA-256 matched again. `bun biome check`: PASS, 450 files, no fixes. `git diff --check`: PASS. No app/unit suite run: source and SQL payloads unchanged; those tests cannot supply missing HTTP workflow proof.
- No fixtures/users created, no API Phase 2 work, no publishing, no new reset, no proposals, no denied-RPC probe or DEV access. S5–S7 fixture/auth/game outcomes remain UNVERIFIED. Next: resolve missing independent remote proof, then derive and authorize the bounded synthetic fixture lifecycle.

### L6 — User-selected direct verification

- User: "no ejecutes el subagente, comprobalo aca"; after direct checks, "Genial! continuemos". Continue without subagents; do not label parent evidence independent.
- PASS: fresh direct READ ONLY catalog checks reproduced 42/42 RLS tables, one view, one sequence, 55 functions, `game_status`, six public default ACL entries and expected owner/history/nullable contract state. Installed trade function body exactly matched the local migration; ACLs inspected, no invocation.
- PASS: Auth HTTP 200 v2.197.0; PostgREST HTTP 200 v14.5, 43 relation paths/48 RPC paths. No user data reads, writes or configuration changes. The independent verifier restriction was not a reproduced TEST transport/VPN defect.

### L7 — Local fixture runner and guard preparation

- Added `src/infrastructure/supabase/integrationSafety.ts`, `scripts/test-supabase-integration.ts`, `tests/infrastructure/supabase/integrationSafety.test.ts` and `docs/database/phase-1-http-smoke.md`. No existing application repository or schema changed; no dependencies added.
- Initial slice: two fixed synthetic account IDs/emails (random in-memory passwords), one fixed synthetic team, one game created/read by the real repository. Its existing insert trigger creates 14 draft picks plus inventory. Clean up only resources confirmed created by this run; require empty application fixture tables and absent account IDs first. No players/provider/contract imports yet.
- Guard rejects non-TEST origins, RPCs, redirects, unknown endpoints/methods, unrelated account IDs and unscoped team/pick deletes. Dedicated `.env.test.local` is explicitly parsed; never fallback to DEV keys. Always run with `--no-env-file` to disable Bun's automatic application-env loading. Service-role remains in the Bun runner, owner/other sessions use publishable credentials.
- Observed RED: `bun run test tests/infrastructure/supabase/integrationSafety.test.ts` failed before implementation because the new safety module was absent. GREEN: focused guard plus existing game-repository tests passed, 2 files/9 tests. Tests use synthetic keys and mocked fetch only.
- PASS: `bunx --no-install tsc --noEmit`; `bun biome check` (453 files). Initial Biome formatting failures on three new files were fixed, then passed. PASS: `git diff --check`.
- Runtime boundary negative check: `bun run --no-env-file scripts/test-supabase-integration.ts` exited 1 with explicit-confirmation refusal before reading dedicated configuration or reaching its client setup. This is refusal evidence, not live integration success.
- Remote runtime: NOT EXECUTED. Creating private dedicated configuration from commented TEST assignments, creating/deleting users/fixtures and two full smoke runs still need exact operation consent. No new TEST/DEV access or mutations during this implementation. No fixture secrets written.
- Risk: item 2 (target-bound service-role fixture lifecycle and read-isolation testing); user requested no subagents. Direct local checks do not claim independent review or HTTP gameplay PASS. Do not commit this unit as independently verified. Failure/uncertain-write recovery is manual and separately authorized, never reset/sweep.
- Review budget: five new untracked files initially total 535 authored lines before this log update; no commits/publishing. Split the future reviewable units before a commit exceeding the advisory budget; do not compress/delete verification to fit it.
- Next exact gate: approve copying only the three commented TEST HTTP values into a mode-0600 gitignored `.env.test.local`, using those credentials on `wmtezjoitjmjynyvkyke` for two bounded create/sign-in/repository-read/isolation/cleanup runs described in the smoke guide. Broader Phase 1 fixtures and workflows remain pending.

### L8 — Authorized repeatable HTTP execution

- Parent requested consent to copy only the three commented TEST HTTP credentials to private `.env.test.local` and run two cycles against `wmtezjoitjmjynyvkyke`, each creating two synthetic users, one team, one game and its 14 picks, authenticating/reading/checking isolation, then deleting only those fixtures. User: "Si, autorizo".
- Created dedicated configuration with exclusive creation (no overwrite), mode 0600; confirmed gitignored. Source `.env.local` unchanged; no values printed. No configuration/session replacement, subagents or ambient credentials.
- Initial preflight FAIL: Auth health 200, publishable OpenAPI-root GET 401; stopped before fixture creation. Follow-up read-only SDK HEAD on `teams` returned 200/count zero with both public and service credentials. Legacy-style Bearer headers did not make the root succeed. Treat root access separately from ordinary PostgREST health, not as a credential or database outage claim.
- Corrected health check to anonymous SDK HEAD `teams`; removed OpenAPI root from request allowlist. New safety regression RED: root fetch unexpectedly resolved; GREEN after correction: five safety plus five repository tests (10 total). Biome-only formatting failures corrected.
- Both complete authorized cycles ran `bun run --no-env-file scripts/test-supabase-integration.ts wmtezjoitjmjynyvkyke`, exited 0: empty four-table baseline and absent fixture IDs; Auth create/sign-in 200 for both users; team/game POST 201; owner repository GET 200 and full round-trip/listing assertions; unrelated/anonymous reads 200 with zero visible game; persisted inventory count 14.
- Both cleanups PASS: fixture metadata checked; run-created Auth users DELETE 200 (game/inventory cascade); scoped 2026–2032 picks and own team DELETE 204; four application tables count zero. Additional post-second read-only Auth GETs both 404, dedicated file still mode 0600. No residual fixture data observed in this scope.
- PASS: final focused tests (10), TypeScript, Biome and diff checks. No full suite claim. Updated smoke guide with exact HTTP evidence. Two completed write cycles exhaust this approval; future expanded/extra cycles need concrete consent.
- Scope accounting: no live import, real-data copy, direct API RPC calls, SQL reset/DDL/history repair, proposals 057/058, DEV mutation, Phase 2, independent security clearance, commits or publishing. Implicit normal game-insert trigger did run as authorized. Broader gameplay and unsafe baseline contract-read/TRUNCATE exposure remain outside this proof.

### L9 — Local continuation and next fixture boundary (2026-11-06)

- PASS: Git checked before edits: branch `test/phase-1-supabase-integration`, HEAD `198ba06`, no tracked diff and exactly the five expected untracked files. Existing work preserved; no commits.
- Recovered project-scoped Engram context and read AGENTS plus all six requested task/database documents. Older `needs_review` preferences were not used as current authority; this request supplies the active constraints.
- PASS: local focused safety/game-repository suite rerun with `bun run --no-env-file test tests/infrastructure/supabase/integrationSafety.test.ts tests/infrastructure/repositories/SupabaseGameRepository.test.ts`: 2 files, 10 tests. This is unit/regression evidence only, not fresh HTTP evidence.
- Reviewed the entire initial runner and guard; inspected roster and canonical/effective contract repositories plus local table definitions. Guard enforces destination, route/method, redirect refusal, timeout and scoped deletes. POST bodies/session privileges are not validated by this guard. Unknown write outcomes remain manual recovery; final Auth 404 is not currently a runner assertion. These are explicit limits to address before expansion, not a global safety PASS.
- Prepared the next two-player canonical/runtime projection fixture and HTTP acceptance/cleanup boundary in the smoke guide. No new fixture code or widened remote allowlist yet. Provider snapshots/materialization remain deferred within T5, not omitted from Phase 1 acceptance.
- Reconciled current TEST status in the development plan and added the no-replay/history boundary to the runbook. Historical Step 4 and trade reports remain unchanged and retain their original local evidence scope.
- UNVERIFIED: current remote state and every expanded gameplay flow. No credentials read, remote requests, new writes/deletes, environment changes, migrations, history repair, crash probe, subagents, DEV access or publishing in this continuation. Completed two-cycle consent remains exhausted. Next work is local T5b; remote authorization is requested only after that executable scope is ready.
- PASS: `bun run --no-env-file node_modules/typescript/bin/tsc --noEmit`, `bun --no-env-file biome check` (453 files, no fixes), and `git diff --check`. Final Git retains HEAD `198ba06`, the five original untracked files, and only the two expected tracked documentation edits. No full suite or new HTTP execution claimed.
