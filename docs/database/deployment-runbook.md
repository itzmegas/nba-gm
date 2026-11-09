# Local baseline rehearsal and future adoption

**Current decision: NO-GO for production adoption.** This branch prepares a local
observed-state candidate, not a production deployment. See [Step 2 results](schema-verification-step-2.md).

**Status reconciled: 2026-11-05.** The active chain now includes the locally
validated modern-contract trade migration. See its [validation report](modern-contract-trade-validation-report.md)
for four-file replay evidence; Step 2 records the earlier three-file baseline.
Neither result establishes full Auth/PostgREST integration or deployment approval.
Subsequent [hosted TEST HTTP evidence](phase-1-http-smoke.md) establishes only
the initial Auth/game slice. TEST already has these four payloads; migration
history was deliberately not registered or repaired. Do not replay this chain
against its existing schema or infer permission to repair history.
See the [development and testing plan](development-testing-plan.md) for current
evidence boundaries and the agreed next steps.

## Local-only quick path

Requirements: Bun 1.3.13, Python 3, Docker, available ports 55320–55322.
The exact CLI dependency is Supabase 2.90.0 (PostgreSQL 17.6 images).

```sh
bun install --frozen-lockfile
bunx --no-install supabase --version
# A dedicated network makes Docker's default published address loopback-only.
docker network create --driver bridge \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  courtside-baseline-step2-loopback
bunx --no-install supabase start \
  --network-id courtside-baseline-step2-loopback \
  -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
python3 scripts/test-supabase-baseline.py
python3 scripts/test-supabase-baseline-loopback.py
python3 scripts/test-supabase-baseline-proposals.py
python3 scripts/test-supabase-baseline-canonical.py
bunx --no-install supabase --network-id courtside-baseline-step2-loopback db lint --local --fail-on error
bun biome check
bun run test
```

Create the network once; inspect an existing network before reusing it. The
database-only Supabase instance includes the platform Auth/Storage catalog bootstrap,
but **not running Auth/API/Realtime/Storage services**. Database tests do not prove
HTTP, sign-in, client integration or Realtime behavior. Verify Docker's effective
published address is `127.0.0.1`, not a public interface.

`validate-supabase-baseline.py` **destroys this local project's disposable database**.
It explicitly uses `--local`, checks the project/container identity, loads only
synthetic fixtures, tests the original-to-catch-up upgrade and unchanged pending
replay, then resets fresh and compares metadata. No real data or credentials are
needed. Do not point this tooling at another local development database.
Every CLI invocation in the validator explicitly retains `--network-id`; resets
otherwise recreate the container on the default network. Loopback binding is
checked before mutation, after each reset and at completion. Never run a bare
`db reset --local` on this rehearsal stack: it discards the dedicated binding.

To stop the disposable stack after testing:

```sh
bunx --no-install supabase stop --no-backup
```

Do not commit `.temp/`, `.branches/`, credentials, status output containing local
keys, linking artifacts, or database volumes. Keep the application `.env.local`
unchanged; the application is not redirected to this rehearsal instance.

## Artifacts and regeneration

1. `supabase/baseline/catalog.sql` is a metadata-only, single-snapshot query. Remote
   use must remain through the authorized official MCP session. Do not use application RPCs.
2. `remote-catalog.json` preserves observed definitions, not production rows.
3. `initial-catalog.json` records a local reset to the two recovered migrations.
4. `python3 scripts/build-supabase-baseline.py` deterministically generates the exact
   original payload files, provenance, catch-up SQL and managed-default evidence.
   Generation alone is **not** verification. Run the full local validation afterward.
5. Compare a fresh local catalog using `scripts/check-supabase-baseline.py`. It
   retains exact SQL, defaults and ordered columns; only ACL ordering is normalized.
   The sole accepted environment delta is explicitly reported local `pg_net 0.20.0`.

Applied originals are immutable. The catch-up is still an unadopted candidate; its
timestamp is a new local baseline identity, not a claim that legacy SQL ran remotely.
The active chain in `supabase/migrations/` contains **four files**, in order:

1. `20260206190001_initial_schema.sql` — recovered original.
2. `20260206190014_enable_rls.sql` — recovered original.
3. `20261102170000_reconcile_legacy_through_056.sql` — observed-state catch-up candidate.
4. `20261104190000_modern_contract_trade_compatibility.sql` — locally validated trade correction.

Do not put `supabase/proposals/` into the active chain or bulk-register legacy files.

## Required before any production adoption

- Obtain separate approval for the exact destination, operation and credential/session.
- Independently review the candidate and explicit acceptance/disposition of security drift.
- Refresh catalog evidence and prove parity again against the frozen candidate.
- Resolve reported coverage gaps and rehearse populated application state in staging.
- Verify backups/PITR and rehearse restoration; a schema snapshot is not a data backup.
- Confirm the original two history rows and their payload fingerprints are unchanged.
- Keep platform-owned `supabase_admin` defaults as an environment prerequisite;
  ordinary migrations must not escalate privileges to change them.
- Authorize any metadata registration separately. **No registration is authorized here.**

Only a future separately approved run may register the catch-up as already present.
Registration would assert verified resulting state, not historical execution of this
file. Never run the catch-up DDL on production. Future deployment commands, dry runs,
linking and repair must be performed in a controlled deployment session, not copied
from this local rehearsal. No remote write commands are provided as an executable quick path.

## Proposed corrections: separate future work

`supabase/proposals/057_restrict_legacy_reads.sql` removes retained public-read
policies and explicit anonymous helper grants. It changes behavior and requires
approval plus two-user/anonymous compatibility tests before promotion to a fresh
timestamped migration. It does not change owner defaults or service-role access.

`058_contract_game_required.sql` checks for NULL ownership, then sets `NOT NULL`
with bounded timeouts. It refuses ambiguous records rather than deleting or
inventing ownership. Recheck production counts, locking and runtime compatibility.

Neither proposal is deployed or registered. No index removal, column reorder,
constraint rename, global default-privilege hardening, or migration 057 Draft feature
is included in the baseline. Those are separate decisions, not baseline cleanup.
