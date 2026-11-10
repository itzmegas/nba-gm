# Phase 2 — Local authoritative trade boundary

**Local-only, not deployment-ready. Player trades fail closed with `HARD_CAP_UNKNOWN`.**
There is no authoritative hard-cap source in the current model. This slice adds the
authenticated Next.js operation and closes its direct-RPC bypass without inventing
cap state. Only bilateral pick exchanges can execute. This is not completion of
salary matching, player eligibility, roster-limit or hard-cap business rules.

## HTTP contract

`POST /api/games/{gameId}/trades` uses the verified cookie session. The request
contains only identifiers; unknown fields (including user, salary, roster, and cap
values) are rejected. Both teams must send assets, and the selected franchise must
participate. The client preview remains advisory and is not server authorization.

```json
{
  "teamAId": "a1000000-0000-4000-8000-000000000001",
  "teamBId": "a1000000-0000-4000-8000-000000000002",
  "assets": [
    { "assetType": "pick", "assetId": "a6000000-0000-4000-8000-000000000001", "fromTeamId": "a1000000-0000-4000-8000-000000000001" },
    { "assetType": "pick", "assetId": "a6000000-0000-4000-8000-000000000002", "fromTeamId": "a1000000-0000-4000-8000-000000000002" }
  ]
}
```

Success is `{ "success": true, "tradeId": "<uuid>" }`; history is refreshed
separately. A history-fetch failure cannot turn a confirmed transaction into a
reported execution failure. Errors contain `success: false`, stable `code`, and
safe `error` text, never database diagnostics.

| HTTP | Codes |
| --- | --- |
| 400 | `INVALID_REQUEST` |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN_ORIGIN` |
| 404 | `GAME_NOT_FOUND` (also hides unrelated games) |
| 409 | `GAME_NOT_ACTIVE`, `STALE_ASSET` |
| 422 | `INVALID_TEAMS`, `HARD_CAP_UNKNOWN` |
| 503 | `TRADE_UNAVAILABLE` (missing/inaccessible versioned RPC) |
| 500 | `TRADE_FAILED` (outcome uncertain: refresh history before retrying) |

There are no automatic mutation retries. A lost response may follow a committed
trade; this slice does not introduce idempotency keys or promise exactly-once delivery.

## Database boundary and bypass

The new migration is `20261110100000_authoritative_trade_boundary.sql`, after the
four Phase 1 migrations. It has **not** been applied to any shared environment.
The original migrations and legacy `scripts/schema.sql` bootstrap are unchanged;
the new active-chain migration is authoritative for this slice.

- `execute_trade_authoritative` uses `auth.uid()`/`auth.role()` and the existing
  session, not service-role or a supplied actor ID. The route never falls back to
  the weaker old function when the new function is absent.
- The owned game is locked first; status, team participation and assets are
  checked against stored state. Pick ownership/transferability is locked and
  checked within the transfer/history transaction. Late errors roll back all writes.
- The compatibility RPC `execute_trade_transactional` delegates to the same
  boundary. Authenticated direct calls bypass HTTP presentation, not these rules.
  PUBLIC, anon and service-role receive no EXECUTE grant on either entry.
- Any player asset rejects the entire transaction. No player salary, roster or
  contract is changed, regardless of client snapshots or RPC entry name. Pick-only
  trades leave payroll and roster unchanged; they do not certify existing rosters.
- Known baseline policies (including destructive grants) remain unresolved. This
  migration is not a general security cleanup and does not activate 057/058.

The historical Phase 1 `--trades` smoke expects successful player transfers on its
four-migration baseline. It is **not compatible** with this fail-closed fifth
migration; do not run it against the new candidate or claim its prior PASS covers it.

## Local verification

```sh
bun run --no-env-file test tests/application/trades tests/app/api/trades.test.ts tests/infrastructure/trades tests/application/hooks/gamePlayers.test.tsx
bun run --no-env-file scripts/test-server-trades-postgres.ts --local-only
bun --no-env-file biome check
bun run --no-env-file node_modules/typescript/bin/tsc --noEmit
```

The SQL runner requires the already-cached pinned PostgreSQL 17 image. It uses an
explicit local Docker socket, no pulls, no network, no published ports, no host
mounts and disposable tmpfs data; only its own container is removed. It replays
the active chain with synthetic Auth stubs, not a running Auth/PostgREST service.
`--baseline` deliberately omits the fifth migration and must fail with missing RPC
SQLSTATE `42883` rather than passing the fail-closed regression.

Coverage includes malformed payloads, ownership/status, late rejection state hashes,
canonical immutability, direct authenticated RPC parity, bilateral pick transfers,
two concurrent calls for the same assets, and revalidation after a concurrent
game-first state writer. Anonymous EXECUTE is checked through ACL metadata only;
the denied-RPC crash is not reproduced.

## Next boundary

Define an authoritative hard-cap model before enabling player trades. At that
point implement and test effective salary precedence (runtime over canonical over
eligible legacy), current-season coverage, release charges, salary matching and
roster limits under the same lock. Do not add unreachable duplicate payroll logic
while every player transfer is intentionally denied. Hosted Auth/PostgREST proof
and all deployed migration/permission changes require fresh target/session/operation
authorization. No global security, live-provider or season-simulation clearance is implied.
