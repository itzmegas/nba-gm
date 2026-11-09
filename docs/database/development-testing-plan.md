# Development testing and incremental API plan

**Decision agreed: 2026-11-05. Keep Supabase, make tests reproducible, then explore
one server-side API use case. Do not rewrite the backend now.** This document
records the agreed direction, not completed infrastructure work or deployment approval.

**Phase 1 HTTP safety net complete, 2026-11-09:** isolated TEST `wmtezjoitjmjynyvkyke`
has the four active migration payloads and repeatable Auth/game, roster/contracts,
owner trade/rejected-write rollback, synthetic provider cache/materialization,
free-agency offer and one-day simulation/resolution lifecycles. Accepted offers
create runtime contracts read by the effective and compatibility repositories.
Latest cleanup: seventeen accessible tables empty, both synthetic Auth accounts
absent (404), and owner runtime view empty after exact game deletion.
See the [HTTP evidence and remaining scope](phase-1-http-smoke.md)
and [task log](../../odd/tasks/phase-1-supabase-integration.md). This supersedes
the planned TEST status below, not the historical local Step 4 results. This
completes the bounded reproducible HTTP workflows, not security clearance, live
provider acquisition, complete game-creation orchestration, played-match or
full-season validation. Existing unsafe policies and denied-RPC crash probes
remain explicitly outside this proof. The user separately authorized
necessary synthetic TEST HTTP cycles using existing `.env.test.local`; this
document itself grants no remote authority or schema/grant changes.

## Current context

The owner reports that the existing hosted project is development-only: one account
and two disposable test games. The initial audience is the owner and possibly
friends; growth is uncertain. A future API is also a learning goal, not a response
to demonstrated scaling limits.

## Read the evidence in order

Historical reports describe their own execution date and scope. A later result
supersedes an earlier blocker only for the behavior it actually verifies.

| Document | What it establishes | What it does not establish |
|---|---|---|
| [Step 2](schema-verification-step-2.md) | Local reconstruction and captured application-schema parity for the original three-file baseline | Whole-platform parity, HTTP integration, or production adoption |
| [Step 3](schema-verification-step-3.md) | SQL compatibility of inactive security proposals, with partial gameplay evidence | Complete gameplay or safe Supabase denied-RPC execution |
| [Step 3.1](schema-verification-step-3-1.md) | Expanded gameplay and repaired fixtures on disposable PostgreSQL; records the original canonical-only trade failure | A fix for that failure or for the Supabase-image crash |
| [Trade validation report](modern-contract-trade-validation-report.md) | Subsequent trade correction, SQL regression coverage, and four-file Supabase CLI replay | Full Auth/PostgREST integration or authoritative SQL salary/cap/roster validation |
| [Step 4](schema-verification-step-4.md) | Latest local runtime inspection: integration blocked and application/Auth/PostgREST outcomes unverified | A demonstrated hosted Supabase failure or a completed integration run |

