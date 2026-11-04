# Recovered history and observed-state evidence

The two `2026020619...` migrations are exact UTF-8 registry payloads recovered
through official Supabase MCP on 2026-11-02, without adding a final newline.
`provenance.json` records their source, byte counts and MD5/SHA-256 fingerprints.
Recovery proves registry contents, not original human-authored file identity or
execution of every later manual migration.

`remote-catalog.json` contains schema metadata and stored migration SQL only, no
production user rows. `catalog.sql` is the metadata-only single-snapshot capture
query. `initial-catalog.json` records local replay of the recovered-original boundary.
The later catch-up must preserve observed state, including security drift, rather
than quietly include desired corrections.

Tooling is pinned to Supabase CLI 2.90.0, PostgreSQL 17.6. Bun's Supabase postinstall
was explicitly approved; no other blocked package scripts were authorized.
Use only the isolated local project `courtside-baseline-step2` and loopback ports.
Never link, push, repair or register history from this preparation workflow.

See `docs/database/deployment-runbook.md` for the complete local rehearsal and
`docs/database/schema-verification-step-2.md` for proof boundaries and production
NO-GO. Platform-owned `supabase_admin` defaults are evidence/prerequisites, not
ordinary application migration authority.

## Replayable observed-state chain

`20261102170000_reconcile_legacy_through_056.sql` extends the recovered originals
using captured definitions, preserving deployed columns, policies and ACLs.
It does not replay legacy backfills. Regenerate with
`python3 scripts/build-supabase-baseline.py`; then run
`python3 scripts/test-supabase-baseline.py` and
`python3 scripts/test-supabase-baseline-loopback.py` on the dedicated disposable
local stack. The latter resets its local database and verifies full catalog parity,
synthetic upgrade preservation and loopback binding after both resets.
`test-supabase-baseline-canonical.py` checks the untouched canonical source in a
separate synthetic database. Generated replay/canonical snapshots are evidence,
not substitutes for running checks. Nothing here approves production adoption.
