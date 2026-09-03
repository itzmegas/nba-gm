# Contract source snapshot cache

Cache external contract snapshots in shared server-side storage, keyed by source, team, and
season. Store `observedAt`, source URL, and content hash with a bounded TTL/revalidation policy.
Game initialization may copy one canonical snapshot into immutable game data; active games must
never refresh from external snapshots.

A device or browser cache is insufficient: Basketball-Reference access occurs server-side, and
per-device caches cannot coordinate the canonical snapshot shared by different users or workers.
Process memory is useful only for request coalescing and is not durable storage.

## Persistence and freshness

The cache uses JSONB because the provider snapshot is already a validated aggregate and must retain
nullable salaries, every season and option, aggregate guarantees, notes, warnings, provenance, and
unresolved player identities without lossy relational projection. Metadata used for lookup and
freshness is normalized into columns. `contract_source_snapshot_versions` is immutable and unique by
`source + team + season + content_hash`; `current_contract_source_snapshots` is the audit-safe current
pointer. A service-only database sequence assigns invocation order before each source fetch. The
advisory-locked store function promotes only a strictly greater revision, so equal revisions and
slower older invocations cannot replace newer content. Version insertion and pointer promotion remain
atomic and idempotent under races.

Freshness is measured from `revalidated_at`, not `observed_at` or `stored_at`. A cache entry is fresh
when `now - revalidated_at <= TTL`; fresh reads perform no source request. A stale entry is valid but
requires exactly one revalidation attempt per orchestration call. A source fetch failure can return
stale data only when the caller explicitly enables it, and the typed result is `stale-fallback` with
a serializable source error attached. Reservation, persistence, authorization, malformed response,
validation, and integrity failures always propagate. Without the fallback policy or cached data, a
source fetch failure errors.

## All-team batch boundary

The authoritative NBA-to-Basketball-Reference crosswalk is Infrastructure-owned and validated at
module initialization as exactly 30 unique canonical NBA teams and 30 unique provider teams. It
explicitly maps provider differences (`BKN` to `BRK`, `CHA` to `CHO`, and `PHX` to `PHO`). Cache
identity remains `basketball-reference + mapped provider team + season`; every typed batch outcome
also retains the canonical NBA abbreviation so reports cannot lose either identity.

Application processes teams in the crosswalk's stable alphabetical NBA order and delegates every
team to the existing get-fresh-or-fetch use case. Requests are never parallel. A fetcher-bound rate
gate enforces at least three seconds between actual source request starts; cache reads happen before
that gate, so fresh hits do not sleep. Abort produces deterministic failed outcomes for unprocessed
teams and prevents further source work.

Each team reports `fresh`, `fetched`, `stale-fallback`, or `failed`. Stale fallback remains usable
when explicitly allowed. Any failed team makes batch completeness false and sets the canonical
snapshot collection to `null`; successful cache writes remain valid, but partial data is never
presented as a complete league snapshot. Unmatched player identities are report data. The batch does
not fuzzy-match, invent player IDs, create games, or write legacy gameplay contracts.

The all-team dry-run uses only a transient in-process cache. It performs no database or gameplay
writes, issues at most one request per team, and uses the same sequential three-second rate gate.
Fixture-driven tests are the required proof; a live 30-team run is optional because it costs roughly
90 seconds of crawl-delay alone.

Both tables have RLS enabled and revoke all access from `PUBLIC`, `anon`, and `authenticated`.
Canonical reads and writes are server-only through an injected service-role client; the credential is
never imported by Domain, Application, browser code, or a route. No API route is needed for this work
unit.

## Game contract materialization migrations

Apply migration 013 before 014: 013 creates the immutable source snapshot tables, and 014 creates the
game-owned contract copy tables and the initial materialization function. Migrations 015 through 018
may then be applied in their numbered order. Migration 019 is a complete replacement of that function;
it requires 013 and 014 but does not require 018, so it may be applied directly after 014 when the
intermediate migrations are already present. In a normal sequential deployment, apply 013, 014, 015,
016, 017, 018, then 019.

Migration 019 parses classifications and source contracts once per materialization statement. It
reuses keyed source rows and joins observed seasons by `(source_snapshot_version_id, source_player_id)`
before expanding salaries. This is a plan-level optimization only; live PostgreSQL timing and statement-
timeout behavior require a real database execution and are not proven by repository tests.

## Domain and compatibility boundary

External snapshots map into a source-neutral, season-array contract model. Salary and option data
belong to each season; aggregate remaining guarantee stays on the agreement because source totals do
not establish which individual seasons are guaranteed. Agreement boundaries remain `null` unless a
source provides explicit structured boundaries; free-text notes are retained as provenance and are
not interpreted as facts.

The legacy gameplay `Contract` remains unchanged. Mapping the new model into `salaryY1` through
`salaryY5` would discard a sixth season, and mapping aggregate guarantee or per-season options into
contract-wide booleans would assert facts the source does not provide. That compatibility direction
is therefore intentionally blocked until persistence and game-data migration define lossless storage
and gameplay semantics. Removing the new model and source mapper rolls back this work unit without
touching active game data.