The [runbook](deployment-runbook.md#artifacts-and-regeneration) lists the current
four active migrations. The [trade design](modern-contract-trade-compatibility.md)
preserves the investigation; its original checklist is not the current task list.

**Staging/production promotion remains NO-GO.** Preparing an isolated disposable
test environment is a separate task, not a release-readiness claim.

## Target environment split

| Environment | Purpose | Status |
|---|---|---|
| Existing hosted Supabase: DEV | Manual development and exploratory test games | Existing; contents reported by owner, not re-inspected here |
| Separate hosted Supabase: TEST | Repeatable Auth/API integration and approved migration rehearsals | Available: `wmtezjoitjmjynyvkyke`; bounded Phase 1 HTTP safety net PASS with synthetic fixtures and exact cleanup |
| Local Vitest and disposable PostgreSQL | Fast application/domain checks and SQL regressions | Existing tooling; no new execution is claimed here |
| Full local Supabase or CI stack | Additional integration coverage without a permanent cloud test project | Deferred; requires compatible runtime review |

No production environment or third cloud project is required now. If a second
project is unavailable, keep the existing DEV sandbox for manual work while agreeing
on an alternative integration target; do not silently redirect destructive tests to it.

Supabase currently permits two active Free projects across organizations where the
account is Owner/Admin; paused projects do not count. Other owners/admins can affect
availability within an organization. Free projects may pause for low activity over
a seven-day period. Check the actual dashboard quota and usage before provisioning;
neither the available slot nor workload capacity has been verified for this account.
See the official [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
and [production availability guidance](https://supabase.com/docs/guides/deployment/going-into-prod).

## Phase 1 — Establish reproducible integration tests

1. Confirm the TEST destination, quota, credentials, and permitted operations before
   creating resources or applying migrations. Record the runtime version without
   running the known crash probe on the hosted service.
2. Prepare a fresh, isolated schema from the reviewed active migration chain. Do not
   replay the catch-up DDL on an existing populated schema or register history blindly.
   Keep legacy SQL and proposals 057/058 outside automatic deployment.
3. Prepare deterministic synthetic users, teams, players, contracts, and provider
   snapshots. Tests must not depend on live NBA imports or copies of real user data.
4. Guard destructive tooling with an explicit TEST project identity and disposable
   fixtures. Keep environment credentials separate and service-role secrets server-only.
5. Exercise actual repositories and application interfaces through Auth/PostgREST:
   sign-in, game creation, roster/contracts, trades, free agency, and simulation.
   Check owner, unrelated-user, and anonymous access using their actual sessions,
   not only administrative credentials. Run permission-denial invocations only after
   separately established safe runtime evidence; otherwise mark them UNVERIFIED.
6. Record HTTP outcomes and persisted state, including rollback after rejected writes.
   Keep fast unit/SQL suites as complementary evidence, not substitutes for integration.

Acceptance requires a repeatable fixture lifecycle and explicit PASS/FAIL/UNVERIFIED
results. The unchanged baseline retains unsafe contract-read policies: record that
exposure rather than treating it as a pass. Reviewing/promoting 057/058 requires a
separate scoped decision and migration; this plan does not activate them. The known
Supabase-image crash remains unresolved and must not be reproduced as part of setup.

## Phase 2 — Learn through one bounded server API use case

After a usable test safety net exists, choose one vertical slice, such as trade
execution. Start in the existing Next.js server to avoid another deployment unless
learning a standalone backend is explicitly chosen as the goal.

The server must authenticate the user, load authoritative state, authorize ownership,
and enforce the operation's rules without trusting client salary/roster snapshots.
Preserve transactional writes and concurrency guarantees. A pre-check followed by
an unguarded write is insufficient: validation and execution must use a consistent,
protected state. Close any direct-RPC bypass before claiming server authority.

Retain the existing domain interfaces, repositories, and SQL where useful. Own an API
contract without pretending that it removes Supabase Auth, RLS, or SDK dependencies.
PostgreSQL functions may remain reusable when changing database hosts; platform
identity and permission integration would still need deliberate adaptation.

**Exit criterion:** one authenticated operation with integration tests, defined
errors, and preserved integrity. Do not migrate every read or introduce another
framework, ORM, or backend service as a prerequisite.

## Phase 3 — Reassess, do not prebuild

Use the first API slice, measured database growth, performance, and actual audience
to decide whether to extend the API, extract a backend, change hosting, or pay for
more capacity. Defer cloud branching until migration history is reconciled; cloned
schema plus unregistered migrations can cause existing DDL to be replayed.

## Next action and authorization boundary

- [ ] Check the account's available Free-project slot and select the integration target.
- [ ] Approve a bounded TEST provisioning/fixture task and its exact permitted operations.
- [ ] Complete Phase 1 before choosing the first API slice.

Only documentation work is authorized in this change. No project creation, linking,
reset, migration application/repair, proposal promotion, runtime upgrade, API
implementation, or staging/production deployment is performed or authorized here.
