# Step 4 — Supabase runtime and Auth/PostgREST validation

**Staging: NO-GO. Local integration: BLOCKED; runtime tests UNVERIFIED.**
Evidence date: 2026-11-05. This is local inspection, not deployment evidence.
No Auth, PostgREST, application workflow, or permission-denial success is claimed.

## Scope and stop condition

Read the deployment runbook, Step 2, Step 3, Step 3.1, modern-contract trade
validation report, and `docs/STATE_ARCHITECTURE.md` before inspection.
The user requires stopping when integration cannot run safely rather than replacing
it with weaker evidence. Inspection found no running local stack and an incomplete
cached platform. No supported replacement Supabase database runtime was established
locally. Starting a complete stack would require additional infrastructure acquisition
and compatibility review; none was performed. The affected image was not started.

## Environment inventory

| Surface | Observed evidence |
|---|---|
| Host | Linux x86_64 (`uname -sm`) |
| Docker server | 29.9.2 (`docker info --format '{{.ServerVersion}}'`) |
| Bun | Installed 1.3.13 (`bun --version`) |
| Supabase CLI | Installed 2.90.0 (`node_modules/.bin/supabase --version`), matching package/lock pin |
| CLI update notice | CLI reports v3.0.0 available; not installed or reviewed; not proof of a compatible database fix |
| Project | `courtside-baseline-step2` in `supabase/config.toml` |
| Database config | PostgreSQL major 17; database 55322, shadow 55320; pooler disabled; seeding disabled |
| API config | Enabled, port 55321, TLS disabled, schemas public/graphql_public, max_rows 1000 |
| Auth config | Enabled; site URL http://127.0.0.1:3000; additional redirect https://127.0.0.1:3000; signup enabled; anonymous sign-ins disabled |
| Running containers | None in `docker ps -a` output; all listed containers exited |
| Step 2 stack | No Step 2 container present; no Supabase/Courtside named volume found by filtered `docker volume ls`; no reset/recreation attempted |
| Preserved network | `courtside-baseline-step2-loopback`, bridge default host binding 127.0.0.1, subnet 172.22.0.0/16 |
| Local Auth endpoint | `curl --noproxy '*' --max-time 3 http://127.0.0.1:55321/auth/v1/health`: connection refused, HTTP 000 |
| Credentials | No application environment, tokens, passwords, or container environment values read or printed; local credential usability UNVERIFIED |

The bridge default is not proof of effective bindings for a future stack. With no
running services, live database target, extensions, managed-schema versions, API
credentials, and effective service exposure could not be verified. Configuration
network restrictions are disabled; loopback publication must be checked on every
future container, not inferred from that setting. The HTTP/HTTPS redirect difference
is a configuration mismatch requiring validation before browser-session testing.

### Relevant cached images

Read-only `docker image ls --digests` inventory:

| Image | Digest |
|---|---|
| public.ecr.aws/supabase/postgres:17.6.1.106 | sha256:21ab971149317ea9cd12a8126fe4ebb34def08c8972956b0958cba0924409dab |
| public.ecr.aws/supabase/gotrue:v2.188.1 | sha256:87db8c737af49a64236c461882ed3925f8b1e5c2c47176c64694dedc65153573 |
| public.ecr.aws/supabase/realtime:v2.82.0 | sha256:e3a9a49c92d1fe7decf5bceda84c036dd8ecdedb145a94d39fc9433becb0b989 |
| public.ecr.aws/supabase/storage-api:v1.48.28 | sha256:38850bce7c3056ef76acdc4c6357aa474b3124b22d383ed86843b765a1efe242 |
| postgres:17-alpine | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 |

No PostgREST or Kong image appeared. Cached images do not prove a working or
supported combination. Vanilla PostgreSQL is not a substitute for Supabase runtime
integration. No other Supabase PostgreSQL image appeared in the inventory.

## Runtime compatibility and crash evidence

Step 3.1 records signal 11 for revoked SECURITY DEFINER calls on Supabase
17.6.1.106, versus SQLSTATE 42501 on vanilla PostgreSQL 17.11. Root cause remains
unresolved. The cached Supabase image tag matches the recorded affected build;
this session did not establish a supported compatible update or published fix.

The earlier scratch directory was unavailable. Existing stopped probe container
`step31-supa-denied-role` was inspected without starting it: network `none`, no
published ports, no mounts. Its bounded log tail identifies PostgreSQL 17.6,
x86_64-pc-linux-gnu, GCC 15.2.0. The filtered tail did not contain a signal-11 line;
the historical report, not this tail, supplies the prior crash result. No new crash
or denial experiment occurred. No extension runtime query was possible.

