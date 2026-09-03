# Game contract snapshots

Modern game creation treats the shared Basketball-Reference cache as immutable source data, not
game state. The server acquires one durable version for each of the 30 teams, seeds the refreshed
ESPN roster, and calls one service-only transaction with those exact version IDs.

The transaction locks the owned `initializing` modern game, rejects incomplete or mixed source /
season batches, classifies every roster player, and copies only explicitly crosswalk-matched
contracts into normalized game-owned agreement, season, and provenance tables. Current-roster
eligibility is a gate: inactive players are excluded before salary resolution and can never receive
an estimate. Eligible active players then follow a strict hierarchy: observed Basketball-Reference
current salary, official NBA G League two-way classification, then a versioned years-of-service
minimum estimate. In the current/preseason roster-refresh path only, an unmatched roster-only
player whose ESPN experience is `NULL` may use the 0-years-of-service minimum as an explicit
estimated assumption. The classification records
`current-roster-espn-omitted-experience-minimum` and
`espn-omitted-experience-assumed-zero-years-of-service`; it remains standard cap and matching
salary treatment, has no Basketball-Reference provenance, and receives the 2026-27 rookie minimum
of $1,357,763. A matched source player with missing experience, an unavailable two-way source, or
any other blocked condition remains `unclassified` and blocks activation; no global `NULL`-to-zero
conversion or fabricated $0 contract is permitted.
Unknown salary, agreement boundaries, and season guarantee remain `NULL` / `unknown`. Every source
season is copied, including a sixth season and each season's independent option.

Gameplay reads `game_contract_seasons` for the game's current year. The legacy `Contract` returned
for existing roster and trade consumers is an explicitly marked `observed-season-coverage`
compatibility projection: its salary and current option come from the canonical current-season row,
its guarantee remains nullable when unknown, and its year range describes observed rows rather than
claimed agreement boundaries. Historical or
unmigrated games continue to read the legacy `contracts` table.

Two-way cash compensation remains nullable and is excluded from standard cap totals and trade salary
matching. Estimated minimums are standard salary but carry `estimated` provenance. The complete
2026-27 years-of-service schedule is versioned from Hoops Rumors' 2026-07-01 table (created with
RealGM data), observed 2026-08-24: https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html.
Unknown ESPN experience remains a typed blocker outside that narrow current-roster exception and
is never globally treated as rookie experience. The exception is risky because an ESPN omission can
conceal veteran service; therefore it requires an unmatched source identity, active roster status,
a confirmed two-way lookup, and the explicit current-roster policy flag. Nick Smith Jr. is a bounded
curated inactive exception based on the 2026-06-29 declined Lakers option; Spotrac is not bulk-fetched.

No browser can materialize or mutate these copies. Authenticated users have owner-scoped read-only
RLS. The materialization RPC is executable only by `service_role`, binds the authenticated user ID
supplied by the server route to the game owner, is idempotent for the same ordered version array, and
rejects a different array. Copy tables reject direct updates and deletes; the authenticated
`rollback_seed_game_data` compensation RPC can delete only rows belonging to an owned, non-deleted
`initializing` game. Cache pointer refreshes cannot affect them.

Activation remains browser-controlled only after the server route returns success, browser seeding
is confirmed idempotent, and schedule initialization succeeds. A materialization failure preserves
the canonical roster promotion and global source snapshots while the compensation RPC removes only
game-scoped initializing data; the existing client rollback then soft-deletes the game.
