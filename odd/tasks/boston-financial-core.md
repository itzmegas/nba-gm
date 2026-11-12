# Boston playable financial core
Objective: implement the approved Boston financial approximation, then authoritative free-agency enforcement.
Branch: test/phase-1-supabase-integration; baseline: 0ab0bdb1ac60d5a0c8275a58d8e7ad79ec3743d6. Delivery: ask-on-risk; forecast pending initialization map. Runner: Bun/Vitest and isolated local PostgreSQL; no remote database access.

## Specs

- S1: User: "Perfecto, damos por cerrado esto al menos por ahora para poder avanzar, si mas adelante encontramos nueva evidencia podemos complementar." Record the accepted Boston approximation, retaining known salaries, bonuses and charges; omit unproven minor initial residual charges as a disclosed scenario assumption, never zero an active standard contract, and preserve later game-generated obligations.
- S2: Accepted plan: "Unificar el cálculo financiero: salarios vigentes + cargos retenidos conocidos + bonos conocidos, sin duplicaciones; límites correspondientes a la temporada." Check aggregation and season-specific thresholds with deterministic tests.
- S3: Accepted plan: "Aplicarlo primero a agencia libre: comprobar el margen tanto al presentar una oferta como al ejecutarla. Un rechazo no debe dejar cambios parciales." Test submission, execution and rejected-state invariance through authoritative interfaces.
- S4: Accepted plan: "Después abordar los trades de jugadores, manteniendo su bloqueo hasta cubrir también salary matching y límites de roster." Player trades remain blocked during this feature; enabling them is a later deliverable, not part of this implementation.
- S5: Accepted first objective: "que Boston pueda fichar o cortar jugadores y que su contabilidad evolucione coherentemente desde el escenario inicial". Bind the approved initial approximation explicitly; do not backfill or rewrite existing saves. The approved opening cutoff is 2026-10-20T04:00:00Z; changing a calendar date alone does not establish that snapshot.

## Tasks

- T1 [S1] inline (passive documentation); complete; commit pending; structural readback, no meaningful runnable RED.
- T2 [S2,S5] inline (no writer trigger); blocked on scenario selection decision; commit pending; initialization map complete, no source writes yet.
- T3 [S3,S4,S5] inline (no writer trigger); pending; commit pending; authoritative SQL and isolated mutation tests; independent verification required for persisted financial state, permissions and locking changes (risk items 1,2,4 as applicable).

## Log

- L1 User authorization: "Perfecto. Vamos con ese plan entonces, comencemos."
- L2 Preceding user direction: "En caso de que no tengamos estos datos quitaria ese salario del cap del equipo, salvo que sea un jugador muy importante con un salario alto (que asumo que seria muy facil de encontrar) no me detendría mas en esto."
- L3 Working tree was clean at baseline. No implementation writer delegated: sequential dependent behaviors stay inline. Read-only mapping delegated because authoritative SQL, scenario initialization and local verification exceed the inline evidence budget.
- L4 Map: shared get_free_agency_financial_context already deduplicates canonical/runtime/legacy salaries and adds release charges. assess_free_agency_offer is reused at execution but lacks hard-cap state. No persisted initial scenario restriction was established. Existing modern creation uses October 15 and live refresh, unlike the approved October 20 scenario; do not infer equivalence or apply Boston's initial state to existing saves.
- L5 No remote access, schema application, existing-save mutation or player-trade enablement is authorized.
- L6 T1 records the accepted scenario assumptions near the top of HARD_CAP_EVIDENCE.md and preserves historical evidence below. Passive documentation requires structural checks, not an artificial RED test. Risk: none for this documentation unit.
- L7 Initialization map: games has no scenario/version field; modern materialization fetches current 30-team contract snapshots and seed_game_data copies current roster ownership. Typed contract seasons have no bonus inputs. Applying the October 20 Boston assumption to that path implicitly would mislabel live data. Needs user decision: select Boston approximation explicitly (recommended), or bind it automatically for newly created Boston games; neither choice changes existing saves. No implementation choice has been made on the user's behalf.
- L8 PostgreSQL tooling is installed through Docker, but local socket availability and runnable latest-chain financial regressions are not yet verified. No functional checks claimed. Authored implementation-line forecast remains pending this product decision; no PR strategy or publication requested.