## Migration provenance

The active directory currently contains exactly:

1. `20260206190001_initial_schema.sql`
2. `20260206190014_enable_rls.sql`
3. `20261102170000_reconcile_legacy_through_056.sql`
4. `20261104190000_modern_contract_trade_compatibility.sql`

**Applied in Step 4: none.** No disposable environment was created. Previously
reported replay of these four migrations belongs to the modern-contract report,
not a fresh Step 4 runtime. Proposals 057/058 remain inactive and were not applied.
The runbook's statement that the chain has only three files predates the trade
migration; use the four-file inventory above for future local rehearsal.

## Auth/PostgREST test matrix

PASS requires the specified interface and expected observable outcome; unavailable
execution is UNVERIFIED, not PASS or a demonstrated product failure.

| Scenario | Result | Evidence / limitation |
|---|---|---|
| Local Auth health prerequisite | FAIL | Connection refused at 127.0.0.1:55321; infrastructure prerequisite, not an Auth logic finding |
| Owner authentication | UNVERIFIED | No running Auth service; no synthetic users created |
| Unrelated account authentication | UNVERIFIED | Same blocker |
| Anonymous PostgREST reads | UNVERIFIED | No running PostgREST; no HTTP RLS result |
| Owner game access / cross-user isolation | UNVERIFIED | No authenticated API sessions |
| Games, roster states, contracts, picks, trades and related-table RLS | UNVERIFIED | No per-table API execution; prior SQL coverage is not API coverage |
| Authenticated RPC permissions | UNVERIFIED | No authenticated PostgREST execution |
| Anonymous RPC permissions | UNVERIFIED | Prohibited crash probe not run; no fresh catalog inspection; catalog ACLs would not prove runtime denial |
| Service-role workflows | UNVERIFIED | No local service session or workflow executed; no service credentials exposed to browser |
| Effective full-stack loopback isolation | UNVERIFIED | Preserved network default inspected, but no live stack to inspect |

## Courtside workflow integration

| Workflow through application interfaces | Result |
|---|---|
| Game creation and seeding | UNVERIFIED |
| Ownership and roster reads | UNVERIFIED |
| Canonical contract projection | UNVERIFIED |
| Trade execution with modern canonical contracts | UNVERIFIED |
| Free-agency offers and progression | UNVERIFIED |
| Simulation advancement and persisted results | UNVERIFIED |
| Cross-user rejection of protected operations | UNVERIFIED |

No repositories, services, routes, or browser sessions were exercised. Existing SQL
and TypeScript results in earlier reports remain historical evidence only. The
modern-contract report demonstrates SQL contract-source compatibility, not live
Auth/PostgREST integration. SQL salary matching, hard caps, and roster validation
remain separate application-integrity work; business logic was not changed.

## Changed files and safety accounting

- Created only `docs/database/schema-verification-step-4.md`.
- No source, configuration, lockfile, historical/active migration, proposal,
  baseline evidence, or application environment changed.
- No database was started, reset, migrated, seeded, or mutated. No images pulled,
  infrastructure upgraded, containers removed, or commits created.
- No remote Supabase operation, remote DDL/data access, linking, repair, push,
  staging/production operation, or deployment occurred. Local inspection did not
  use ambient application credentials. CLI printed an update notice; that is not
  evidence of a wholly offline execution or a remote Supabase operation.
- Documentation structural checks only; application tests cannot establish the
  missing runtime evidence and were not substituted for it.

## Remaining blockers and recommended Step 4.1

**Staging NO-GO; production NO-GO.** No fresh integration proof exists, retained
baseline contract-read exposure remains documented in Step 2, and the affected
Supabase image's denied-RPC behavior is unresolved. Do not promote 057/058 or
claim owner isolation from the unchanged baseline.

Smallest next step: review and authorize acquisition of one explicitly versioned,
CLI-compatible local platform set, including PostgREST and gateway, with documented
support/fix evidence for its database runtime. Do not upgrade automatically or
assume a newer CLI fixes PostgreSQL. Then create a separately named disposable
project with separate volumes/ports and verified loopback bindings; retain Step 2
artifacts and use only the four active migrations with synthetic users/data.

Step 4.1 should first prove local Auth and PostgREST health and both synthetic
sign-ins, then exercise existing Courtside repositories/services and record exact
HTTP outcomes plus persisted-state invariants for rejected operations. Keep the
known crashing anonymous invocation prohibited; a denial test requires separately
established safe runtime evidence. Until then, mark it UNVERIFIED rather than using
ACL inspection or vanilla PostgreSQL as a substitute.
