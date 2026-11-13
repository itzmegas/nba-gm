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

### Public archive follow-up, November 12, 2026

The blocker remains **unavailable cutoff-complete evidence**, not proven nonexistence of NBA data. A bounded repository scan found no local dated scenario dataset.

| Candidate | Retrieved evidence | Admission limitation |
| --- | --- | --- |
| [B-Ref November results](https://www.basketball-reference.com/leagues/NBA_2027_games-november.html) | Accessible 2026-27 fixtures, scores, ET start times, game lengths and NBA Cup markers; parent independently retrieved the page. | Scheduled start plus game length is not an actual completion timestamp. Results observed after midnight do not prove final status before midnight. Phase and season completeness remain unverified. |
| [sportsdataverse roster release](https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/espn_nba_rosters) | Researcher observed 2027 assets created November 11 at approximately 12:35Z. The release is mutable and warns that ESPN rosters are scrape-time snapshots. | No October 20 capture was found; November 11 observation does not establish unchanged membership through November 12 at 05:00Z. Contract terms are not supplied by a roster capture. |
| [Deocheng dataset](https://www.kaggle.com/datasets/deocheng/nba-data-1946-2026) | Advertises an August 18, 2026 snapshot, game coverage through 2025-26 and future contract salary columns. | Future salary columns do not establish October/November 2026 roster membership. No dataset archive was downloaded or admitted. |
| [Eoin Moore dataset](https://www.kaggle.com/datasets/eoinamoore/historical-nba-data-and-player-box-scores) | Advertises 2026-27 coverage and discloses nightly upload problems. | Visible sample did not establish completion timestamps; full-file schema and coverage remain unverified, not proven absent. |
| [ESPN final recap](https://www.espn.com/nba/recap?gameId=401909967) | Researcher observed pre-midnight final reports for two November 11 games. | A final report published before cutoff can establish completion **by** publication, not the exact buzzer time. Coverage is partial and must be corroborated before admission. |

The normalized projection currently requires exact `completedAt`. Do not put a publication timestamp in that field. If upper-bound evidence is admitted later, represent its distinct semantics explicitly and test strict cutoff handling; no such model change or source admission is claimed here. Opening-day results occur after the approved opening cutoff, but this does not resolve missing opening roster/contract evidence.

Remaining acquisition targets: a dated all-team roster/contract package reconciled through the selected boundary, and completion evidence covering every candidate result. No current roster, guessed finish time, or partial all-team sample is a fallback. Atomic initialization, Settings integration and financial/free-agency tasks remain pending.

### Opening snapshot priority and roster evidence

The user approved prioritizing a self-assembled, versioned **season-opening** snapshot, using public evidence and explicitly disclosed approximations. Today remains deferred, not cancelled. Research comes first; no additional financial default or unsupported historical membership is approved by this priority change.

The parent retrieved and text-extracted a [four-page opening-roster PDF hosted by Tucson.com](https://bloximages.chicago2.vip.townnews.com/tucson.com/content/tncms/assets/v3/editorial/7/f1/7f1cf57c-5e0b-4ec0-b8ce-5fc1ce6689b8/6ad6b8a62682f.pdf.pdf) on November 12 (HTTP 200, application/pdf, 239,123 bytes). It is dated October 19, 2026 and contains lists for all 30 teams. An NBA-controlled original has not been authenticated; retain the observed host and distinguish this candidate list from an admitted dataset.

- **Classification:** the PDF's “INACTIVE/TWO-WAY LISTS” mixes inactive standard-contract players with two-way players. Only the starred entries indicate two-way contracts. Do not discard inactive standard players.
- **Golden State:** the [official October 19 announcement](https://www.nba.com/warriors/news/warriors-announce-2026-27-opening-night-roster-20261019), published at 5:16 p.m. PDT, supplies 18 players and three explicit two-way labels. Parent inspection corroborates membership with the PDF, including inactive standard players.
- **Milwaukee:** the PDF has 17 players and omits Pete Nance. The [official October 19 release](https://www.nba.com/bucks/news/milwaukee-bucks-finalize-2026-27-opening-night-roster), published at 10:36 p.m. CDT (03:36Z October 20, before cutoff), reports Kevin Porter Jr.'s waiver request and Nance's two-way signing and lists 18 players. Publication establishes what was reported by that time, not an exact transaction-effective timestamp. Retain this discrepancy for reconciliation, rather than silently selecting the PDF.
- **Results:** the PDF schedules the first regular-season games for October 20 at 3 p.m., 7 p.m. and 9:30 p.m. ET, all after the approved opening cutoff. This supports an opening scenario without prior regular-season results; it does not certify the full schedule.

Next research: reconcile candidate membership against final dated team announcements and transactions, then attach independently sourced salaries, guarantees and options. Prior Boston salary evidence does not validate other teams. Search-only post-cutoff salary reports remain leads, not admitted historical amounts. No all-team roster/contract snapshot has yet been admitted.

### Contract research samples, November 12, 2026

Dated contract reporting can supply terms independently of the roster source. The following are **research samples, not admitted team payrolls**. The parent directly retrieved the Niang/Williams report, Anderson report and Toronto opening roster; Shead's reports were inspected by the researcher.

| Player / opening team | Reported 2026-27 terms | Evidence and remaining limits |
| --- | --- | --- |
| Georges Niang / GSW | $3,876,529 full-season salary; $1,838,009 partial guarantee at publication. Full salary if not waived on or before January 7; Exhibit 3 foot-related protection reported. | [August 27 report](https://www.hoopsrumors.com/2026/08/contract-details-niang-b-williams-watson-castro.html), plus the official opening roster above. Do not replace the full salary with the guaranteed portion or assume the reported protection has no effect. Cutoff continuity of the terms is not fully reconciled. |
| Brandon Williams / GSW | $2,625,627 full-season salary; initially non-guaranteed, with a $1.4m partial guarantee conditional on making the opening-night roster and full salary conditional on remaining under contract through January 7. | Same August 27 report and official opening roster. Preserve the roster-triggered condition; do not silently label the entire season guaranteed. Contract instrument and exact trigger-effective time were not inspected. |
| Kyle Anderson / TOR | Approximately $3.88m salary versus approximately $2.45m cap hit on a one-year minimum deal. Guarantee unspecified. | [July 2 report, updated July 6](https://www.hoopsrumors.com/2026/07/raptors-kyle-anderson-agree-to-one-year-deal.html). The retrieved body gives rounded amounts, not exact dollar figures; exact amounts require another source or a separately verified applicable scale. |
| Jamal Shead / TOR | $2,296,271 salary following a reported 2026-27 team-option exercise. A later $24m extension reportedly starts in 2027-28. | [June 25 option report](https://www.hoopsrumors.com/2026/06/raptors-exercise-2026-27-team-option-on-jamal-shead.html) and [October 1 extension report](https://www.hoopsrumors.com/2026/10/raptors-jamal-shead-agree-to-three-year-extension.html), inspected by the researcher. Do not allocate the extension total to 2026-27. |

The [official Toronto opening-roster body](https://www.nba.com/raptors/news/raptors-set-opening-night-roster-3) was directly retrieved by the parent: it explicitly states “as of October 19, 2026”, lists Anderson and Shead, and contains 14 standard players plus two marked two-way players. Its assembly history dates Anderson's acquisition July 8, whereas the secondary report says official July 6. Both precede cutoff; retain the discrepancy rather than manufacture an exact signing date.

No additional pre-cutoff archived team payroll was verified in this bounded pass. Salary, cap hit, guaranteed amount, future-season extensions and conditional guarantees must remain distinct. Unknown guarantees are not automatically zero or fully guaranteed. No new approximation policy, complete contract ledger or financial legality is established by these examples.

### Thirty-team roster survey, November 12, 2026

User direction: complete the team survey first, then compare missing evidence and decide; no additional approximation has been approved. The parent downloaded and text-extracted the four-page PDF again. The following counts include **all unstarred inactive players as standard** and **all starred players as two-way, including stars in the main roster block**. They describe the candidate PDF, not an admitted cutoff dataset. A matching count alone does not prove matching membership or contract continuity.

| Team | PDF standard | PDF two-way | Independent opening evidence inspected |
| --- | ---: | ---: | --- |
| Atlanta | 15 | 3 | Secondary report after cutoff; see November 13 follow-up |
| Boston | 14 | 3 | Secondary report dated October 20, publication hour unknown |
| Brooklyn | 15 | 3 | Pending |
| Charlotte | 15 | 3 | Pending |
| Chicago | 14 | 3 | Pending |
| Cleveland | 14 | 3 | Pending |
| Dallas | 15 | 2 | Pending |
| Denver | 14 | 3 | Official two-way signing reports only; final full list pending |
| Detroit | 15 | 3 | Pending |
| Golden State | 15 | 3 | Official list: 15 + 3; previously parent-checked |
| Houston | 14 | 3 | Secondary report: 14 + 3; full list pending |
| Indiana | 14 | 3 | October 17 independent report: 14 + 3; parent-checked |
| LA Clippers | 15 | 3 | Pending; training-camp roster is not opening evidence |
| LA Lakers | 15 | 3 | Secondary report: 15 + 3; official full list pending |
| Memphis | 15 | 3 | Official list: 15 + 3; researcher inspected |
| Miami | 14 | 3 | Pending |
| Milwaukee | 15 | 2 | Official list: 15 + 3; Pete Nance absent from PDF |
| Minnesota | 14 | 2 | Official linked PDF: 14 + 2; parent-checked November 13 |
| New Orleans | 15 | 3 | Official list: 15 + 3; researcher inspected |
| New York | 14 | 3 | Pending |
| Oklahoma City | 14 | 3 | Game-notes lead only; final full list pending |
| Orlando | 14 | 3 | Official October 16 named list: 14 + 3; parent-checked |
| Philadelphia | 15 | 2 | Pending |
| Phoenix | 14 | 3 | Pending |
| Portland | 15 | 2 | Pending |
| Sacramento | 14 | 2 | Official list: 14 + 2; parent-checked this pass |
| San Antonio | 14 | 3 | Secondary report: 14 + 3; official full list pending |
| Toronto | 14 | 2 | Official list: 14 + 2; no publication hour established |
| Utah | 15 | 3 | Pending |
| Washington | 15 | 3 | Official aggregate: 18 total, including 3 two-way; names not verified |

New official-source findings (dates below are publication times, not transaction-effective timestamps):

- **Memphis:** [October 19, 5:00 p.m. CDT release](https://www.nba.com/grizzlies/news/grizzlies-finalize-202627-opening-night-roster), before cutoff. The researcher inspected 18 entries, with Carson Cooper, Jahmai Mashack and Javon Small as two-way players, and reports of waiving Walter Clayton Jr. and Micah Peavy. Retained financial obligations and exact waiver-effective times remain unverified.
- **New Orleans:** [October 19, 4:01 p.m. CDT release](https://www.nba.com/pelicans/news/2026-27-opening-night-roster-pelicans-vs-pacers-nba-season), before cutoff. The researcher inspected 18 entries, with Malik Dia, Jaron Pierre Jr. and Julian Reese explicitly marked two-way.
- **Sacramento:** [October 19, 5:43 p.m. PDT release](https://www.nba.com/kings/news/kings-announce-2026-27-opening-night-roster), before cutoff. Parent inspection confirms 16 entries, with Leaky Black and Jonathan Mogbo marked two-way; Maxime Raynaud and Ben Simmons are unstarred, matching their classification in the PDF's inactive section. The release gives Darius Acuff Jr.'s birthdate as November 16, 2026, after publication: an apparent source error, not an approved biographical value. Do not import unrelated fields blindly.
- **Washington:** [October 19, 4:01 p.m. EDT release](https://washingtonwizards.com/news/wizards-announce-2026-27-opening-night-roster), before cutoff. The researcher retrieved an explicit total of 18, including three two-way players; the retrieved body does not establish the names. This is count corroboration only.

At the end of the November 12 pass, coverage was **30 candidate PDF team lists**, **six teams with inspected official named lists** (GSW, TOR, MIL, MEM, NOP, SAC), and **one further official aggregate** (WAS). Minnesota was then a search-only lead; the November 13 pass below supersedes that status. Public-source retrieval gaps do not prove source nonexistence. The PDF's mixed inactive/two-way sections and main-block stars are material: for example, the Clippers' three two-way players are in the main block, as are two for Oklahoma City and one for Washington.

### Targeted source follow-up, November 13, 2026

Two read-only researchers targeted six Eastern and six Western teams. The parent separately inspected Atlanta reporting and spot-checked Indiana and Minnesota. Matching counts are not full membership reconciliation; publication dates do not establish transaction-effective times.

| Team | Retrieved source and observed date | Evidence level and remaining limits |
| --- | --- | --- |
| Atlanta | [Atlanta News First](https://www.atlantanewsfirst.com/2026/10/20/breaking-down-atlanta-hawks-2026-27-roster/), October 20, 5:03 p.m. EDT, updated 7:21 p.m. | Parent fetched. Post-cutoff reporting calls it a 15-man roster, discusses inactive Henri Veesaar separately, and explicitly names RayJ Dennis, Keshon Gilbert and Jalen Wilson as two-way. Supports classification, not proven continuity to cutoff. |
| Boston | [Sports Illustrated season guide](https://www.si.com/nba/celtics/onsi/2026-27-boston-celtics-season-guide-roster-schedule-storylines-and-key-dates-01m5cry2stzs), October 20, time unknown | Researcher fetched 14 standard + 3 labeled two-way: Dillon Mitchell, Devin Carter, Amari Williams. Secondary evidence; the date alone cannot place publication before cutoff. Prior Boston approximation is not independent validation of this list. |
| New York | [Yahoo/Sporting News lead](https://sports.yahoo.com/articles/knicks-mike-brown-details-why-095828159.html); [RealGM lead](https://basketball.realgm.com/wiretap/287725/Knicks-Waive-Bruce-Brown%3B-James-Wiseman-Set-To-Make-Opening-Night-Roster) | Yahoo fetch yielded no usable roster body; RealGM's indexed October 19, 4:16 p.m. snippet suggests Bruce Brown waived and James Wiseman retained. Snippet-only transaction lead, no fetched full list or contract classification. |
| Philadelphia | [Sixers Wire/Yahoo lead](https://sports.yahoo.com/articles/complete-2026-27-philadelphia-76ers-213029408.html), October 20, time unknown | Fetch yielded title/byline/date, not a usable roster body. No count, names or pre-cutoff proof admitted. |
| Cleveland | [Official live roster](https://www.nba.com/cavaliers/roster) | Retrieved live page is not dated opening evidence; final historical list remains pending. |
| Detroit | [Official live roster](https://www.nba.com/pistons/roster) | Retrieved live page is not dated opening evidence; final historical list remains pending. |
| Indiana | [Fieldhouse Files](https://www.fieldhousefiles.com/p/pacers-waive-james-johnson-opening-night-roster-2026), October 17, time unknown | Parent fetched: 14 standard + 3 two-way (Braden Smith, Jalen Slawson, Kobe Brown). Its depth chart lists 12 standard surnames and separately lists McConnell/Furphy as out, consistent with all 14 candidate standard players. Reports James Johnson, Keba Keita and Rienk Mast waived. Secondary pre-cutoff evidence; later continuity and retained financial obligations remain unverified. |
| Oklahoma City | [Official game-notes lead](https://www.nba.com/gamenotes/thunder.pdf?date=20261015), reportedly dated October 14 | Researcher's fetch could not inspect PDF content. Treat Barnhizer/Dix/Oweh two-way names as an indexed lead, not retrieved proof; the query string does not establish an archived edition. No final standard count corroborated. |
| San Antonio | [Pounding The Rock](https://www.poundingtherock.com/spurs-news/108376/spurs-announce-opening-night-roster-for-the-2026-27-season), October 18, 01:47 UTC | Researcher retrieved secondary report of 14 standard + 3 two-way: David Jones-Garcia, Maliq Brown, Ja'Kobi Gillespie. Official full list and full candidate comparison pending. |
| LA Lakers | [Lakers Nation](https://lakersnation.com/lakers-waive-dalton-knecht-to-get-roster-down-to-15-players/), October 19, time unknown | Researcher reports 15 standard + 3 two-way (Arthur Kaluma, Chris Mañon, AK Okereke), and Dalton Knecht waived. Official list, publication hour and complete membership comparison pending. |
| Denver | Official signing releases: [Bryce Hopkins](https://www.nba.com/nuggets/news/nuggets-sign-bryce-hopkins-to-two-way-contract), September 9; [Cam Whitmore](https://www.nba.com/nuggets/news/nuggets-sign-cam-whitmore-to-two-way-contract), September 22; [Ryan Nembhard](https://www.nba.com/nuggets/news/nuggets-ryan-nembhard-two-way-contract), September 30 | Researcher retrieved individual two-way reports, not a final list or standard count. Signing evidence does not prove unchanged membership through cutoff. An October 20, 3:54 p.m. MDT preview is after cutoff. A Denver Gazette lead returned 403; do not bypass access restrictions. |
| Houston | [Hoops Rumors](https://www.hoopsrumors.com/2026/10/rockets-convert-tshiebwe-phillips-to-two-ways-waive-pedulla.html), October 19, 3:14 p.m., timezone unspecified | Researcher retrieved 14 standard + 3 two-way: Quadir Copeland, Oscar Tshiebwe, Julian Phillips; Sean Pedulla waived. Full standard list and timezone remain pending. |
| Minnesota | [Official announcement](https://www.nba.com/timberwolves/news/timberwolves-finalize-2026-27-opening-night-roster), October 19, 4:53 p.m. CDT (21:53Z), and its [linked roster PDF](https://events.wolveslynx.com/rs/055-RNL-339/images/TW2627-Final-Roster.pdf) | Parent fetched announcement and downloaded/text-extracted linked PDF via its short URL. PDF explicitly says “as of October 19, 2026”, lists 16 names and marks Zyon Pullin/Rocco Zikarsky as two-way. All 14 unmarked players, including Donte DiVincenzo, match the candidate PDF's standard membership. This replaces the prior snippet-only classification. |

**Current coverage:** seven inspected official named lists (GSW, TOR, MIL, MEM, NOP, SAC, MIN), one further official aggregate (WAS), and additional secondary/partial evidence at the levels above. The other 22 teams do not yet have an inspected official opening list or aggregate in this research; some now have useful secondary reporting. No claim that 30 rosters are reconciled or any full payroll is verified.

Next: continue the unresolved teams and late pre-cutoff transaction chains, preserving negative retrieval results to avoid repeating unproductive leads. Then consolidate membership discrepancies, salary/cap-hit evidence, guarantees/options, waived-player obligations and unknown effective times across all 30 before asking for the missing-data decision. No new approximation, financial legality or dataset admission is established.

### Additional unresolved-team probes, November 13, 2026

These probes are completed research attempts, not completed roster reconciliation:

| Team | Source inspected or attempted | Assessment |
| --- | --- | --- |
| Brooklyn | [NetsDaily September 22 preview](https://www.netsdaily.com/nets-news/114101/month-to-go-brooklyn-nets-fans-can-start-2026-27-season-countdown-today) | Anticipates 15 standard and three filled two-way slots; not the final list. Full names, later changes and finances unresolved. |
| Charlotte | [Official live roster](https://www.nba.com/hornets/roster) | No historical opening list established. Candidate counts remain uncorroborated. |
| Chicago | [Official training-camp announcement](https://www.nba.com/bulls/news/bulls-announce-training-camp-roster-4), plus live roster | Training camp does not establish final cuts or cutoff continuity. No final named list admitted. |
| Cleveland | [September 24 official training-camp announcement](https://cavs.com/news/releases-training-camp-roster-260924) | Parent fetched: 21 names, including four marked camp invites and three explicit two-way players (Tristan Enaruna, Riley Minix, Ernest Udeh Jr.). Excluding invites yields the candidate 14+3 membership, but exclusion is not proof the four were actually cut or no other moves occurred. Final transaction chain and finances unresolved. |
| Dallas | [October 17 Yahoo/DMN lead](https://sports.yahoo.com/articles/dallas-mavericks-waive-two-guards-232956100.html); [October 19 fan-site report](https://thedallasmavericksnews.com/news/dallas-mavericks-waive-dwight-powell-finalize-roster-season) | First body unavailable; second claims 15 standard but lacks a complete list and corroborated financial evidence. Neither establishes the final full roster or two-way names. |
| Detroit | [October 18 Yahoo/MLive lead](https://sports.yahoo.com/articles/pistons-two-cuts-roster-following-014421826.html) | Title/date/preview only, not usable full roster evidence. Final cuts, full membership and finances unresolved. |
| LA Clippers | [Official live roster](https://www.nba.com/clippers/roster) | No historical opening list established; candidate main-block stars must not be mistaken for standard players. |

Parent's direct public download of the Oklahoma City game-notes lead returned HTTP 403. No retry with different identity or access bypass was attempted; neither indexed text nor the URL's date query is admitted as a dated retrieved roster.

### All-team assessment closure

The [consolidated 30-team assessment](OPENING_ROSTER_ANALYSIS.md) supersedes the interim coverage totals above. It records eight dated official named lists, one official aggregate, five secondary opening reports, three post-cutoff/time-uncertain reports and thirteen partial/unresolved cases. Research coverage is 30/30; complete roster/financial reconciliation is not claimed. In particular, Philadelphia and Portland have contract-classification discrepancies, and Utah has a post-cutoff transaction to resolve.

### Composition reconciliation follow-up, November 13, 2026

This pass observes public sources on November 13; source publication and reported transaction effectiveness remain separate. It does not admit a snapshot or certify finances.

**Washington:** the parent retrieved the [official October 19 release](https://washingtonwizards.com/news/wizards-announce-2026-27-opening-night-roster) again and directly inspected its [linked roster artwork](https://cdn.nba.com/teams/uploads/sites/1610612764/2026/10/image.png?imwidth=482), a legible 482×624 PNG. The release is published at 4:01 p.m. EDT (`2026-10-19T20:01:00Z`), before cutoff. The image explicitly marks Reece Beekman, Felix Okpara and Jamir Watkins as two-way. Its 15 unstarred names are Deandre Ayton, Bub Carrington, Justin Champagnie, Bilal Coulibaly, Anthony Davis, AJ Dybantsa, Kyshawn George, Anthony Gill, Tre Johnson, Tre Mann, Khris Middleton, Will Riley, Alex Sarr, Tristan Vukcevic and Trae Young. This resolves the earlier **names not retrieved** gap, not later continuity or retained salary obligations. Text-only extraction had omitted the image's contents.

A [Maryland Sports Blog report dated October 19](https://marylandsportsblog.com/washington-wizards-announce-2026-27-opening-night-roster-as-new-era-begins-in-d-c/) was also retrieved and lists the same 18 names without contract markers. Its publication hour is unknown; the official image, not this secondary list or a current roster, supports classification. The parent downloaded/text-extracted the candidate PDF again and compared all 18 Washington names/classes to the official artwork: they match, including unstarred inactive Tristan Vukcevic and main-block starred Felix Okpara.

#### Milwaukee: roster omission resolved, financial effects not resolved

The researcher re-fetched the [official finalized opening-roster release](https://www.nba.com/bucks/news/milwaukee-bucks-finalize-2026-27-opening-night-roster), dated October 19, 2026 at 10:36 p.m. CDT (`2026-10-20T03:36:00Z`). It reports a finalized 18-player list, Pete Nance's two-way signing and the request for waivers on Kevin Porter Jr. Publication is 24 minutes before cutoff. This supports **15 standard + 3 two-way including Nance**, superseding the candidate's omission. Parent PDF reinspection confirms Nance and Porter are both absent from that earlier candidate.

The release reports completed signing/finalization by publication, but does not supply an exact signing-effective or waiver-clearance timestamp. Porter's roster departure must not delete his financial row: guarantees, possible claims, offsets and retained cap obligations remain unverified. No payroll value is admitted here.

#### Philadelphia: three two-way classifications, not two

The researcher retrieved these official pre-cutoff bodies:

| Source | Publication evidence | Reported event/classification |
| --- | --- | --- |
| [Rupert signing](https://www.nba.com/sixers/news/philadelphia-76erssign-rayan-rupert-to-two-way-contract) | July 8, 2026, 9:06 p.m. EDT (`2026-07-09T01:06:00Z`) | “the team has signed Rayan Rupert to a two-way contract.” Parent independently retrieved the full release and its July 8 dateline. |
| [Fall conversion](https://www.nba.com/sixers/news/philadelphia-76ers-convert-tacko-fall-to-two-way-contract) | October 17, 2026, 11:32 a.m. EDT (`2026-10-17T15:32:00Z`) | Fall converted to a two-way contract; no exact transaction-effective clock supplied. |
| [October 19 All-Access discussion](https://www.nba.com/sixers/news/sixers-all-access-nick-nurse-and-mike-gansey-discuss-lebron-james-jaylen-brown-and-the-new-look-76ers) | October 19, 2026, 11:22 a.m. EDT (`2026-10-19T15:22:00Z`) | Calls Love and Rupert two-way players near cutoff. |

Reinspection of the [October 20 Sixers Wire/Yahoo body](https://sports.yahoo.com/articles/complete-2026-27-philadelphia-76ers-213029408.html) finds **Fall, Love and Rupert** labeled two-way. This corrects the earlier incomplete extraction above, which mentioned Love/Rupert without recording Fall. It does **not** show Fall being replaced by Rupert. Parent re-extracted the candidate PDF: Fall/Love are starred; Rupert is unstarred. Correcting Rupert's class changes that candidate from **15+2 to 14+3** without changing its names.

The official sources support the classification correction, but are not a complete final named list with a proven transaction chain through cutoff. Yahoo's displayed date has no established publication hour; the digits in its URL are not admitted time evidence. Do not certify full cutoff membership or term continuity from it. A guessed official final-list URL returned 404. Parent's separate standard-library fetch of the Fall URL returned HTTP 403; the researcher's successful body retrieval remains identified as such, not a parent success. No access bypass was attempted.

#### Portland: Youngblood transition still unavailable

The researcher retrieved the [official September 27, 2026 training-camp roster](https://blazers.com/news/trail-blazers-announce-2026-27-training-camp-roster): Kent, Tonje and Youngblood are starred, with the explicit legend “Player on a two-way contract.” Parent reinspection of the October 19 candidate PDF confirms Kent/Tonje starred but Youngblood unstarred. Camp classification plus a later missing marker is not proof of conversion.

The retrieved [ESPN Portland transaction page](https://www.espn.com/nba/team/transactions/_/name/por/portland-trail-blazers) includes October 16 Houstan and October 17 Sochan waivers, but no Youngblood transition. This partial feed cannot prove that none occurred. No dated conversion/cut/continued two-way evidence through cutoff was retrieved in the bounded pass. Keep Youngblood's cutoff class **unresolved**, not silently standard or two-way.

#### Utah: later first-game change must not replace cutoff state

The researcher retrieved [KSL's October 21, 2026, 10:37 a.m. report](https://sports.ksl.com/nba/utah-jazz/blake-hinson-kobe-bufkin/578337), which says the Jazz **plan to waive** Hinson and sign Bufkin two-way; publication timezone was not established. The parent independently retrieved [SI's October 21 report](https://www.si.com/nba/jazz/onsi/utah-jazz-sign-former-first-round-pick-right-before-opening-night), including the embedded October 21 Fischer report: “The Jazz are signing Kobe Bufkin … to Utah's newly-opened two-way slot.” SI also describes Hinson waived to create space, and Alexander/Ingram as the other two-way players. Exact transaction-effective times remain unspecified.

These post-cutoff reports explain a **later** first-game roster change, not Bufkin's presence at `2026-10-20T04:00:00Z`. Parent PDF reinspection confirms Alexander/Hinson/Ingram starred in the candidate. Keep that candidate provisional; neither source independently proves those occupants remained through cutoff. ESPN's Utah transactions body returned “No Data Available”; an indexed October 17 Ingram conversion is only a lead. Parent's direct standard-library KSL fetch returned HTTP 403; no bypass or retry with altered identity was attempted.

Targeted follow-up advances the Ingram lead: the researcher and parent retrieved [his NBA.com player-news page](https://www.nba.com/jazz/player/1631127/harrison-ingram). Its dated **October 17, 2026** RotoWire update says “Ingram was converted to a two-way contract by the Jazz on Saturday, Keith Smith of Spotrac.com reports.” This is retrieved, dated reporting of a **completed** pre-cutoff conversion, not a Jazz-issued release and not a current-roster inference. It supersedes the snippet-only status for this specific event. The [July 25 SI signing report](https://www.si.com/nba/jazz/onsi/jazz-sign-former-spurs-f-harrison-ingram-here-s-what-you-need-to-know) leaves his original deal type undisclosed and discusses then-current Hinson/Bates/Alexander slots; it is not proof of October occupants. The researcher also read [Hinson's dated player-news entries](https://www.nba.com/jazz/player/1642396/blake-hinson): October 17/20 injury entries do not specify his cutoff contract class, while October 21 reports Utah “will waive” him from his two-way deal. None closes the entire pre-cutoff continuity chain.

The further Portland search retrieved only a [March 13, 2026 official game preview](https://www.nba.com/blazers/news/three-game-homestand-finishes-friday-versus-jazz) labeling Youngblood “G League Two-Way” in **2025-26**. This wrong-season evidence is excluded from the October 2026 classification decision. No new usable 2026-27 Youngblood transition or final-list artifact was obtained.

The researcher's PDF fetch failed because its tool rejected `application/pdf`; this was not a source absence. Parent's public curl download and `pdftotext -layout` succeeded, resolving that inspection limitation for the four sections and Washington without authenticating the publisher.

Current coverage totals are maintained in the [consolidated assessment](OPENING_ROSTER_ANALYSIS.md); earlier totals above describe earlier passes.

#### Remaining-team composition pass

Two read-only researchers followed the remaining 18 teams; the parent independently retrieved Dallas's release and Charlotte's article, and inspected the OKC/Phoenix artifacts below. No team was promoted to “cutoff reconciled” from a count or search result.

| Team | Additional source evidence observed November 13 | Disposition and limits |
| --- | --- | --- |
| Atlanta | October 20 ANF report already linked above; no new earlier list retrieved. | After cutoff; full candidate-name comparison and continuity still pending. |
| Boston | [NESN/Yahoo October 17 lead](https://sports.yahoo.com/articles/celtics-final-roster-looks-ahead-213447123.html) exposes wrapper/title/date, not a complete article body. | Researcher's initial full-comparison claim was withdrawn on recheck. October 20 SI evidence above remains time-uncertain; no new pre-cutoff full list admitted. |
| Brooklyn | Targeted opening-roster queries yielded no usable final list beyond the September 22 forecast already linked above. | Later/current search results do not close historical membership. |
| Charlotte | [SI October 20 full season guide](https://www.si.com/nba/hornets/onsi/2026-27-charlotte-hornets-season-guide-roster-schedule-storylines-and-key-dates), parent-fetched; [October 18 Rookie Wire cut report](https://therookiewire.usatoday.com/story/sports/nba/rookie/2026/10/18/hornets-finalize-18-man-roster-following-final-preseason-game/92315985007/). | SI body lists 15 standard and Hall/Ajayi/Boswell two-way, matching all 18 candidate names/classes (normalizing name variants). Displayed publication has no hour. Rookie Wire text supplies count/cuts (Joiner/Wrightsell), not an independently inspected full list. |
| Chicago | [Yahoo cut lead](https://sports.yahoo.com/articles/chicago-bulls-waive-four-exhibit-193024502.html); [SI lead](https://www.si.com/nba/bulls/onsi/bulls-roster-update-team-appears-set-after-multiple-camp-invites-waived-19). | Search-only Hawkins/Sellers/Awaka names are leads, not admitted full-body historical proof. Full final body/list still missing. |
| Cleveland | [Cavaliers Nation report](https://cavaliersnation.com/2026/10/18/report-cavs-waive-4-players-ahead-of-the-regular-season/), updated October 18, 3:58 p.m., timezone unspecified, citing an October 17 Keith Smith post. | Reports Exhibit 10 cuts of Rashaun Agee, Zack Austin, Tre'Von Spillers and Noam Yaacov, leaving 14+3. Narrows camp uncertainty, but full final-name/class comparison and continuity remain pending. Yahoo copy returned wrapper only. |
| Dallas | [Official Powell waiver release](https://www.nba.com/mavs/news/mavericks-waive-dwight-powell), October 19, 9:30 a.m. CDT (`14:30Z`), parent-fetched. | Says “roster now stands at 17 players, including two Two-Way players.” Supports 15+2 by publication, not the unlisted identities, later continuity or waiver financial effects. |
| Denver | Official signing releases above remain partial. Researcher found a later November 5 game-notes edition; a media-guide lead returned 404 (exact failed URL not retained). | No inspected final pre-cutoff full list. Search-index dates are not edition proof. |
| Detroit | October 18 MLive/Yahoo lead above names John Ukomadu and Brice Williams cuts; indexed ESPN transaction date October 17 is only a lead. | No complete final body/list with two-way identities retrieved. Reported cuts do not independently settle effectiveness or liabilities. |
| Houston | [Hoops Wire October 19 report](https://hoopswire.com/rockets-make-multiple-roster-moves), hour/timezone unspecified. | Reports Tshiebwe/Phillips two-way conversions, Pedulla waived, Copeland as other two-way, 14+3. Corroborates earlier count/class reporting, not complete standard membership. |
| Indiana | Earlier October 17 Fieldhouse Files body remains the useful depth chart/count evidence. | No newly completed all-name comparison or later-move chain. |
| LA Clippers | [InfanityTV October 18 report](https://infanitytv.com/clippers-opening-night-roster-set-cameron-christie-blake-wesley-waived-isaiah-jackson). | Reports 15+3, Christie two-way, Wesley/Mensah/Oni/Telfort cuts. Discusses uncertainty between agreement/officialization and the transaction wire; complete names and primary transaction corroboration remain missing. |
| LA Lakers | Earlier October 19 Lakers Nation body supplies a secondary 15+3 list and Knecht cut; hour unknown. | No completed all-name candidate comparison or official opening list in this pass. |
| New York | [Yahoo final-slot lead](https://sports.yahoo.com/articles/york-knicks-decision-final-roster-161645912.html) remains snippet-only. | Akins/McCullar/Nickel agree with parent-inspected candidate markings. Researcher's initial conflict claim was erroneous and retracted; no body or historical timing proof added. League-wide article's `12:01 a.m.` label has unknown timezone and links live rosters, not archived names. |
| Oklahoma City | Official guide downloaded/inspected below. | Full name/class match; edition/publication timing still unverified. |
| Phoenix | Roster artwork inspected below. | Full name match; image does not classify contracts. |
| Miami | Earlier October 17 Hot Hot Hoops report additionally names Ausar/Kelley/Madsen/Mbeng cuts and the three two-way players. | No full standard-name comparison or complete continuity proof; no financial effects inferred. |
| San Antonio | Earlier Pounding The Rock list is published October 18, `01:47 UTC` (October 17, 8:47 p.m. CDT). | 14+3 secondary evidence before cutoff; no completed all-name comparison or official list in this pass. |

**Oklahoma City artifact:** the parent publicly downloaded the [exact official 2026-27 media guide](https://cdn.nba.com/teams/uploads/sites/1610612760/2026/10/ThunderMediaGuide202627WEB.pdf), a 204-page PDF, and extracted its roster on printed page 11. It explicitly marks Brooks Barnhizer, Josh Dix and Otega Oweh with `** Two-Way Contract`. The other 14 names are Alex Caruso, Shai Gilgeous-Alexander, Isaiah Hartenstein, Chet Holmgren, Aday Mara, Jared McCain, Ajay Mitchell, Thomas Sorber, Bennett Stirtz, Nikola Topić, Cason Wallace, Jalen Williams, Jaylin Williams and Kenrich Williams. All 17 names/classes match the candidate PDF, allowing diacritic normalization. The roster page has no authenticated historical as-of/publication timestamp. Embedded creation/modification dates and the guide's calendar entry for the October 19 roster deadline are **not publication or cutoff-continuity proof**. Native research fetches failed/timed out; the parent curl/PDF extraction succeeded without credentials or identity alteration.

**Phoenix artifact:** the [October 19 Burn City Sports report](https://burncitysports.com/2026/10/19/phoenix-suns-pick-up-drew-time-round/) links [roster artwork credited to Phoenix Suns Media](https://i0.wp.com/burncitysports.com/wp-content/uploads/2026/10/Screen-Shot-2026-10-19-at-4.09.10-PM.png?resize=300%2C164&ssl=1). Parent public downloads and image inspection succeeded at 300×164 and, with the resize query removed, 747×408. The header says **“PHOENIX SUNS, 2026-27 ROSTER (as of October 19)”**. It lists Devin Booker, Jamaree Bouyea, Miles Bridges, Dillon Brooks, Ryan Dunn, Rasheer Fleming, Collin Gillespie, Jordan Goodwin, Jalen Green, Oso Ighodaro, Luke Kennard, Khaman Maluach, Koa Peat, Duop Reath, Pat Spencer, Drew Timme and Mark Williams: all 17 candidate names match. There are **no contract markers or legend**. The retrieved article reports Reath converted two-way; the image does not establish Timme/Spencer's classes. This is a dated secondary-hosted artwork copy, not an authenticated NBA-hosted original; its filename clock is not admitted publication time. Continuity and financial terms remain open.

These attempts advance composition only. The cutoff requires sufficient historical bounds, not an invented exact clock: an official pre-cutoff statement that a transaction **has completed** can bound it by publication; a proposed action or later list cannot. Remaining unsupported continuity/classes stay unknown. Contracts follow composition reconciliation; no new approximation decision is requested or inferred from this pass.

## Checks

Run the focused projection regression tests with `bun run test -- tests/application/games/prepareRealSchedule.test.ts`. They cover strict cutoff behavior, aligned standings, unknown completion times, invalid/mismatched records, and unchanged input after rejection.

Track feature status and remaining work in `odd/tasks/boston-financial-core.md`.
