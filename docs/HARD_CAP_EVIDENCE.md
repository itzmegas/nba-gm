# Hard cap evidence and design implications

Research dates: 2026-11-10–2026-11-12. Latest decision: close Boston research for now and proceed with the approved playable approximation below. Complete opening-cutoff financial certification remains unresolved; it is not required to author this approximate scenario.
Status: Evidence record and design proposal. The CBA trigger table was verified directly; this is not an implementation specification or a complete CBA audit.

NBA hard caps are triggered team restrictions, not universal spending ceilings. Keep annual league thresholds separate from each team's hard-cap status. A game's financial state must remain usable without a live external provider.

## Approved Boston playable approximation — November 12

The user accepted closing this research for now and implementing a coherent playable scenario. This decision supersedes the earlier research handoff and missing-input policy only for the bounded initial assumptions below; historical findings remain evidence, not a certified complete NBA ledger.

| Initial Boston 2026-27 scenario component | Treatment |
| --- | --- |
| Hard-cap ceiling | First apron: $209,015,000, supported by the dated reporting below. |
| Supported 14 standard salary rows | $198,722,406; retain individual amounts, not a permanently fixed payroll total. |
| Unproven minor residual charges from initial cuts | Omit as an explicit game-scenario assumption, not a factual finding of zero NBA liability. |
| Known salaries, bonuses and retained charges | Preserve and count once according to their applicable treatment. Known Exhibit 10 affiliation bonuses remain excluded as explained below. |
| Missing salary for an active standard contract | Never silently replace with zero; excluding an active player's salary would grant free roster value. |
| Obligations generated after initialization | Preserve under the game's rules; the initial omission policy does not erase guaranteed salary when a player is released inside the game. |

The resulting initial threshold difference is **approximately $10,292,594**, not certified NBA legal spending room and not ordinary salary-cap room. Signings remain subject to the game's other applicable eligibility rules. This approval closes exhaustive research of minor initial residual charges; investigate material missing salary amounts rather than ranking players by fame. Future evidence may produce a new scenario version without silently rewriting existing saves.

This is Boston-only approval, not validation of all 30 teams, resolution of conflicting team trackers, or permission to infer an unrestricted status elsewhere. The approved opening boundary remains October 20 at midnight America/New_York. The existing October 15/live-refresh creation path is not that historical snapshot. Bind the approximation to an explicit initial scenario before enforcing it in new games; do not backfill existing games.

Implementation was authorized subsequently. Track scope and observed checks in `odd/tasks/boston-financial-core.md`. No remote database application is authorized by this document.

### Approved modern start settings and daily cutoff

The new-game page will expose a Settings section for the modern era, offering only **Today** and **Season start**. Fantasy draft and disabling the salary cap remain future ideas, not this implementation's scope. Historical-era creation must retain its existing behavior.

The user approved **00:00 America/New_York** as the Today cutoff: use New York's local calendar date at creation time, with that date's actual midnight UTC offset. Include only games completed before the cutoff; a game still in progress is not a completed result, even if its scheduled date precedes the cutoff. Season start retains the approved official opening-date midnight boundary. Neither mode authorizes updating existing saves.

Implementation status: the isolated selector and cutoff calculation are tested, but are not connected to game creation. Current modern creation fetches live rosters; its schedule is synthetic, not an imported NBA schedule/results snapshot. Dated modern scenarios and actual-results initialization are not available in the mapped paths. Do not present changing `simulationDate` alone as successful implementation of these start modes.

## Verified annual thresholds

The NBA's official release, dated June 30, 2026, announces the following **2026-27** amounts, effective July 1, 2026:

| Threshold | USD |
| --- | ---: |
| Minimum team salary | 148,465,000 |
| Salary cap | 164,961,000 |
| Luxury tax | 200,428,000 |
| First apron | 209,015,000 |
| Second apron | 221,686,000 |

