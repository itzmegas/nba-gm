# NBA Business Rules — "The Association" GM Simulator

> **Purpose**: This document is the single source of truth for all NBA Collective Bargaining Agreement (CBA) rules that govern the simulator's game engine. Each section describes the real-world rule, the relevant numbers, and a fidelity note indicating whether the simulator implements the rule at **[FULL]**, **[SIMPLIFIED]**, or **[DEFERRED]** fidelity.
>
> **Reference CBA**: 2023 CBA (effective through 2029-30 season). Dollar amounts reflect the **2024-25 season** unless noted otherwise.
>
> **How the simulator uses this**: The domain layer (`src/domain`) encodes these rules as pure TypeScript logic. The `SalaryCapCalculator` domain service, the `ValidateTrade` use case, and future free-agency/draft engines all derive their behavior from the rules documented here.

---

## Table of Contents

1. [Salary Cap System](#1-salary-cap-system)
2. [Cap Exceptions](#2-cap-exceptions)
3. [Contracts](#3-contracts)
4. [Trades](#4-trades)
5. [Free Agency](#5-free-agency)
6. [Draft](#6-draft)
7. [Roster Rules](#7-roster-rules)
8. [Season Structure](#8-season-structure)
9. [Simulator Fidelity Summary](#9-simulator-fidelity-summary)

---

## 1. Salary Cap System

The NBA operates under a **soft salary cap**, meaning teams CAN exceed the cap through specific exceptions (unlike the NFL or NHL hard caps). However, exceeding certain thresholds triggers escalating financial penalties.

### 1.1 Salary Cap

| Parameter | 2024-25 Value |
|---|---|
| **Salary Cap** | $140.588M |
| **Luxury Tax Line** | ~$170.814M |
| **First Tax Apron** | ~$178.132M |
| **Second Tax Apron** | ~$188.931M |
| **Salary Floor** | $126.529M (90% of cap) |

The cap is calculated as a percentage of **Basketball Related Income (BRI)** from the prior season. For simulation purposes, the cap grows approximately 8-10% per season.

**Salary Floor**: Teams whose total salaries fall below 90% of the cap must pay the difference to their players. This prevents owners from fielding a poverty roster.

### 1.2 Luxury Tax

Teams whose total payroll exceeds the Luxury Tax line pay a progressive, dollar-for-dollar penalty. The 2023 CBA introduced steeper rates and a **repeat offender** designation for teams that paid the tax in 3 of the previous 4 seasons.

#### Tax Rate Table

| Amount Over Tax Line | Standard Rate | Repeat Offender Rate |
|---|---|---|
| $0 – $5M | $1.50 per dollar | $2.50 per dollar |
| $5M – $10M | $1.75 per dollar | $2.75 per dollar |
| $10M – $15M | $2.50 per dollar | $3.50 per dollar |
| $15M – $20M | $3.25 per dollar | $4.25 per dollar |
| Each additional $5M | $3.75 + $0.50 per bracket | $4.75 + $0.50 per bracket |

**Example**: A standard taxpayer who is $12M over the line pays:
- First $5M × $1.50 = $7.50M
- Next $5M × $1.75 = $8.75M
- Next $2M × $2.50 = $5.00M
- **Total tax bill: $21.25M**

#### Formula (Pseudo-code)

```
function calculateLuxuryTax(totalSalary, taxLine, isRepeatOffender):
  overage = totalSalary - taxLine
  if overage <= 0: return 0

  tax = 0
  brackets = [5M, 5M, 5M, 5M, ...]  // each $5M bracket
  standardRates = [1.50, 1.75, 2.50, 3.25, 3.75, 4.25, 4.75, ...]
  repeatRates   = [2.50, 2.75, 3.50, 4.25, 4.75, 5.25, 5.75, ...]

  rates = isRepeatOffender ? repeatRates : standardRates

  for each bracket:
    taxable = min(overage, bracketSize)
    tax += taxable * rates[bracketIndex]
    overage -= taxable
    if overage <= 0: break

  return tax
```

### 1.3 Tax Aprons

The 2023 CBA introduced two "aprons" above the tax line that impose increasingly severe roster-building restrictions.

#### First Tax Apron (~$178.132M)

Teams above this line lose access to:
- The full (non-taxpayer) Mid-Level Exception
- The Bi-Annual Exception

They may still use the **Taxpayer MLE** (~$5.2M).

#### Second Tax Apron (~$188.931M)

Teams above this threshold face the harshest restrictions in the NBA:

| Restriction | Description |
|---|---|
| No MLE usage | Cannot use the standard or taxpayer MLE |
| No sign-and-trade acquisitions | Cannot be the receiving team in a sign-and-trade |
| No buyout player signings | Cannot sign players bought out after the trade deadline |
| Restricted cash in trades | Cannot send cash considerations in trades |
| Salary matching | Cannot take back more salary than they send in any trade |
| Draft pick trading limited | Can only trade picks up to 6 years out (instead of 7) |
| No aggregation | Cannot aggregate salaries in trades to match an incoming player |

---

## 2. Cap Exceptions

These are the legal mechanisms that allow teams to exceed the salary cap. Without them, teams above the cap could only sign minimum-salary players.

### 2.1 Mid-Level Exception (MLE)

| Variant | Amount (2024-25) | Max Years | Eligibility |
|---|---|---|---|
| Non-Taxpayer MLE | ~$12.4M | 4 years | Teams below the first apron |
| Taxpayer MLE | ~$5.2M | 2 years | Teams above tax line but below second apron |
| Room MLE | ~$7.7M | 2 years | Teams with cap room (used after room is spent) |

The MLE is a team's primary tool for adding talent when they're over the cap. It can be split across multiple players.

### 2.2 Bi-Annual Exception (BAE)

| Amount | Max Years | Eligibility |
|---|---|---|
| ~$4.5M | 2 years | Teams below the first apron; cannot use in consecutive seasons |

### 2.3 Bird Rights Exceptions

These exceptions allow teams to re-sign their own players above the cap. Named after Larry Bird, who was the first player whose team invoked this rule.

| Exception | Tenure Required | Max Salary Offer |
|---|---|---|
| **Full Bird** | 3+ years with team | Up to the player's individual max (25/30/35% of cap) |
| **Early Bird** | 2+ years with team | Greater of 175% of previous salary OR league average salary |
| **Non-Bird** | Any tenure | Greater of 120% of previous salary OR the minimum salary |

**Key detail**: Bird rights follow a player through trades. If a player has 3+ years of service and is traded, his new team inherits his Bird rights.

### 2.4 Rookie Exception

Draft picks are signed to **Rookie Scale Contracts** with predetermined salaries set by the CBA. These are slotted by draft position and don't count against the cap in the same way as free agent signings.

### 2.5 Traded Player Exception (TPE)

When a team trades away a player without receiving equal salary back, the difference creates a TPE. This exception:
- Allows the team to absorb a player making up to the difference in a future trade (within 1 year)
- Cannot be combined with other players' salaries
- Cannot be used in sign-and-trade deals
- Expires after 1 year if unused

**Example**: Team trades a player making $20M and receives a player making $8M. They get a $12M TPE, allowing them to absorb any player making $12M or less in a trade within the next year.

### 2.6 Disabled Player Exception (DPE)

If a player suffers a season-ending or career-ending injury, the team may apply for a DPE worth:
- **50% of the injured player's salary** (for season-ending injuries)
- Can be used to sign a free agent or acquire a player via trade

The league office must approve DPE applications.

### 2.7 Minimum Salary Exception

Always available. Every team can sign players to minimum salary contracts regardless of their cap situation. Veteran minimums scale by years of experience but only count against the cap at the lowest minimum amount (the league pays the difference).

| Years of Experience | Minimum Salary (approx.) |
|---|---|
| 0 (Rookie) | ~$1.12M |
| 1 | ~$1.90M |
| 2 | ~$2.09M |
| 3 | ~$2.24M |
| 5 | ~$2.47M |
| 10+ | ~$3.28M |

**Cap charge**: All minimum contracts count against the cap at the 2-year veteran minimum (~$1.90M), regardless of actual salary. The league subsidizes the difference.

---

## 3. Contracts

### 3.1 Maximum Contract Lengths

| Scenario | Max Years |
|---|---|
| Re-signing with current team (Bird rights) | 5 years |
| Signing with a new team | 4 years |
| Sign-and-trade | 4 years |
| Rookie Scale Contract | 2 years guaranteed + 2 team options |
| Two-Way Contract | 2 years max |

### 3.2 Maximum Salary by Experience

Max salary is a percentage of the salary cap, based on years of NBA service:

| Years of Experience | Max Salary (% of cap) | 2024-25 Max |
|---|---|---|
| 0–6 years | 25% | ~$35.15M |
| 7–9 years | 30% | ~$42.18M |
| 10+ years | 35% | ~$49.21M |

### 3.3 Supermax (Designated Player Extension)

Eligible players can earn up to **35% of the cap regardless of experience**. Eligibility criteria (any one):
- Named to an All-NBA team in the prior season
- Won MVP in the prior 3 seasons
- Won DPOY in the prior 3 seasons

Teams can only have two designated player contracts active at once.

### 3.4 Annual Raises

| Scenario | Max Annual Raise |
|---|---|
| Re-signing with same team | 8% of Year 1 salary |
| Signing with new team | 5% of Year 1 salary |

Raises are calculated on the **first-year salary**, not compounding year-over-year.

### 3.5 Contract Options

| Option Type | Description |
|---|---|
| **Player Option (PO)** | Player can opt out and become a free agent |
| **Team Option (TO)** | Team can decline the option, releasing the player |
| **Early Termination Option (ETO)** | Player can terminate after a specified year (typically year 4 of a 5-year deal) |

Options can only be placed on the final year of a contract.

### 3.6 Guaranteed vs Non-Guaranteed Money

- Most NBA contracts are **fully guaranteed**
- Some contracts include **partial guarantees** (e.g., only $1M of a $5M salary is guaranteed)
- Non-guaranteed portions can be waived before the **guarantee date** (typically January 10)
- After the guarantee date, the full salary becomes guaranteed even if the player is waived

### 3.7 Signing Bonuses & Incentives

- **Signing bonuses**: Rare, cannot exceed 15% of the total contract value
- **Likely incentives**: Count against the cap immediately (based on prior year's performance)
- **Unlikely incentives**: Don't count against the cap until achieved

---

## 4. Trades

### 4.1 Salary Matching Rules

The core trade constraint: teams cannot take on vastly more salary than they send out. The rules differ based on the trading team's salary situation.

#### For Taxpaying Teams (above the tax line)

```
Incoming salary ≤ 125% of outgoing salary + $100,000
```

#### For Non-Taxpaying Teams (below the tax line)

The matching formula depends on the total outgoing salary:

| Outgoing Salary | Maximum Incoming Salary |
|---|---|
| $0 – $7.5M | 175% of outgoing + $100K |
| $7.5M – $29M | Outgoing + $5M |
| $29M+ | 125% of outgoing + $100K |

#### Teams Below the Cap

Teams with cap room can absorb players into their room without matching — they simply use available cap space. If the incoming salary exceeds their room, normal matching rules apply to the remainder.

#### Second Apron Teams

Teams above the second tax apron face the strictest rule:
```
Incoming salary ≤ Outgoing salary
```
They cannot take back more money than they send out. Period. No $100K buffer, no percentage cushion.

### 4.2 Salary Aggregation

- Multiple players on the same team can be **aggregated** (combined) to match a single incoming player's salary
- A single outgoing player CANNOT be split to match multiple incoming players from the same team
- Second apron teams **cannot aggregate** salaries

### 4.3 Draft Pick Trading

| Rule | Details |
|---|---|
| How far out | Up to 7 years (6 for second-apron teams) |
| **Stepien Rule** | A team MUST have a first-round pick in every other year. This prevents trading consecutive first-rounders |
| Pick swaps | Trading the right to swap picks in a given year counts as trading a pick for Stepien purposes |
| Pick protections | First-round picks can have conditional protections (e.g., "Top-10 protected" means the pick only conveys if it falls outside the top 10) |

### 4.4 Trade Restrictions

| Restriction | Rule |
|---|---|
| **Trade deadline** | February 5, 3:00 PM ET. No trades after this until the offseason |
| **Recently signed free agents** | Cannot be traded for 3 months after signing, or until December 15 (whichever is later) |
| **Recently acquired players** | Players received in a trade can be re-traded immediately, but their salary cannot be aggregated with other players for 60 days |
| **Cash considerations** | Max $5.95M per team per year |
| **No-trade clauses** | Players with 10+ years in the league and 4+ years with their current team can negotiate NTCs. Player must approve any trade |
| **Poison pill provision** | Certain extension structures create salary spikes that make matching difficult |

### 4.5 Trade Examples

**Example A — Non-taxpayer team**:
- Team A sends: Player making $15M
- Incoming allowed: $15M + $5M = **$20M** (using the $7.5M-$29M tier)

**Example B — Taxpayer team**:
- Team A sends: Player making $15M
- Incoming allowed: $15M × 125% + $100K = **$18.85M**

**Example C — Second apron team**:
- Team A sends: Player making $15M
- Incoming allowed: exactly **$15M** (dollar for dollar)

---

## 5. Free Agency

### 5.1 Free Agent Types

| Type | Abbreviation | Description |
|---|---|---|
| **Unrestricted Free Agent** | UFA | Player can sign with any team. No restrictions |
| **Restricted Free Agent** | RFA | Current team has the right to match any offer sheet within 2 business days |
| **Two-Way Free Agent** | — | Player on an expired two-way contract; unrestricted |

### 5.2 Restricted Free Agency (RFA)

1. Player receives a **qualifying offer** from his current team (typically 125% of previous salary for first-round picks, or the minimum for others)
2. Player can negotiate with other teams and sign an **offer sheet**
3. The original team has **2 business days** to match the offer sheet
4. If matched, the player stays; if not, the player goes to the new team
5. If the player signs the qualifying offer, he becomes a UFA the next year

### 5.3 Bird Rights

Bird rights determine what a team can offer its own free agents:

| Type | Tenure | Max Offer |
|---|---|---|
| Full Bird | 3+ years continuously on roster | Max salary, 5 years, 8% raises |
| Early Bird | 2+ years | Greater of 175% of prior salary or league average, 4 years |
| Non-Bird | Any tenure | Greater of 120% of prior salary or minimum, 4 years |

**Critical**: Bird rights follow a player through trades. They reset only if the player is waived or changes teams as a free agent.

### 5.4 Sign-and-Trade

Allows a team to facilitate the departure of a free agent while receiving compensation:

| Rule | Details |
|---|---|
| Contract length | Max 4 years (not 5) |
| Raises | Max 5% annually (not 8%) |
| Team receiving the player | Cannot be over the second apron |
| Team sending the player | Must have Bird rights on the player |
| Salary matching | Receiving team must comply with trade salary-matching rules |
| Resulting hard cap | The receiving team becomes hard-capped at the first apron for that season |

### 5.5 Free Agency Timeline

| Date | Event |
|---|---|
| **June 30** | Free agency moratorium begins. Teams can negotiate but NOT sign |
| **July 1–5** | Negotiation window. Verbal agreements made (not binding) |
| **July 6** | Moratorium ends. Signings become official |
| **October** | Training camp begins; contracts must be finalized |

### 5.6 Cap Holds

Until a free agent is renounced or re-signed, they occupy a **cap hold** — a placeholder salary that counts against the cap. This prevents teams from using the cap space to sign other players while retaining the ability to re-sign their own.

| Player Type | Cap Hold Amount |
|---|---|
| Full Bird rights (prior salary ≤ avg) | 150% of prior salary |
| Full Bird rights (prior salary > avg) | 190% of prior salary |
| Early Bird rights | 130% of prior salary |
| Non-Bird rights | 120% of prior salary |
| First-round draft pick | 120% of rookie scale |
| Second-round draft pick | League minimum |

**Renouncing**: A team can renounce a player's Bird rights to remove their cap hold, but permanently loses the ability to re-sign them using Bird exceptions.

---

## 6. Draft

### 6.1 Structure

- **2 rounds**, 30 picks each = **60 total picks**
- **Lottery** determines the top picks for non-playoff teams (bottom 14)
- Remaining first-round picks and all second-round picks are assigned by reverse record

### 6.2 Lottery Odds (Top 14 Teams)

The lottery determines only the top **4** picks. After that, picks 5-14 are assigned by reverse record among the remaining lottery teams.

| Rank (by record, worst to best) | Chance at #1 Pick | Chance at Top 4 |
|---|---|---|
| 1st (worst record) | 14.0% | 52.1% |
| 2nd | 13.4% | 51.0% |
| 3rd | 12.7% | 49.0% |
| 4th | 12.0% | 46.9% |
| 5th | 10.5% | 42.1% |
| 6th | 9.0% | 37.2% |
| 7th | 7.5% | 31.9% |
| 8th | 6.0% | 26.3% |
| 9th | 4.5% | 20.3% |
| 10th | 3.0% | 13.9% |
| 11th | 2.0% | 9.4% |
| 12th | 1.5% | 7.2% |
| 13th | 1.0% | 4.8% |
| 14th | 0.5% | 2.4% |

**Key rule**: A team cannot fall more than 4 spots from its pre-lottery position. The team with the worst record can pick no lower than #5.

### 6.3 Rookie Scale Contracts

First-round picks sign predetermined contracts based on their slot:

| Contract Year | Status |
|---|---|
| Year 1 | Guaranteed |
| Year 2 | Guaranteed |
| Year 3 | Team Option |
| Year 4 | Team Option |

Salary amounts are set by the CBA and scale by pick number. The #1 pick earns approximately ~$11M in Year 1, while pick #30 earns approximately ~$2.1M.

Second-round picks are NOT guaranteed any specific contract and can be signed to:
- Standard contracts (negotiated freely)
- Two-way contracts
- Or go unsigned

### 6.4 Rookie Extension

First-round picks can negotiate an extension after their 3rd year (before Year 4 team option):
- **Standard extension**: Up to 25% of the cap at time of extension, 5 years total
- **Designated Rookie Extension (Supermax)**: Up to 30% of the cap, if the player meets All-NBA/MVP/DPOY criteria

---

## 7. Roster Rules

### 7.1 Roster Limits & Lists

The NBA categorizes players into several official "Lists". The most relevant for the simulator are the **Active List**, **Inactive List**, and **Two-Way List**.

| Limit | Count | Notes |
|---|---|---|
| **Standard roster minimum** | 12 | Team cannot play with fewer |
| **Standard roster maximum** | 15 | Active + Inactive List |
| **Offseason maximum** | 21 | Between last game and day before next Regular Season |
| **Two-way contracts** | 3 | Additional slots (18 total possible during season) |
| **Minimum players dressed** | 8 | To start a Regular Season game (9 for Postseason) |

### 7.2 Two-Way Contracts

Two-way players split time between the NBA team and its G League affiliate:

| Rule | Details |
|---|---|
| NBA days limit | No hard limit post-2023 CBA (previously 50 days) |
| Salary | ~50% of the rookie minimum (~$560K) |
| Playoff eligibility | Must be converted to a standard contract to be playoff-eligible |
| Conversion | Can be converted to a standard contract at any time (if roster spot is available) |

### 7.3 Hardship Exception

If a team has 4+ players injured/unavailable for 2+ weeks, they can apply for a hardship exception to temporarily exceed the 15-man roster limit, signing a player for up to the veteran minimum.

### 7.4 Waiving Players

| Scenario | Financial Impact | Details |
|---|---|---|
| Guaranteed contract | Team owes full guaranteed amount | Spreads across remaining years via "stretch" provision if elected |
| Non-guaranteed | Owes nothing beyond guaranteed portion | Must waive before guarantee date (Jan 10) |
| Stretch provision | Remaining money spread over 2× years + 1 | e.g., 2 years remaining → paid out over 5 years |
| **Waiver Period** | Player on waivers for 48 hours | During this time, other teams can claim the player |
| **Claiming Priority** | Inverse order of standings | Team with worst record gets priority |

### 7.5 10-Day Contracts

- Available starting January 5
- Teams below 15 players can sign players to 10-day contracts (minimum salary)
- Each player can sign two 10-day contracts with the same team; after the second, the team must sign them for the rest of the season or release them

---

## 8. Season Structure

### 8.1 Key Dates (Abstracted for Simulator)

The simulator condenses the real calendar into a manageable progression. Below are the landmark dates:

| Date | Event |
|---|---|
| **Late June** | NBA Draft (2-day event) |
| **June 30** | Free agency moratorium opens |
| **July 6** | Free agency signings begin |
| **September 29** | Training camps open |
| **October 21** | Regular season tips off |
| **January 5** | 10-day contracts become available |
| **January 10** | All non-guaranteed contracts become fully guaranteed |
| **February 5** | **Trade Deadline** (3:00 PM ET) |
| **Mid-February** | All-Star Weekend |
| **March 1** | Playoff eligibility waiver deadline |
| **Mid-April** | Regular season ends |
| **Mid-April** | Play-In Tournament (7th–10th seeds) |
| **Late April** | Playoffs begin |
| **May** | Draft Lottery |
| **June** | NBA Finals |

### 8.2 Regular Season

- **82 games** per team
- Schedule breakdown:
  - 4 games vs each division rival (4 × 4 = 16 games)
  - 4 games vs 6 non-division conference opponents (24 games)
  - 3 games vs 4 remaining conference opponents (12 games)
  - 2 games vs each team in the opposite conference (2 × 15 = 30 games)
  - Total: 82 games

### 8.3 Competition Structure

| Component | Format |
|---|---|
| **Conferences** | 2 (Eastern, Western) |
| **Divisions** | 6 (3 per conference, 5 teams each) |
| **Play-In Tournament** | Seeds 7-10 in each conference compete for the final 2 playoff spots |
| **Playoffs** | 16 teams (8 per conference), best-of-7, 4 rounds |
| **NBA Cup** | In-Season Tournament with group play + knockout rounds (mid-season) |

### 8.4 Play-In Tournament

| Game | Matchup | Result |
|---|---|---|
| Game A | #7 seed vs #8 seed | Winner gets 7th seed |
| Game B | #9 seed vs #10 seed | Loser is eliminated |
| Game C | Loser of A vs Winner of B | Winner gets 8th seed |

### 8.5 Playoff Seeding

- Seeds 1-6: Top 6 records in each conference
- Seeds 7-8: Determined by Play-In Tournament
- Bracket: 1v8, 2v7, 3v6, 4v5 in each conference
- **Re-seeding**: The bracket is fixed (no re-seeding between rounds)
- All series are **best of 7**, with 2-2-1-1-1 home court format

---

## 9. Simulator Fidelity Summary

This section maps every major rule to its implementation fidelity in the MVP and future versions.

### Salary Cap System

| Rule | Fidelity | Notes |
|---|---|---|
| Salary Cap amount | **[FULL]** | Use actual 2024-25 value ($140.588M); scale ~8-10% per season |
| Salary Floor (90%) | **[FULL]** | Enforce minimum spending |
| Luxury Tax brackets | **[SIMPLIFIED]** | Implement tiered tax but may use rounded bracket boundaries |
| Repeat offender designation | **[DEFERRED]** | Track later when multi-season play exists |
| First Tax Apron restrictions | **[SIMPLIFIED]** | Limit MLE availability |
| Second Tax Apron restrictions | **[DEFERRED]** | Complex; implement after core trade engine |

### Cap Exceptions

| Rule | Fidelity | Notes |
|---|---|---|
| Mid-Level Exception (MLE) | **[SIMPLIFIED]** | Implement as a percentage of cap (~8.8%) rather than exact dollar amount |
| Taxpayer MLE | **[SIMPLIFIED]** | Implement as ~3.7% of cap |
| Bi-Annual Exception | **[DEFERRED]** | Low priority for MVP |
| Full Bird Rights | **[FULL]** | Critical for free agency realism |
| Early Bird Rights | **[SIMPLIFIED]** | Implement 175% rule, skip edge cases |
| Non-Bird Rights | **[SIMPLIFIED]** | Implement 120% rule |
| Traded Player Exception | **[DEFERRED]** | Complex tracking; add post-MVP |
| Disabled Player Exception | **[DEFERRED]** | Requires injury system |
| Minimum Salary Exception | **[FULL]** | Always available |
| Rookie Exception | **[FULL]** | Needed for draft system |

### Contracts

| Rule | Fidelity | Notes |
|---|---|---|
| Max salary by experience tier | **[FULL]** | 25/30/35% tiers |
| Max contract length (4 vs 5 years) | **[FULL]** | Distinguish own-player vs new-team signings |
| Annual raises (8% vs 5%) | **[SIMPLIFIED]** | Implement flat raises, skip compounding edge cases |
| Supermax eligibility | **[DEFERRED]** | Requires awards tracking |
| Player Options | **[DEFERRED]** | Adds decision complexity for AI; defer to post-MVP |
| Team Options | **[DEFERRED]** | Same as above |
| Early Termination Options | **[DEFERRED]** | Rare; defer |
| Guaranteed vs Non-Guaranteed | **[SIMPLIFIED]** | All contracts fully guaranteed in MVP |
| Signing bonuses & incentives | **[DEFERRED]** | Rarely impacts macro decisions |

### Trades

| Rule | Fidelity | Notes |
|---|---|---|
| Salary matching (taxpayer rule) | **[FULL]** | 125% + $100K |
| Salary matching (non-taxpayer tiers) | **[FULL]** | 175%/$5M/125% tiers |
| Salary matching (second apron) | **[DEFERRED]** | Implement when apron system is added |
| Salary aggregation rules | **[SIMPLIFIED]** | Allow aggregation but skip 60-day restriction |
| Trade deadline enforcement | **[FULL]** | Block trades after February 5 |
| Stepien Rule | **[FULL]** | Critical for realistic AI and player behavior |
| Draft pick protections | **[SIMPLIFIED]** | Support top-N protections only |
| No-trade clauses | **[DEFERRED]** | Adds negotiation complexity; defer |
| Cash considerations | **[DEFERRED]** | Minor feature |
| 3-month / Dec 15 trade restriction | **[DEFERRED]** | Edge case timing |

### Free Agency

| Rule | Fidelity | Notes |
|---|---|---|
| UFA / RFA distinction | **[FULL]** | Core free agency mechanic |
| Bird Rights (Full/Early/Non) | **[FULL]** | Essential for cap management |
| RFA matching (2-day window) | **[SIMPLIFIED]** | Implement matching mechanic; simplify timing |
| Cap holds | **[SIMPLIFIED]** | Use flat multipliers (150%/130%/120%) |
| Moratorium period | **[DEFERRED]** | Simplify to instant signing window |
| Sign-and-trade | **[DEFERRED]** | Complex rules; add post-MVP |
| Qualifying offers | **[SIMPLIFIED]** | Auto-generate at 125% of prior salary |

### Draft

| Rule | Fidelity | Notes |
|---|---|---|
| 2-round, 60-pick structure | **[FULL]** | |
| Lottery odds (14 teams, top 4 drawn) | **[FULL]** | Implement full probability table |
| Rookie Scale Contracts (2+2 structure) | **[FULL]** | Needed for realistic cap management |
| Rookie extensions | **[DEFERRED]** | Requires multi-season tracking |
| Second-round pick flexibility | **[SIMPLIFIED]** | Allow standard or two-way only |

### Roster Rules

| Rule | Fidelity | Notes |
|---|---|---|
| 12-15 roster limits | **[FULL]** | Hard enforce during season |
| Offseason maximum (21) | **[SIMPLIFIED]** | Implement but don't strictly enforce until pre-season cutdown |
| Minimum players to play (8) | **[FULL]** | Game simulation rule |
| Two-way contracts (3 slots) | **[DEFERRED]** | Requires G League integration |
| Waiving / stretch provision | **[SIMPLIFIED]** | Implement waiving; defer stretch |
| Waiver claiming priority | **[FULL]** | Inverse order of standings |
| 10-day contracts | **[DEFERRED]** | Minor mechanic |
| Hardship exception | **[DEFERRED]** | Rare edge case |

### Season Structure

| Rule | Fidelity | Notes |
|---|---|---|
| 82-game regular season | **[FULL]** | Core gameplay loop |
| Playoff bracket (best-of-7) | **[FULL]** | Essential |
| Play-In Tournament | **[SIMPLIFIED]** | Implement 7-10 mini-bracket |
| Trade deadline date enforcement | **[FULL]** | Calendar-gated |
| Free agency window | **[SIMPLIFIED]** | Collapse moratorium into signing window |
| NBA Cup (In-Season Tournament) | **[DEFERRED]** | Secondary competition |
| All-Star Weekend | **[DEFERRED]** | Cosmetic; no gameplay impact |

---

## Appendix A: Quick Reference Formulas

### Salary Cap Percentage Shortcuts

For rules that reference "percentage of cap," use these to keep the engine flexible across seasons:

| Concept | Formula |
|---|---|
| Player max (0-6 yrs) | `cap × 0.25` |
| Player max (7-9 yrs) | `cap × 0.30` |
| Player max (10+ yrs) | `cap × 0.35` |
| Salary floor | `cap × 0.90` |
| MLE (non-taxpayer) | `cap × 0.088` |
| MLE (taxpayer) | `cap × 0.037` |
| Luxury tax line | `cap × 1.215` (approximate) |
| First apron | `taxLine + (cap × 0.052)` (approximate) |
| Second apron | `taxLine + (cap × 0.129)` (approximate) |

### Trade Salary Matching Quick Check

```
function isTradeValid(outgoing, incoming, teamSalary, taxLine, secondApron):
  if teamSalary > secondApron:
    return incoming <= outgoing

  if teamSalary > taxLine:
    return incoming <= (outgoing * 1.25) + 100_000

  // Non-taxpayer tiers
  if outgoing <= 7_500_000:
    return incoming <= (outgoing * 1.75) + 100_000
  if outgoing <= 29_000_000:
    return incoming <= outgoing + 5_000_000
  return incoming <= (outgoing * 1.25) + 100_000
```

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **BRI** | Basketball Related Income — total league revenue used to calculate the salary cap |
| **CBA** | Collective Bargaining Agreement — the contract between the NBA and NBPA governing all financial rules |
| **Bird Rights** | The right of a team to exceed the salary cap to re-sign their own free agents |
| **Cap Hold** | A placeholder salary charged against the cap for unsigned free agents with Bird rights |
| **TPE** | Traded Player Exception — cap space created by a trade imbalance |
| **MLE** | Mid-Level Exception — annual exception allowing over-cap teams to sign free agents |
| **BAE** | Bi-Annual Exception — smaller exception available every other year |
| **DPE** | Disabled Player Exception — emergency exception for teams losing a player to injury |
| **RFA** | Restricted Free Agent — free agent whose team can match outside offers |
| **UFA** | Unrestricted Free Agent — free agent who can sign with any team |
| **NTC** | No-Trade Clause — contractual provision requiring player approval for trades |
| **ETO** | Early Termination Option — allows a player to end their contract early |
| **Stepien Rule** | Prevents teams from trading first-round picks in consecutive years |
| **Hard Cap** | An absolute salary ceiling that cannot be exceeded by any means (triggered by certain transactions) |
| **Soft Cap** | A salary ceiling that can be exceeded through exceptions (the NBA's standard cap) |
| **Apron** | Salary thresholds above the luxury tax line that trigger roster-building restrictions |
| **Stretch Provision** | Allows a team to spread a waived player's guaranteed money over a longer period |

---

*This document was compiled for "The Association" NBA GM Simulator. It should be updated annually as the CBA evolves and new cap figures are released.*
