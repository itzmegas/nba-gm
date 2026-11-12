# Real dated game initialization

Modern games must initialize from a versioned dataset matching the selected cutoff, not from live rosters combined with an earlier calendar date. This work is in progress; the new selector is not connected to game creation.

## Approved cutoffs

- **Today:** midnight America/New_York on the local New York creation date. Only games completed strictly before that instant contribute results or standings.
- **Season start:** midnight America/New_York on the official season opening date. For the supported 2026-27 scenario: `2026-10-20T04:00:00Z`.

An observation timestamp is not a historical effective timestamp. A game marked Final when fetched after midnight might still have been in progress at midnight. Do not substitute scheduled tip time, elapsed regulation time, or an arbitrary delay for evidence of completion.

## Implemented: normalized regular-season schedule projection

`src/application/games/prepareRealSchedule.ts` validates a normalized local snapshot and projects initial games and standings together. It does not fetch data, persist a game, certify source assertions, establish league-wide completeness, or admit a complete roster/financial scenario.

The caller supplies the expected season year and cutoff. The snapshot requires:

| Field | Meaning |
| --- | --- |
| `version` | Nonempty snapshot version retained in the projection. |
| `seasonYear` | Season starting year, matching the requested scenario. |
| `cutoffAt` | Effective scenario instant, matching the requested cutoff. |
| `observedAt` | Observation instant, no earlier than the cutoff or any supplied completion time. |
| `sourceUrl` | HTTP(S) provenance for the admitted normalized dataset; not automatically fetched or authenticated. |
| `teamIds` | Unique local team UUIDs, including teams without completed games. |
| `games` | Nonempty list of uniquely identified, explicitly classified regular-season fixtures. |

Each game requires `sourceGameId`, `competitionPhase: "regular_season"`, `scheduledAt`, `homeTeamId`, `awayTeamId`, and nullable `completedAt`, `homeScore`, `awayScore`. A completed game must have both non-tied, nonnegative integer scores and a completion timestamp between scheduled tip time and observation. Unknown completion time cannot accompany final scores. Team IDs must belong to the snapshot and opponents must differ. Duplicate games/teams and other competition phases are rejected rather than silently counted.

The projection preserves fixture identity and tip time. Results completed at or after the cutoff are omitted, including scores and completion time; standings count exactly the retained completed results. Other fixtures remain scheduled. This does **not** yet implement resuming or replaying a game in progress at the cutoff; initialization must not claim to support that state until its authoritative handling exists. Inputs are not mutated on success or rejection.

Test fixtures are authored synthetic examples, not retrieved NBA evidence. A structurally valid input does not prove the truth of its timestamps, classification, completeness, or provenance.

## Pending: source admission and initialization

1. Obtain verified dated rosters, contracts and financial inputs for each admitted scenario. Current ESPN roster acquisition has no as-of-date parameter. Preserve the approved Boston approximations without silently extending them to other missing facts or teams.
2. Obtain a real regular-season schedule and completion evidence sufficient to reconstruct results at the cutoff. Verify NBA Cup/final/All-Star classification instead of inferring eligibility from a guessed game-ID pattern.
3. Bind the admitted components to one scenario version/cutoff, store its initial copy per game, and initialize schedule/results/standings atomically. Failures must not leave an active partial game. Do not rewrite existing saves.
4. Connect modern Settings to that path; retain historical-era behavior. Then resume the financial aggregation and authoritative free-agency work.

### Source checks on November 12, 2026

- The official [NBA CDN schedule](https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json) request timed out. The public ESPN scoreboard request for `20261111` returned HTTP 403. No credential use, access bypass or identity spoofing was attempted.
- Upstream [ScheduleLeagueV2 documentation](https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/scheduleleaguev2.md) describes schedule/status fields. It does not establish an actual completion timestamp or prove that a downloaded season is complete.
- Upstream [live play-by-play documentation](https://github.com/swar/nba_api/blob/master/docs/nba_api/live/endpoints/playbyplay.md) describes per-action `timeActual`. Exact final-buzzer semantics and corrected/late-entered actions remain unverified; do not automatically equate the last action with authoritative completion.

No usable dated modern roster dataset or verified live game payload was obtained in this pass. A versioned local dataset with admitted evidence can unblock development without a live provider; its assertions still need verification before it is presented as real NBA state.

## Checks

Run the focused projection regression tests with `bun run test -- tests/application/games/prepareRealSchedule.test.ts`. They cover strict cutoff behavior, aligned standings, unknown completion times, invalid/mismatched records, and unchanged input after rejection.

Track feature status and remaining work in `odd/tasks/boston-financial-core.md`.