Source: [NBA sets salary cap for 2026-27 season](https://www.nba.com/news/nba-salary-cap-2026-27-season).

These are league-wide thresholds, not proof that a particular team has activated a hard cap. Do not apply them to another season.

## Hard-cap mechanics: corroborated secondary evidence

[Eric Pincus's 2025-26 apron tracker](https://sportsbusinessclassroom.com/nba-2025-26-apron-tracker/), inspected during this research and marked updated March 6, 2026, explains that:

- The NBA operates a soft cap: teams need permitted exceptions to exceed the salary cap.
- Certain operations impose a hard spending limit at the first or second apron.
- A team above an apron cannot use a tool that would impose that ceiling unless the transaction satisfies the applicable limit.
- Having no hard cap does not waive other contract, exception, trade, tax, or apron restrictions.

Examples described by that source, **not an exhaustive implementation table**:

| Operation or tool | Hard-cap level described |
| --- | --- |
| Non-Taxpayer Mid-Level Exception | First apron |
| Bi-Annual Exception | First apron |
| Acquiring a player via sign-and-trade | First apron |
| Taxpayer Mid-Level Exception | Second apron |

The source also describes trade-related triggers and lists team statuses with triggering transactions. The primary-source verification below supersedes this introductory list where qualifications apply. Do not implement a simplified Reddit example as a complete rule.

The tracker is a candidate for initial team-state evidence, not an existing application integration or an official NBA source. Its 2025-26 team statuses must not be reused as 2026-27 statuses or as an earlier historical snapshot.

## Primary-source CBA verification

The [NBPA CBA page](https://nbpa.com/cba) links the [official 2023 NBA-NBPA CBA PDF](https://imgix.cosmicjs.com/25da5eb0-15eb-11ee-b5b3-fbd321202bdf-Final-2023-NBA-Collective-Bargaining-Agreement-6-28-23.pdf). The NBPA identifies July 1, 2023 as its effective date, with a term through 2029-30 and an opt-out after 2028-29.

The PDF was downloaded and its text extracted directly with `pdftotext -layout` during this research. The citations below use **printed page numbers**, not PDF viewer offsets. Temporary research files were removed; no PDF copy was added to the repository.

### Enumerated triggers

Article VII, **Section 2(e)(4), pp. 190-191**, contains the Transaction Restrictions Table. Row letters below are the CBA's identifiers. These are rule categories, not a claim that the game supports them.

| Row | Transaction | Applicable ceiling | Definition or qualification |
| --- | --- | --- | --- |
| A | Signs or acquires a player using the Bi-Annual Exception | First apron | Section 6(d), pp. 235-236. Acquisition by assignment is available from 2024-25. |
| B | Signs or acquires a player using the Non-Taxpayer MLE | First apron | Section 6(e), pp. 236-237; qualifying use can be reclassified under Section 6(f)(5). Acquisition by assignment is available from 2024-25. |
| C | Acquires a player on a sign-and-trade contract | First apron | Refers to Section 8(e)(1). This row concerns the receiving team. |
| D | Signs during the regular season a player whose previous contract was terminated during that same regular season and whose salary under that contract exceeded that year's Non-Taxpayer MLE | First apron | The text does not limit this to the signing team's former player or require a negotiated buyout. |
| E | Acquires a player using an Expanded TPE | First apron | Section 6(j)(1)(iv), p. 241. |
| F | Acquires a player using a Standard TPE after the applicable regular-season boundary | First apron | Timing windows are specified below; Section 6(j)(1)(i), p. 240, defines the exception. |
| G | Acquires a player using a Transition TPE | First apron | Historical only: Section 6(j)(1)(iii), p. 241, permits this exception only during 2023-24. |
| H | Acquires a player using an Aggregated Standard TPE | Second apron | Section 6(j)(1)(ii), p. 240. Aggregates two or more outgoing contracts for simultaneous replacement acquisitions. |
| I | Pays cash to another team in connection with a trade | Second apron | Refers to Section 8(a); receiving cash alone is not the operation described in this row. |
| J | Acquires a player using a TPE in respect of a player contract signed and traded under Section 8(e)(1) | Second apron | Refers to TPEs under Section 6(j)(1)(i)-(iv); aggregation is not a condition stated by row J. |
| K | Signs a player using the Taxpayer MLE | Second apron | Section 6(f), pp. 237-238. |

**Row F timing:** the Standard TPE is used (i) after the end of the regular season in which it arose; or (ii), if it arose between the day after one regular season ends and the day before the next begins, after the end of that following regular season. Neither every use of a Standard TPE nor merely counting outgoing players identifies the applicable trigger.

### Enforcement and salary definition

- **Immediate and continuing ceiling:** Section 2(e)(2)(i), p. 187, prohibits a listed transaction if the resulting Apron Team Salary would exceed its applicable ceiling. Completing the transaction prohibits exceeding that ceiling for the remainder of the salary-cap year. The operative text is "may not, for the remainder of such Salary Cap Year" have Apron Team Salary above that level.
- **Apron Team Salary is not ordinary payroll:** Section 2(e)(1), pp. 186-187, adjusts Team Salary. Among other adjustments, it adds otherwise excluded performance bonuses and removes specified free-agent amounts, exception amounts, and incomplete-roster cap holds. Its referenced salary rules still need an implementation-level breakdown.
- **Additional restrictions after Taxpayer MLE use:** Section 2(e)(2)(iii)(B), pp. 188-189, prohibits subsequent transactions in rows A-F during the same salary-cap year from 2024-25 onward. A single stored ceiling cannot encode every eligibility restriction.

### Timing and qualifications that affect the state model

1. **Following-year restrictions:** Section 2(e)(2)(ii), p. 188, applies additional next-year tests to rows E-J between the day after the end of the regular season and the end of its salary-cap year. A qualifying transaction can constrain the subsequent year's Apron Team Salary through the end of that subsequent year.
2. **Offseason projection assumptions:** Section 2(e)(3), p. 189, assumes team/player options are exercised, early termination options are not exercised, no further transactions occur, and specified higher-max outcomes apply. It assumes next-year cap/apron amounts equal current-year amounts for this test. These assumptions are not a forecast of the ultimately announced thresholds.
3. **Historical transition:** Section 2(e)(5), p. 191, exempts rows F-J transactions during 2023-24 from imposing their ceiling for the remainder of 2023-24 by virtue of those transactions alone. Do not apply that exemption to later seasons or ignore the separate following-year rules.
4. **MLE reclassification:** Section 6(f)(5), p. 238, permits qualifying NTMLE signings to be deemed Taxpayer MLE use when another otherwise-permitted transaction causes Apron Team Salary to exceed the first apron. Conditions include no NTMLE acquisitions by assignment, contracts of at most two seasons, and combined first-year salary plus unlikely bonuses within the Taxpayer MLE amount. The remaining NTMLE availability is then extinguished. Therefore, an irrevocable first-apron flag for every initial NTMLE use would be incorrect.

Preserve the triggering operation, effective exception classification, affected salary-cap year(s), and provenance. A derived current ceiling is useful but insufficient as the sole authoritative record. A legitimate MLE reclassification must not erase an independent first-apron restriction.

## Sources inspected and their limitations

| Source | Observation | Limitation |
| --- | --- | --- |
| [Basketball Reference contracts summary](https://www.basketball-reference.com/contracts/) | Displays team salary totals and the season salary cap. | The inspected page did not establish individual team hard-cap status. |
| [Basketball Reference Boston payroll](https://www.basketball-reference.com/contracts/BOS.html) | Displays salaries, options, guarantees, and salary cap; states salaries are updated monthly. | Payroll totals alone cannot establish which hard-cap triggers were used. No explicit team hard-cap status was found on this inspected page; this is not a site-wide absence claim. |
| [Tailend 2023 CBA reader](https://tailend.app/nba/cba) | Accessible reader identifying Article VII sections on thresholds, exceptions, and trades. | Retrieved content did not provide the full operative clauses needed for a complete trigger audit. Tailend is a third-party reader. |
| [Reddit explanation supplied by the user](https://www.reddit.com/r/nba/comments/1mnhm6t/hard_cap_i_need_help_with_an_explanation_on_this/) | User supplied comments explaining soft cap, apron triggers, and exceptions. | Research lead, not authoritative rule text; the full thread was not independently retrieved. |
| [Reddit salary-cap post supplied by the user](https://www.reddit.com/r/nba/comments/1uk2weg/the_nba_announced_today_that_the_salary_cap_for/) | Attempted retrieval returned no usable content. | Its amounts, date, and underlying attribution were not verified. Use the official release above instead. |

CBA references supplied in the discussion: [Article VII, Section 2(a)(1)](https://tailend.app/nba/cba#/VII/2/a/1) and [Article VII, Section 6](https://tailend.app/nba/cba#/VII/6). These links are pointers for further research, not a claim that every relevant clause has been reviewed.

## Existing local behavior

- `src/domain/entities/Trade.ts` represents `hardCapLimit` as an optional number in `TradeTeamSnapshot`.
- `src/domain/services/TradeValidator.ts` checks the post-trade salary against the limit only when `hardCapLimit !== undefined`. An absent value therefore skips the check; it does not distinguish missing evidence from confirmed absence of a hard cap.
- `docs/database/modern-contract-trade-validation-report.md`, under "Remaining risks and unverified items", describes the older RPC's missing salary matching, hard-cap, and roster checks. It does not describe the latest boundary: `supabase/migrations/20261110100000_authoritative_trade_boundary.sql:84-87` rejects every player trade with `HARD_CAP_UNKNOWN`. The compatibility RPC delegates to that boundary at lines 108-114. This blocks unsafe player transfers; it does not implement complete financial validation.
- `src/application/contracts/materializeModernGameContracts.ts` acquires Basketball Reference contract snapshots and the official NBA G League two-way tracker. Its contract snapshot TTL defaults to 24 hours, and it enables stale fallback.
- `src/application/contracts/getFreshContractSnapshot.ts` permits stale fallback only with a previous cached value, an enabled fallback option, and the recognized `ContractSnapshotSourceUnavailableError`. Missing usable contract snapshots can prevent materialization; they do not automatically create an explicit team hard-cap state.

Contract and roster acquisition does not by itself establish an authoritative team hard-cap feed.

## Static comparison with supported game operations

Mapped on 2026-11-10, from local application code and ordered migration definitions, **not from a deployed database**. "Not found" below means not found in the mapped active transaction paths, not an exhaustive proof of repository-wide absence. No runtime tests were executed for this comparison.

| CBA rows or operation | Observed game capability | Hard-cap coverage or gap |
| --- | --- | --- |
| A, B, K: BAE / NTMLE / Taxpayer MLE | Free-agency offers and their resolution exist, but no named-exception selection or consumption was found. | Current legality uses cap room or minimum-salary rules, not these exception classifications or triggers. |
| C: receiving a sign-and-trade | No dedicated sign-and-trade flow found; all player trade assets are rejected by the latest authoritative RPC. | No mapped sign-and-trade trigger; blocking player trades is not support for this operation. |
| D: signing a qualifying released player | Releases and subsequent teamless-player offer/signing paths exist. | Release history and salary charges exist, but no assessment of row D's prior-contract salary and same-regular-season timing was found. |
| E, F, H, J: Expanded / timed Standard / Aggregated / sign-and-trade-related TPE use | Player/pick trade payloads exist; no explicit TPE inventory, classification, or use was found. Player transfers are blocked. | Do not infer a supported TPE merely because the older domain validator calculates salary matching. |
| G: Transition TPE | No mapped tool; historical 2023-24-only rule. | Not a tool to add for a 2026-27 scenario. |
| I: sending cash in a trade | Trade command and RPC asset types are player or pick, not cash. | No mapped cash-transfer operation or trigger. |
| Pick-only trades | Latest RPC supports validated pick transfers. | Ownership and transferability checks exist; this is not a player-salary mutation. |
| Release | Authoritative release records history, removes roster membership, and preserves salary charges. | Release alone does not activate a listed hard cap; later qualifying signing is a separate assessment. |

### Evidence locators and boundaries

- **Trade entry:** `src/infrastructure/trades/SupabaseTradeTransaction.ts:27-37` calls `execute_trade_authoritative`. The migration `20261110100000_authoritative_trade_boundary.sql:23-24` locks the owned game, lines 53-59 restrict asset types, lines 84-87 reject players, lines 89-100 transfer validated picks, and lines 108-114 route the old RPC name through the new boundary. The parent independently read this migration in full.
- **Legacy domain preview:** `src/domain/services/TradeValidator.ts:27-52,121-124,128-200` computes matching, roster checks, and an optional numerical hard cap. It does not establish authoritative persisted trigger state or make player transfers executable through the latest RPC.
- **Offer submission:** `src/infrastructure/freeAgency/SupabaseFreeAgencyRepository.ts:249-260` calls `submit_free_agency_offer`. Its source definition in `supabase/migrations/20261102170000_reconcile_legacy_through_056.sql:3123-3133` checks candidate/offer legality, cap room or minimum salary, roster size, and the supported season, without named MLE/BAE or hard-cap classification.
- **Actual signing resolution:** the same migration's `advance_simulation_day` wrapper at lines 544-569 invokes the due-market resolver. `resolve_due_free_agency_market` at lines 2520-2559 selects and assesses due offers; `resolve_free_agency_offer` at lines 2561-2605 rechecks legality, creates the runtime contract, assigns the player, accepts the winning offer, and rejects competing pending offers. Both resolution paths lock the owned game; the individual resolver also locks the offer.
- **Financial assessment:** that migration's lines 726-767 assess cap room/minimum salary and roster size, without a hard-cap or row D check. Lines 1194-1220 compute current-season payroll using canonical, runtime, and legacy contract sources plus release charges. This does not establish CBA Apron Team Salary support.
- **Season scope:** the financial context rejects game years other than 2026 at line 1167; assessment and submission require 2026-27 at lines 748-750 and 3127-3133. Do not generalize this implementation to arbitrary seasons.
- **Release history:** the same migration records `game_roster_releases` salary-by-year history at lines 2494-2502; the charge helper sums that history at lines 1345-1353. Charge accounting is not evidence that the later signing applies row D.
- **Definition precedence:** the mapped later migrations `20261104190000_modern_contract_trade_compatibility.sql` and `20261110100000_authoritative_trade_boundary.sql` change trade behavior; no replacement free-agency submission, release, or resolution definition was found there.
- **Season rollover:** `src/application/hooks/simulation/useAdvanceRange.ts:58-83` advances the simulation and stops on season completion. That inspected application path does not establish persisted hard-cap carry-forward or reset behavior. Exact rollover handling remains unverified.

### Recommended implementation boundary, not authorization

Do not add all unavailable NBA transaction tools just to implement hard-cap checks. First settle the initial state evidence and missing-data policy, then define persisted trigger provenance and season rules. Any future implementation should gate existing offer **resolution**, not only submission or previews, and preserve the current player-trade rejection until its full salary, roster, matching, and hard-cap proof is available.

Release charges must remain in the effective financial context; hard-cap calculations additionally require the CBA's Apron Team Salary adjustments. Existing locks are useful coordination points, not proof that missing rules have already been implemented.

## Proposed source-independent model

This section records the direction discussed, not authorization to implement it.

Separate three concerns:

1. **Versioned initial dataset:** real/imported or fictional/authored teams, players, contracts, and initial financial conditions, with provenance and an effective date.
2. **Season rules:** salary floor, salary cap, luxury tax, apron amounts, and versioned transaction rules, independent of team names and data providers.
3. **Game-owned state:** an initial copy that evolves through the game's authoritative transactions, not through continuous synchronization with real-world transactions.

Represent team hard-cap status per game, team, and season:

| Proposed status | Meaning |
| --- | --- |
| `unknown` | Evidence is insufficient to establish the applicable restriction. |
| `none` | Absence of an active hard cap is established for the initial scenario or current game state. Other financial rules still apply. |
| `first_apron` | The first-apron ceiling applies, using that season's rules. |
| `second_apron` | The second-apron ceiling applies, using that season's rules. |

Record the evidence or triggering operation separately from the status. Do not infer status solely from payroll. Where multiple active restrictions apply, enforce the stricter ceiling.

### Authority and transitions

- Initial real-world status needs dated evidence; missing evidence must not silently become `none`.
- A fictional scenario can explicitly define `none` as its starting condition without making any claim about actual NBA teams.
- An operation that activates a restriction must validate and persist that restriction in the same authoritative transaction as its financial effects.
- An ordinary trade, release, or signing does not automatically remove an existing restriction. Lowering payroll does not clear it.
- A season transition must establish the new season's state according to its rules; neither carrying forward nor clearing restrictions should be an accidental default.
- A provider outage must not erase an already established game state.

### Availability and fallback

Use a previously validated, versioned local dataset when live acquisition is unavailable, exposing its date and provenance. A cache or snapshot is not a new independent source, and its existence does not establish redistribution rights.

If no usable NBA dataset exists, an explicitly selected fictional scenario can keep the game playable. Never silently replace missing NBA facts with invented values. If initial hard-cap evidence is absent for all teams, a strict real-world scenario could have all teams marked `unknown`; apply the operation-scoped policy below rather than blocking the entire game.

### Approved financial uncertainty policy

Approved by the user on 2026-11-10: missing evidence must block only operations whose financial legality cannot be demonstrated, not the entire game. This approval concerns design, not implementation.

- Keep hard-cap knowledge and salary-calculation completeness separate. A known ceiling does not imply a complete salary calculation; a complete salary calculation does not establish which ceiling applies.
- Do not substitute `none` for `unknown`, or zero for missing financial inputs.
- Read-only screens and unaffected operations remain available. A read-only preview must distinguish a proven legal result from unavailable financial proof.
- Evaluate each mutation against its affected teams, salary-cap years, required inputs, and rules. Reject it when required proof is missing; do not reject unrelated operations merely because some other team's state is unknown.
- Reassess pending financial actions at actual execution, including free-agency offer resolution, not only at submission or in the UI. Preserve atomicity: a rejected execution must not partially apply a contract, ownership transfer, or trigger.
- Release is not automatically exempt: demonstrate its relevant financial effects and retained charges before declaring it safe. Existing player-trade rejection remains unchanged by this design approval.
- Apply the same missing-evidence policy to existing games. This does not authorize a backfill, reset, invented historical state, or a change to any stored game.

The exact user-facing messages and any handling of rejected pending offers remain to be designed. This policy does not require every nonfinancial action to consult an external data source.

## Apron Team Salary input design

This is a design breakdown of the directly verified Section 2(e)(1), pp. 186-187, plus a bounded static input map. It is not an implemented calculator. The starting point is CBA **Team Salary**, not the current application's payroll total. Existing contract and release-charge data can contribute to that starting point but do not prove it is complete.

| CBA item | Adjustment to Team Salary | Reference within Article VII unless stated otherwise |
| --- | --- | --- |
| (i) | Add performance bonuses excluded from Salary under the referenced rule. | Section 3(d) |
| (ii) | Add the specified salary attributable to contracts signed by free agents with zero or one year of service. | Section 2(d)(1)(i)(F) |
| (iii) | Add applicable grievance-related compensation amounts that could be added under the referenced Team Salary rule. | Section 4(a)(1)(iii), pp. 212-216; see verification below. |
| (iv) | Subtract the specified Free Agent Amounts. | Section 4(a)(2) |
| (v) | Add, for each restricted free agent, the greater of salary plus unlikely bonuses in an outstanding qualifying/max qualifying offer or in a First Refusal Exercise Notice. | Section 2(e)(1)(v); Article XI, Section 5(g) |
| (vi) | Subtract the specified amounts for unsigned first-round picks. | Section 4(a)(4) |
| (vii) | Add any outstanding Required Tender amount for a first-round pick. | Section 2(e)(1)(vii) |
| (viii) | Subtract exception amounts deemed included in Team Salary. | Sections 4(a)(7), 6(n)(2) |
| (ix) | Add salary temporarily excluded for contracts signed using the Second Round Pick Exception from July 1 through July 30. | Section 4(l), p. 225; see verification below. |
| (x) | Subtract incomplete-roster cap holds added to Team Salary. | Section 4(f) |

These are adjustments to a defined baseline: do not apply them blindly to payroll, add the same bonus twice, or subtract a hold that the baseline never included. Detailed cross-referenced rules still need review before claiming a complete numeric computation.

### Reusable inputs and missing proof

| Input group | Available in inspected models | Missing proof for complete calculation |
| --- | --- | --- |
| Contract salary and retained charges | Seasonal canonical salaries, runtime contracts, contract classifications, and release salary-by-year records. | Complete CBA Team Salary derivation and support for every applicable adjustment; nullable or estimated salary is not proof of an exact amount. |
| Bonuses | Snapshot provenance may contain notes. | `ContractSeasonSnapshot` and `GameContractSeason` have no typed bonus amount/classification fields. Notes alone are not a validated calculation input. |
| Service-year adjustment | Materialization reads years of experience; a minimum-salary schedule exists. | The inspected contract inputs do not establish the complete referenced adjustment and its applicability for each contract. |
| Restricted free agents | Offseason ledger and evidence hooks exist. | No typed QO/MQO or First Refusal Exercise Notice amounts were demonstrated in the mapped models. |
| Picks and tenders | Pick identity, draft year/round, ownership, protection, and transferability. | The mapped pick data does not establish salary holds or outstanding required tender amounts. |
| Exceptions, exclusions, roster holds | Contract cap-treatment classifications and an aggregate hold input exist. | The mapped fields do not establish the distinct CBA amounts and applicability needed for all adjustments. |

Evidence: `src/domain/contracts/ContractSnapshot.ts:20-41`; `src/domain/contracts/GameContract.ts:23-57`; `src/application/contracts/materializeModernGameContracts.ts:275-295`; `src/infrastructure/repositories/SupabaseOffseasonContractRepository.ts:26-35,74-88`; `src/domain/entities/Trade.ts:13-28`; `src/domain/services/SalaryCapCalculator.ts:7-22`. The parent spot-checked the contract snapshot fields; the rest is a bounded exploration handoff, not a repository-wide absence claim.

### Minimum calculation contract

- Reuse the effective-contract and retained-charge sources. For each applicable team and salary-cap year, derive a baseline and an explicit breakdown of adjustments with evidence. Financial ownership comes from the game, not the latest external roster.
- Distinguish complete from incomplete calculation. When required amounts or applicability cannot be established, expose the missing inputs; do not present a partial subtotal as a legally valid Apron Team Salary.
- Zero and not-applicable require evidence. In an authored fictional scenario, explicit absence of bonuses or tenders can supply that evidence; absence of an imported field cannot.
- Keep threshold provenance separate from salary completeness. `getSalaryCapThresholds` currently projects all thresholds by 10% annually from 2024 (`src/domain/constants/nba-rules.ts:48-60`); that policy is not a season-specific official dataset. Real-world published values and simulation projections must be identified separately.
- Preserve the salary-cap year explicitly. The inspected `enter_offseason` function only records entry for the current season (`supabase/migrations/20261102170000_reconcile_legacy_through_056.sql:878-904`); it does not increment the year or reset financial restrictions. A future rollover must account for the following-year restrictions described above.

## Referenced salary rules: additional primary-source findings

The official PDF was retrieved again for this pass, and the following findings were checked against its extracted text. Page numbers remain printed pages. These explain the previously unresolved references; they do not establish that the application has the necessary source data.

| Rule | Verified meaning | Calculation implication |
| --- | --- | --- |
| VII Section 4(a)(1), pp. 211-212 | Team Salary includes active-player salaries and applicable former-player salaries. Waived-contract salary remains included, with allocation changed when the team elects a qualifying written stretch treatment. | Retained release charges are relevant, but their existence does not prove CBA-compliant allocation or a complete baseline. Preserve the allocation and its basis by salary-cap year. |
| VII Section 4(a)(1)(iii), pp. 212-216 | Compensation grievance awards and settlements affect Team Salary. The current/future-year dispute rule initially includes 50% of the disputed amount and adjusts after resolution; other timing cases are separately addressed. | Apron adjustment (iii) is not another ordinary release charge. Need dispute amounts, affected seasons, resolution, and amounts already included. Do not apply a blanket 50% formula to every case. |
| VII Section 2(d)(1)(i)(F), pp. 180-181 | For the specified zero-/one-service-year free-agent Standard NBA Contracts, the relevant amount is the positive difference between the two-year-service minimum and attributed contract salary. Termination can require proration; specified Two-Way conversions and 10-day transitions are included. | Service years alone do not establish the adjustment. Contract origin, salary attribution, applicable minimum scale, dates, and conversion/termination facts are required. |
| VII Section 3(d), pp. 207-208 | Performance-bonus inclusion in Salary generally depends on the prior-season performance test, with exceptions and dispute procedures. | Apron Salary adds excluded performance bonuses, not bonuses already included in the baseline. A contract salary plus unclassified notes does not prove the correct total. |
| VII Section 4(a)(2)-(8), pp. 216-217 | Team Salary includes specified free-agent/QO/notice amounts, outstanding offer sheets, unsigned first-round pick amounts, incomplete-roster holds, exception amounts, and other specified additions. | Baseline components must be identified before apron-specific deductions or replacements. A roster payroll sum is not a substitute. |
| VII Section 4(d), pp. 217-219 | Free Agent Amounts vary by veteran free-agent classification, prior salary and other conditions, with minimum/maximum constraints. | The apron deduction cannot be computed from an undifferentiated count of free agents or from a single arbitrary hold. |
| VII Section 4(e)(1), p. 219 | An unsigned first-round pick ordinarily enters Team Salary at 120% of the applicable Rookie Scale Amount, subject to the following exceptions. | Apron adjustment (vi) removes the specified unsigned-pick amount; (vii) adds the outstanding Required Tender amount. A future tradeable draft pick is not itself evidence of either amount. |
| VII Section 4(f), pp. 220-221 | Between July 1 and the day before the regular season begins, a qualifying count below 12 creates an incomplete-roster hold: missing places times the zero-service-year minimum. Its player count includes specified free agents, offer sheets, and unsigned first-round picks. | This is not simply 12 minus active roster size. Apron adjustment (x) removes this hold when it was included in the baseline. |
| VII Section 4(l), p. 225 | From July 1 through July 30, a contract signed pursuant to the Second Round Pick Exception is excluded from Team Salary until July 31, subject to Article II, Section 15. | Apron adjustment (ix) adds back that temporarily excluded salary. This is a date- and exception-specific adjustment, not a general salary exclusion. |

The researcher also identified a legacy-contract qualification in VII Section 3(j), p. 211. Its scope must be checked when classifying contracts entered before the CBA effective date; do not infer the applicable salary-determination rule from the calculation season alone.

### Consequence for real-world input evidence

Two distinct evidence packages are needed:

1. **Restriction evidence:** team, salary-cap year, explicit status, trigger and date, including any following-year effect or permitted MLE reclassification. A restricted team's known trigger does not prove that every other independent trigger is absent.
2. **Amount evidence:** season/team-scoped salary components, applicable adjustments, and their completeness. A source that lists first-/second-apron status does not necessarily supply complete Apron Team Salary.

For a real-world exact calculation, missing bonus, grievance, tender, offer, or applicability data is not automatically zero. For an authored fictional dataset, those components may be explicitly defined as absent, provided the scenario is identified as authored rather than factual NBA history.

## Initial team evidence: source comparison

Public pages were inspected on **2026-11-10**. The date of retrieval is not an assertion that their contents describe a particular earlier simulation date. No team-status dataset was imported or accepted as authoritative.

| Candidate | Observed evidence | Acceptance limitation |
| --- | --- | --- |
| [Hoops Rumors 2026/27 tracker](https://www.hoopsrumors.com/2026/07/nba-teams-with-hard-caps-for-2026-27.html) | Explicitly lists all 30 teams: 21 first-apron, 4 second-apron, and 5 under an explicit "No hard cap" heading. Lists triggering operations for restricted teams and the official 2026-27 apron amounts. Parent read the page directly. | A secondary live tracker, not a frozen historical record. It displays July 10, 2026 publication metadata while saying it will be updated throughout the year; comments show corrections after publication. No complete transaction-by-transaction corroboration was performed. |
| [Sports Business Classroom 2026-27 tracker](https://sportsbusinessclassroom.com/nba-2026-27-apron-tracker/) | Researcher observed 19 first-apron, 9 second-apron, and 2 unrestricted teams. Its body used the prior season's apron amounts, $195.945m/$207.824m, despite the 2026-27 heading. | Material disagreement with Hoops Rumors and an internal season/amount inconsistency. Not accepted as corroboration until reconciled. |
| [Spotrac 2026-27 apron tracker](https://www.spotrac.com/nba/apron/_/year/2026) | Provides apron/payroll context. | Retrieved text did not establish auditable per-team triggering operations. Missing or blank rendered indicators are not proof of `none`. |
| [NBA official 2026-27 announcement](https://www.nba.com/news/nba-salary-cap-2026-27-season) | Authoritative league thresholds, effective July 1, 2026. | Does not establish individual teams' active restrictions. |

Examples of the source conflict: Hoops Rumors lists Boston at the first apron and Houston at the second, while the inspected SBC classification differs. These are conflicting source claims, not accepted team states. Payroll below an apron cannot resolve the disagreement.

### User-selected start scenarios

Product direction confirmed on 2026-11-10: offer both "Comenzar hoy" and "Comenzar al inicio de la temporada". The selected mode determines the initial scenario; there is no single universal cutoff for all new games. This is design approval, not implementation authorization.

| Requested mode | Scenario requirement | Financial evidence implication |
| --- | --- | --- |
| "Comenzar al inicio de la temporada" | A fixed, versioned snapshot at 00:00 America/New_York on each season's official NBA opening date, approved on 2026-11-11. For 2026-27: October 20, not October 15 or the team's first game. | Use rosters, contracts, retained charges, and restrictions effective at that boundary, including relevant prior-year carry-forward. Never attach a current tracker list to an earlier calendar date. |
| "Comenzar hoy" | A snapshot representing the selected current real-world date, with an explicit cutoff and data freshness. | Financial restrictions and salary components must reflect operations through that cutoff. A last-known older snapshot is not silently equivalent to today's data. |

Both modes use the same rules and game-owned transaction engine. Once initialized, a save diverges from the real world; subsequent provider updates must not rewrite it. A fictional scenario supplies authored rather than imported initial facts; it is not a hidden fallback for missing NBA history.

The design should identify the selected mode, scenario version, simulation date, and actual evidence cutoff separately. If no suitable snapshot exists, retain the approved operation-scoped uncertainty policy where usable game data exists, and report any scenario-level unavailability explicitly. Do not promise exact current or historical coverage from the mere presence of a date selector.

**Current UI boundary:** `src/components/games/CreateGameForm.tsx:86-92` passes the selected era's fixed `initialSimulationDate`; its era selector is at lines 141-175. `src/application/hooks/games/useCreateGame.ts:71-75` refreshes modern rosters without a start-mode argument. These inspected paths do not implement the two requested scenario modes. A changed calendar date alone would not supply a historical or current snapshot.

Nonfinancial scenario alignment (for example, completed games and standings for a start-today scenario) is a related design dependency, not something implemented or verified by this hard-cap investigation.

### Proposed evidence admission rules

- Establish the effective date/cutoff for the selected start mode and match roster, contracts, restrictions, and financial components to that same scenario. `useCreateGame` accepts `simulationDate` and refreshes modern rosters (`src/application/hooks/games/useCreateGame.ts:9-15,60-75`); this alone does not establish alignment of all imported inputs.
- Store source URL, retrieval date, effective date, season, team, supported assertion, and corroboration/conflict status. A publication timestamp is not a substitute for an effective date.
- Use secondary trackers as leads for a manually checked initial snapshot. Confirm triggering operations and relevant exception treatment; a signing announcement alone may not establish which exception was used.
- Accept `none` only when evidence explicitly supports absence of applicable restrictions at the scenario cutoff, including relevant prior-year transactions. Do not infer it from omission or a salary total.
- Mark unresolved team assertions `unknown`; mark unresolved salary calculations incomplete. Preserve each uncertainty independently under the approved operation-scoped policy.
- Do not silently choose one tracker by majority vote, current payroll, or apparent freshness. Do not use a live current list as a past-season-start snapshot without dated corroboration.
- Once initialized, a game evolves from its saved state. Later real-world transactions or tracker corrections are not automatically applied to that game's history. A provider outage does not erase accepted data.

**Current conclusion:** official league thresholds and the CBA rules have primary-source evidence. Initial per-team status and exact salary inputs still lack an accepted, date-aligned complete dataset. The inspected trackers improve coverage but do not close that gap.

## Approved playable-realism boundary and session handoff

Confirmed by the user on 2026-11-10. The objective is a coherent, playable approximation of the NBA, not complete real-world equivalence. Separate imported facts, explicitly authored scenario assumptions, and the game's rules. The same rules should support real and fictional teams; complete NBA data is not a prerequisite for authoring a fictional scenario.

- **Unreported bonuses are absent in the game scenario.** Their absence must not block operations. This is an approved simulation assumption, not evidence that the actual contracts contain no bonuses. Preserve known bonuses and avoid counting amounts already included in published salary twice.
- This narrowly qualifies the earlier missing-input policy for unreported bonuses. It does not authorize inventing hard-cap status, treating other unknown financial amounts as zero, or resolving conflicting trackers arbitrarily. Other consequential missing financial proof remains subject to the operation-scoped policy.
- Non-crucial details may be completed through disclosed, consistent scenario assumptions. Specific defaults beyond unreported bonuses remain to be designed; this is not blanket permission to fabricate NBA history.
- Keep a coherent effective cutoff and freeze the selected scenario version when creating a game. Later real-world movements do not update existing saves.

### Basketball Reference follow-up

Public pages inspected on 2026-11-10:

| Source | Verified contribution | Remaining limitation |
| --- | --- | --- |
| [Boston payroll](https://www.basketball-reference.com/contracts/BOS.html) | Seasonal salaries, options and guarantees; explicitly says salaries are updated monthly. | Site-wide last-update metadata does not establish financial coverage through a daily cutoff. |
| [Boston 2026-27 transactions](https://www.basketball-reference.com/teams/BOS/2027_transactions.html) | Dated moves; explicitly says current-season transactions are updated regularly, but not daily. Robinson's July 6 signing is listed as multiyear. | That entry does not identify NTMLE use; a matching salary amount is not proof of exception use. No all-team completeness audit was performed. |
| [Boston schedule/results](https://www.basketball-reference.com/teams/BOS/2027_games.html) | Dates, ET start times, scores, cumulative records and NBA Cup markers. | Exact cutoff treatment, postponements and league-wide coverage still need validation. |
| [Salary cap history](https://www.basketball-reference.com/contracts/salary-cap-history.html) | User-provided screenshot shows Year, Salary Cap and inflation-adjusted 2025 Dollars; 1998-99 nominal cap is $30,000,000. | Automated text retrieval did not expose table rows. Use nominal Salary Cap, not inflation-adjusted dollars; historical apron and team restrictions need separate evidence. |
| [1998-99 season](https://www.basketball-reference.com/leagues/NBA_1999.html) | User supplied this destination from the history table. | Not independently inspected in this follow-up; a season page alone does not establish an opening-day snapshot. |
| [Historical standings](https://www.basketball-reference.com/friv/standings.fcgi) | Linked by Basketball Reference as standings for historical dates. | Tool output and whether the selected day is inclusive remain unverified. |

The [official October 20 opening-rosters article](https://www.nba.com/news/nba-rosters-set-for-2026-27-regular-season) was read directly: it links live team roster pages rather than embedding frozen player lists. Its publication date does not establish historical roster content.

## Boston pilot: opening-cutoff reconciliation

Research observed on **2026-11-11–2026-11-12**. The approved cutoff is **2026-10-20T00:00:00-04:00 (2026-10-20T04:00:00Z)**. Use the official league opening date separately for each season. The exact cutoff for "Comenzar hoy" remains unapproved. These decisions supersede earlier proposals in this record; they do not authorize implementation.

**Outcome:** historical evidence supports the candidate roster and the 14 standard salary rows. First-apron restriction evidence includes reporting outside Hoops Rumors. The November 12 follow-up found individual reports of zero guarantees for all six camp cuts, expired legacy stretch allocations, and an explicit CBA exclusion for Exhibit 10 affiliation bonuses. A complete cutoff-specific retained-charge ledger and Apron Team Salary are still not established; the reported guarantees are not a blanket zero-charge assumption.

### Existing pilot and acquisition provenance

Prior explicitly authorized TEST observations, retained in Engram #3339, concern game `1e8ee51f-4d50-4a81-abed-b1df88b83756`: active Boston modern game, created November 11, with simulation date October 15. Its roster matched 14 standard players plus three two-way players; its 14 standard salary rows totaled **$198,722,406**. Salary snapshots were observed November 11, not October 20. The pilot remains unchanged; its calendar date is not evidence of historical coverage.

The creation flow uses current ESPN rosters, Basketball Reference contract snapshots, and NBA G League two-way classification, not `nba_api` roster acquisition (Engram #3328 and #3339). Williams, Mitchell, and Carter are intentionally excluded from the standard-salary subtotal; missing standard agreement rows for those players are not three missing standard contracts. This research pass did not access TEST.

### Evidence matrix

Publication, archive capture, observation, and effective dates are distinct. An archived page preserves a source version, not an independent financial source or automatic proof of continuity through the cutoff.

| Component | Evidence and source | Date and scope | Conflict or missing proof | Verdict |
| --- | --- | --- | --- | --- |
| Opening roster | [October 20 SI season guide](https://www.si.com/nba/celtics/onsi/2026-27-boston-celtics-season-guide-roster-schedule-storylines-and-key-dates-01m5cry2stzs), dated [B-Ref transactions](https://www.basketball-reference.com/teams/BOS/2027_transactions.html), and prior official two-way evidence. | Opening-day secondary list; transaction log observed November 11. | NBA's opening-rosters article links live roster pages. Publication on October 20 alone does not prove midnight state; the log is updated regularly, not daily. | Candidate 14 standard + 3 two-way composition supported; exact-cutoff completeness not independently certified. |
| Williams / Mitchell | B-Ref records Amari Williams's two-way signing July 1 and Dillon Mitchell's August 5; prior NBA G League classification agrees. | Both dated before cutoff. | Current classification alone would not prove history; dated signings supply historical support. | Two-way classification supported at cutoff. |
| Carter / camp cuts | B-Ref dates Carter's two-way signing and four cuts October 17; [official Celtics release](https://celtics.com/news/press-release-20261018-celtics-convert-devin-carter-to-two-way-contract) announces conversion and cuts of DeVries, McGlothan, Gray, and Uzan, not Grill. | Official publication October 18, 09:00 EDT, says "today"; re-read November 12. Carter previously signed an Exhibit 10 on September 14. | Exact effective day October 17/18 unresolved, but both precede cutoff. An earlier conversational summary incorrectly included Grill among these cuts. | Carter's pre-cutoff two-way status supported; preserve date discrepancy and corrected cut identities. |
| Standard salary rows | [B-Ref archive](https://web.archive.org/web/20260902075646/https://www.basketball-reference.com/contracts/BOS.html) contains the same 14 current-season amounts as the observed November table. | Archive capture September 2, 07:56:46 UTC; not a cutoff-day ledger. | Continuity and applicable financial adjustments still require reconciliation. | Historical support for all 14 amounts, not full Apron Team Salary. |
| Historical subtotal | [Celtics Crew article](https://web.archive.org/web/20261010155839/https://www.celticscrew.com/news/tatum-george-cap-sheet) reports $198,722,406. | Published October 7; captured October 10, 15:58:39 UTC. | Secondary source without itemized retained charges or demonstrated independent salary sourcing. | Matching subtotal existed before cutoff, not merely in November observations. |
| George trade bonus | [Original Bobby Marks report](https://x.com/BobbyMarks42/status/2074223755321053584): "Paul George waived his $3.9M trade bonus, sources tell ESPN. His cap hit in Boston remains at $54.1M and $56.6M (P)". [Boston.com](https://www.boston.com/sports/boston-celtics/2026/07/06/celtics-paul-george-trade-bonus-report-comments/) and [B/R](https://bleacherreport.com/articles/25451826-paul-george-reportedly-waives-trade-bonus-updated-celtics-salary-cap-after-jaylen-brown-split) cite that report. | Report and articles dated July 6; original post retrieved November 11. Precise waiver execution time not established. | All repetitions share Marks as the source, not independent confirmations. No contract instrument inspected. Exact $54,126,380 comes from B-Ref; Marks rounds to $54.1m. | Waiver provenance closed at reported-fact level; not an authored zero or reliance on the unreported-bonus assumption. |
| Retained / stretched charges | [July 9 Banton report](https://www.hoopsrumors.com/2026/07/celtics-to-waive-dalano-banton.html) describes non-guaranteed salary and no cap hit. Current [Capsheets](https://www.capsheets.com/boston-celtics-cap-sheet-2026-2027-season/) displays "Dead Money" as a dash. The November 12 matrices below add individual guarantee reports and legacy allocation end dates. | Banton report concerns his July 9 waiver; Capsheets observed November 11 with no demonstrated cutoff-specific timestamp. New individual records observed November 12. | Banton evidence covers him only. Individual guarantees now have reported figures, but no complete cutoff-specific charge ledger was obtained. | Improved individual evidence; no global zero accepted. |
| Hard-cap trigger | [HR tracker](https://www.hoopsrumors.com/2026/07/nba-teams-with-hard-caps-for-2026-27.html) explicitly identifies Robinson's NTMLE. [CLNS / Bobby Manning](https://www.clnsmedia.com/celtics-sign-mitchell-robinson-and-mike-conley-to-begin-free-agency/) reports MLE, a three-year deal starting above $15m, and first-apron hard cap. [Archived Crew explanation](https://web.archive.org/web/20261010155830/https://www.celticscrew.com/news/hard-cap-explained) explicitly identifies full NTMLE. | CLNS published July 1 (reported agreement, not formal execution); Crew published October 6, captured October 10. [NBA signing coverage](https://www.nba.com/news/mitchell-robinson-celtics-free-agency-2026) confirms official July 6 signing and reported three-year deal. | NBA does not identify exception use. Separate publications do not prove independent underlying reporting. HR is live despite July 10 publication date; prior SBC conflict is not resolved by majority vote. | First-apron restriction supported by dated secondary reporting plus official signing evidence; not a primary exception-accounting record. |
| Apron Team Salary / room | Official first apron $209,015,000; current Capsheets lists salaries and Apron Total at $198,722,406. | League threshold effective July 1; live team table observed November 11. | Retained charges and applicable adjustments at cutoff remain unclosed. Capsheets also lists $9,269,074 of free-agent holds separately; do not blindly add them to apron salary. | Exact cutoff Apron Team Salary unavailable. $10,292,594 is an arithmetic difference, not proven legal spending room. |
| Cutoff-to-observation changes | Reviewed transaction log ends with October 17 entries. | Comparison interval October 20–November 11. | No complete dated daily financial ledger; absence of later entries is not proof of no changes. | No identified standard-row change, but complete historical continuity remains unproven. |

Candidate standard roster: Jayson Tatum, Paul George, Derrick White, Mitchell Robinson, Sam Hauser, Payton Pritchard, Ron Harper Jr., Chris Cenac Jr., Hugo González, Luka Garza, Baylor Scheierman, Neemias Queta, Mike Conley, and Jordan Walsh. Two-way group: Amari Williams, Dillon Mitchell, and Devin Carter.

The September B-Ref archive totals **$201,437,932**, including Uzan and DeVries at **$1,357,763 each**. Subtracting those two rows yields $198,722,406. This reconciles the table difference, not their retained charges after waiver. Its italic notation means **not fully guaranteed**, not necessarily zero guaranteed salary.

Do not use the Crew articles' simplified payroll or training-camp explanations as CBA accounting authority. The Yahoo/MassLive July 1 Robinson article exposed metadata but not usable body text; its search snippet was not admitted as full-text corroboration. Public Spotrac retrieval did not establish a complete cutoff-specific ledger.

### November 12 follow-up: reported camp-cut guarantees

All SalarySwish records below were observed on **2026-11-12**. Their publication/update dates are unspecified; no historical archive capture was established. These are explicit retrospective contract records, not current team-total matches. Each reports **Guaranteed: $0 (0%)**. That supports an individual reported guarantee, not certification of every possible retained charge at the cutoff.

| Player / source | Effective dates reported | Amount or applicability | Conflicts / missing proof | Verdict |
| --- | --- | --- | --- | --- |
| [Tucker DeVries](https://www.salaryswish.com/players/tucker-devries) | Waived October 17; January 10 guarantee condition marked unmet. | $0 guaranteed. | No dated historical guarantee schedule or contract instrument retrieved. | Individual zero guarantee reported; total retained charge not certified. |
| [Milos Uzan](https://www.salaryswish.com/players/milos-uzan) | Signed July 14; waived October 17; [transaction history](https://www.salaryswish.com/transactions/players/milos-uzan) records clearance October 19. | $1,357,763 contract; $0 guaranteed; January 10 condition unmet; $91,000 Exhibit 10 bonus listed. Parent directly read the player record. | [Houston Athletics, June 25](https://uhcougars.com/news/2026/6/25/mens-basketball-milos-uzan-signs-with-boston-celtics), describes a non-guaranteed Exhibit 10 deal. An earlier announcement does not establish the execution date. No preserved historical terms retrieved. | Stronger individual reporting, not a complete cutoff accounting record. |
| [Hayden Gray](https://www.salaryswish.com/players/hayden-gray) | Waived October 17; January 10 condition unmet. | $0 guaranteed; displayed salary/cap figures around $2,185,116; page reports one year of service. | Salary/service fields not independently reconciled; no historical guarantee instrument. | Record the reported guarantee separately from unverified salary fields. |
| [Gabe McGlothan](https://www.salaryswish.com/players/gabe-mcglothan) | Waived October 17; January 10 condition unmet. | $0 guaranteed; page reports one year of service. | Contract value $2,185,128 differs from cap hit $2,185,116; no historical guarantee instrument. | Zero guarantee reported; salary-field discrepancy unresolved. |
| [Caleb Grill](https://www.salaryswish.com/players/caleb-grill) | Player page: waived September 15. [Transaction history](https://www.salaryswish.com/transactions/players/caleb-grill): signed/placed on waivers September 14, cleared September 16. | $0 guaranteed. | Internal date inconsistency; no second Boston contract found. Neither the official October release nor the October 17 report lists him among those four cuts. | Zero guarantee reported; do not claim an exact waiver date from this record. |
| [Hank Morgan](https://www.salaryswish.com/players/hank-morgan) | Signed and waived September 11. | $0 guaranteed. | [Hoops Rumors, September 11](https://www.hoopsrumors.com/2026/09/celtics-sign-waive-hank-morgan.html), calls Exhibit 10 status "almost certainly", not confirmed individual terms. | Zero guarantee reported; independent historical terms unavailable. |

The [October 17 Hoops Rumors report](https://www.hoopsrumors.com/2026/10/celtics-waive-four-camp-invitees.html) names Gray, Uzan, McGlothan, and DeVries, agreeing with the official October 18 release. It reports conditional $91,000 affiliate bonuses, not retained guaranteed salaries. A bounded Wayback CDX request for the six player records timed out: historical capture availability remains **undetermined**, not absent. Spotrac historical financial detail was not accessible through the public retrieval; no login or paywall bypass was attempted.

### Legacy allocations and Exhibit 10 treatment

Public records below were observed **2026-11-12**. Undated live histories can support an explicit historical allocation, but their omissions do not establish a complete zero-charge ledger.

| Component / source and publication | Effective amount or period | Conflict / missing proof | Verdict |
| --- | --- | --- | --- |
| Demetrius Jackson: [SalarySwish history](https://www.salaryswish.com/players/demetrius-jackson), undated; [CelticsBlog, July 15, 2017](https://www.celticsblog.com/2017/7/15/15976904/sources-boston-celtics-to-waive-point-guard-demetrius-jackson-semi-ojeleye). | $650,000 stretch over seven seasons, 2017-18 through 2023-24. Parent directly verified the allocation's final season. | Does not exclude other Boston obligations. | This allocation does not continue into 2026-27. |
| Guerschon Yabusele: [SalarySwish history](https://www.salaryswish.com/players/guerschon-yabusele), undated; [Boston Sports Journal, July 16, 2019](https://www.bostonsportsjournal.com/2019/07/16/roster-reset-implications-celtics-stretching-guerschon-yabusele-final-open-roster-spot). | $3,117,240 stretched across 2019-20 through 2021-22. | Does not exclude other Boston obligations. | This allocation does not continue into 2026-27. |
| JD Davison: [Hoops Rumors, July 24, 2025](https://www.hoopsrumors.com/2025/07/celtics-release-jd-davison.html). | Boston's 2025-26 option reported fully non-guaranteed. | No comprehensive subsequent Boston liability record retrieved. | No Boston 2026-27 carryover established; not a global absence finding. |
| Justin Champagnie / other potential legacy obligations. | No continuing 2026-27 allocation established in the bounded search. | Complete historical waived-contract, settlement, and stretch inventory unavailable. | Unresolved, not an authored zero. |
| [Capmath Boston table](https://capmath.com/nba/team/bos), publication unspecified. | Current text attributes approximately $2.8m of dead money to Banton. | Conflicts with the contemporaneous July 9 no-cap-hit report; no historical cutoff binding. | Amount not admitted and not evidence of prior-season carryover. |

The official 2023 CBA PDF was retrieved and text-extracted **in memory**, without saving research files. The following are printed-page citations:

| Rule | Verified text or meaning | Reconciliation consequence |
| --- | --- | --- |
| Article VII, Section 4(k), p. 225 | "Any amounts earned by a player pursuant to an Exhibit 10 Bonus shall be excluded from Team Salary." | Do not classify the affiliate bonus as retained guaranteed salary. |
| Article VII, Section 2(e)(1)(i), p. 186 | Apron Team Salary adds Performance Bonuses excluded under Section 3(d). | This is not an automatic addback of the separately excluded Exhibit 10 affiliate bonus. |
| Article II, Section 3(s)(i), pp. 22-24 | Exhibit 10 bonus eligibility requires pre-opening termination and specified NBAGL participation/service conditions, with stated qualifications. | Eligibility does not establish payment or fulfillment. This known bonus is not erased by the unreported-bonus assumption. |

Reconcile without duplication: retain the $198,722,406 active-standard subtotal; investigate any retained obligations separately instead of retaining Uzan's and DeVries's full active rows; do not carry the expired Jackson/Yabusele allocations into 2026-27; and do not add excluded Exhibit 10 bonuses or subtract them from a baseline that never included them. Remaining applicable apron adjustments are not implicitly zero. The $10,292,594 threshold difference remains arithmetic, not accredited legal room.

**Handoff decision, November 12:** the user requested documentation, memory preservation, and a documentation commit before giving the next direction. Pause additional research here. This does not approve new financial defaults, certify a complete snapshot, or authorize implementation or TEST access. Engram #3402 and #3403 preserve the research findings and recovery context.

### `nba_api`: bounded utility, not historical admission

Read upstream [`docs/ai_agents.md`](https://github.com/swar/nba_api/blob/master/docs/ai_agents.md) before inspecting [`CommonTeamRoster`](https://github.com/swar/nba_api/blob/master/src/nba_api/stats/endpoints/commonteamroster.py). The constructor sends TeamID, Season, and LeagueID; no as-of date filter exists. Its roster output has identities and biographical fields, not membership dates, contract classification, salaries, or hard-cap triggers. The documentation does not guarantee that `season` means opening-day membership. Use it for identity/roster cross-checks, not cutoff certification. No endpoint was executed or package installed.

### Proposed component admission and next-session entry point

Keep roster, active salaries, retained charges, and restriction knowledge independently assessable. For each assertion preserve source URL, publication, capture/observation, effective date or interval, and unresolved conflicts. A supported roster does not make the financial calculation complete. Unreported bonuses remain absent only by the approved scenario assumption; do not extend that assumption to other financial inputs. No component-admission implementation was authorized.

Further work awaits the user's next direction. The following items are preserved as open questions, not instructions to continue researching now. No implementation, schema changes, existing-game backfill, or TEST access is authorized.

1. Decide how to use the newly reported individual guarantees and bounded legacy findings in the playable scenario. Any further historical-ledger research or additional scenario assumptions require the next direction; no global zero has been adopted.
2. Reconcile admitted active salaries, retained charges, and applicable apron adjustments without double counting. George's waiver now has traceable reporting; reopen only if contradictory evidence appears.
3. Close the component matrix with supported facts, disclosed scenario assumptions, and missing proof separately. Do not certify a complete opening snapshot or spending margin while the calculation is incomplete.
4. Keep start-today cutoff/freshness and historical standings semantics as separate unresolved design work. Reconcile results and standings from the same included games, including games in progress at midnight.
5. Broader team validation, remaining financial rules, further authored simplifications, and source-rights review remain open. Boston's progress does not validate all 30 teams or resolve SBC's inconsistent season amounts.

## Open work before implementation

- Complete implementation-level salary/eligibility design and resolve the remaining season-rollover evidence gap; the static operation mapping above is not runtime verification.
- Finish transaction-specific computation cases and exception eligibility, including grievance allocation variants, contract-era classification, and referenced exemptions. Sections 4(a)(1)(iii) and 4(l) now have identified primary-source meanings, but this remains short of a complete numeric validator.
- Apply the approved official-opening-date midnight boundary for each season; define start-today cutoff/freshness separately. Validate dated datasets and reconcile tracker conflicts; no complete candidate financial dataset has been accepted. Do not infer `none` from omission in a list.
- Define user-facing diagnostics and pending-offer outcomes for the approved operation-scoped uncertainty policy; any existing-game backfill still requires a separate design.
- Define the authored fictional dataset and offline fallback scope separately from NBA imports.
- Review source access and redistribution terms before publishing real-world datasets or assets.

This documentation update performed no code, schema, or TEST operation. Prior authorized pilot observations are explicitly identified above and were not repeated. Saving this document does not authorize implementation, existing-game correction, or further TEST access.
