import { getSalaryCapThresholds, NBA_RULES } from "../constants/nba-rules";
import type {
  TeamTradeDetails,
  TradePackage,
  TradeTeamSnapshot,
  TradeValidationResult,
} from "../entities/Trade";
import { type DomainError, HardCapError, RosterSizeError, SalaryMatchingError } from "../errors";
import { SalaryCapCalculator } from "./SalaryCapCalculator";

export class TradeValidator {
  private salaryCapCalc = new SalaryCapCalculator();

  validateTrade(
    teamA: TradeTeamSnapshot,
    teamB: TradeTeamSnapshot,
    packageA: TradePackage,
    packageB: TradePackage,
    currentYear: number = 2024
  ): TradeValidationResult {
    const errors: DomainError[] = [];
    const warnings: string[] = [];

    const detailsA = this.calculateTradeDetails(teamA, packageA, packageB, currentYear);
    const detailsB = this.calculateTradeDetails(teamB, packageB, packageA, currentYear);

    // 2. Validar Salary Matching
    const thresholds = getSalaryCapThresholds(currentYear);
    const salaryMatchErrorsA = this.validateSalaryMatching(detailsA, thresholds);
    const salaryMatchErrorsB = this.validateSalaryMatching(detailsB, thresholds);
    errors.push(...salaryMatchErrorsA, ...salaryMatchErrorsB);

    // 3. Validar Roster Size
    const rosterErrorsA = this.validateRosterSize(detailsA.teamName, detailsA.rosterSizeAfter);
    const rosterErrorsB = this.validateRosterSize(detailsB.teamName, detailsB.rosterSizeAfter);
    errors.push(...rosterErrorsA, ...rosterErrorsB);

    // 4. Validar Hard Cap
    if (detailsA.isOverHardCapAfter) {
      errors.push(
        new HardCapError(
          `${packageA.teamName} would exceed its hard cap ($${detailsA.hardCapLimit?.toLocaleString()}) after this trade`
        )
      );
    }
    if (detailsB.isOverHardCapAfter) {
      errors.push(
        new HardCapError(
          `${packageB.teamName} would exceed its hard cap ($${detailsB.hardCapLimit?.toLocaleString()}) after this trade`
        )
      );
    }

    // 5. Warnings (no bloqueantes)
    if (
      detailsA.rosterSizeAfter > 13 &&
      detailsA.rosterSizeAfter <= NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX
    ) {
      warnings.push(
        `${packageA.teamName} roster will be at ${detailsA.rosterSizeAfter} players (close to limit)`
      );
    }
    if (
      detailsB.rosterSizeAfter > 13 &&
      detailsB.rosterSizeAfter <= NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX
    ) {
      warnings.push(
        `${packageB.teamName} roster will be at ${detailsB.rosterSizeAfter} players (close to limit)`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {
        teamA: detailsA,
        teamB: detailsB,
      },
    };
  }

  private calculateTradeDetails(
    team: TradeTeamSnapshot,
    outgoingPackage: TradePackage,
    incomingPackage: TradePackage,
    currentYear: number
  ): TeamTradeDetails {
    const teamId = outgoingPackage.teamId;
    const currentTotalSalary = this.salaryCapCalc.calculateTotalSalary(team.contracts);

    const outgoingSalary = outgoingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    const incomingSalary = incomingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    const newTotalSalary = currentTotalSalary - outgoingSalary + incomingSalary;
    const thresholds = getSalaryCapThresholds(currentYear);

    const outgoingPlayers = outgoingPackage.outgoingAssets.filter(
      (a) => a.type === "player"
    ).length;
    const incomingPlayers = incomingPackage.outgoingAssets.filter(
      (a) => a.type === "player"
    ).length;
    const rosterSizeAfter = team.rosterSize - outgoingPlayers + incomingPlayers;

    return {
      teamId,
      teamName: outgoingPackage.teamName,
      outgoingSalary,
      incomingSalary,
      salaryDelta: incomingSalary - outgoingSalary,
      rosterSizeAfter,
      isOverCapAfter: newTotalSalary > thresholds.salaryCap,
      isOverHardCapAfter: team.hardCapLimit !== undefined && newTotalSalary > team.hardCapLimit,
      hardCapLimit: team.hardCapLimit,
      newTotalSalary,
    };
  }

  private validateSalaryMatching(
    details: TeamTradeDetails,
    thresholds: ReturnType<typeof getSalaryCapThresholds>
  ): DomainError[] {
    const errors: DomainError[] = [];

    // Only care if we are taking in more salary than sending out
    if (details.incomingSalary <= details.outgoingSalary) {
      return errors; // We are always allowed to take less
    }

    // Determine the max incoming based on team's post-trade salary
    const postTradeSalary = details.newTotalSalary;
    const outgoing = details.outgoingSalary;
    let maxIncoming = 0;

    // Check aprons
    if (postTradeSalary > thresholds.secondApron) {
      // Second Apron: Dollar for dollar (incoming <= outgoing)
      maxIncoming =
        outgoing * NBA_RULES.MATCHING_TIERS.SECOND_APRON.incomingMultiplier +
        NBA_RULES.MATCHING_TIERS.SECOND_APRON.flatBonus;
    } else if (postTradeSalary > thresholds.luxuryTax) {
      // Taxpayer: this branch starts at the luxury-tax line
      maxIncoming =
        outgoing * NBA_RULES.MATCHING_TIERS.TAXPAYER.incomingMultiplier +
        NBA_RULES.MATCHING_TIERS.TAXPAYER.flatBonus;
    } else {
      // Non-Taxpayer
      if (outgoing <= NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_LOW.maxOutgoing) {
        maxIncoming =
          outgoing * NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_LOW.incomingMultiplier +
          NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_LOW.flatBonus;
      } else if (outgoing <= NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_MID.maxOutgoing) {
        maxIncoming = outgoing + NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_MID.flatBonus; // 100% + $5M
      } else {
        maxIncoming =
          outgoing * NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_HIGH.incomingMultiplier +
          NBA_RULES.MATCHING_TIERS.NON_TAXPAYER_HIGH.flatBonus;
      }
    }

    if (details.incomingSalary > maxIncoming) {
      errors.push(
        new SalaryMatchingError(
          `${details.teamName}: Incoming salary ($${details.incomingSalary.toLocaleString()}) exceeds allowed maximum ($${maxIncoming.toLocaleString()}) based on their tax bracket`
        )
      );
    }

    return errors;
  }

  private validateRosterSize(teamName: string, rosterSize: number): DomainError[] {
    const errors: DomainError[] = [];

    if (rosterSize < NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN) {
      errors.push(
        new RosterSizeError(
          `${teamName}: Roster size (${rosterSize}) below minimum (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN})`
        )
      );
    }

    if (rosterSize > NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX) {
      errors.push(
        new RosterSizeError(
          `${teamName}: Roster size (${rosterSize}) exceeds maximum (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX})`
        )
      );
    }

    return errors;
  }

  canExecuteTrade(
    teamA: TradeTeamSnapshot,
    teamB: TradeTeamSnapshot,
    packageA: TradePackage,
    packageB: TradePackage,
    seasonYear: number = 2024
  ): boolean {
    const result = this.validateTrade(teamA, teamB, packageA, packageB, seasonYear);
    return result.isValid;
  }
}
