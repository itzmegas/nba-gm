import { NBA_RULES } from "../constants/nba-rules";
import type { Contract } from "../entities/Contract";
import type { TeamTradeDetails, TradePackage, TradeValidationResult } from "../entities/Trade";
import { type DomainError, HardCapError, RosterSizeError, SalaryMatchingError } from "../errors";
import { SalaryCapCalculator } from "./SalaryCapCalculator";

export class TradeValidator {
  private salaryCapCalc = new SalaryCapCalculator();

  validateTrade(
    teamAContracts: Contract[],
    teamBContracts: Contract[],
    packageA: TradePackage,
    packageB: TradePackage,
    currentYear: number = new Date().getFullYear()
  ): TradeValidationResult {
    const errors: DomainError[] = [];
    const warnings: string[] = [];

    const detailsA = this.calculateTradeDetails(teamAContracts, packageA, packageB, currentYear);
    const detailsB = this.calculateTradeDetails(teamBContracts, packageB, packageA, currentYear);

    // 2. Validar Salary Matching
    const salaryMatchErrorsA = this.validateSalaryMatching(detailsA);
    const salaryMatchErrorsB = this.validateSalaryMatching(detailsB);
    errors.push(...salaryMatchErrorsA, ...salaryMatchErrorsB);

    // 3. Validar Roster Size
    const rosterErrorsA = this.validateRosterSize(detailsA.teamId, detailsA.rosterSizeAfter);
    const rosterErrorsB = this.validateRosterSize(detailsB.teamId, detailsB.rosterSizeAfter);
    errors.push(...rosterErrorsA, ...rosterErrorsB);

    // 4. Validar Hard Cap
    if (detailsA.isOverHardCapAfter) {
      errors.push(
        new HardCapError(
          `${packageA.teamName} would exceed the Second Apron / Hard Cap ($${NBA_RULES.SECOND_APRON.toLocaleString()}) after this trade`
        )
      );
    }
    if (detailsB.isOverHardCapAfter) {
      errors.push(
        new HardCapError(
          `${packageB.teamName} would exceed the Second Apron / Hard Cap ($${NBA_RULES.SECOND_APRON.toLocaleString()}) after this trade`
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
    currentContracts: Contract[],
    outgoingPackage: TradePackage,
    incomingPackage: TradePackage,
    _currentYear: number
  ): TeamTradeDetails {
    const teamId = outgoingPackage.teamId;
    const currentTotalSalary = this.salaryCapCalc.calculateTotalSalary(currentContracts);

    const outgoingSalary = outgoingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    const incomingSalary = incomingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    const newTotalSalary = currentTotalSalary - outgoingSalary + incomingSalary;

    const currentRosterSize = currentContracts.length;
    const outgoingPlayers = outgoingPackage.outgoingAssets.filter(
      (a) => a.type === "player"
    ).length;
    const incomingPlayers = incomingPackage.outgoingAssets.filter(
      (a) => a.type === "player"
    ).length;
    const rosterSizeAfter = currentRosterSize - outgoingPlayers + incomingPlayers;

    return {
      teamId,
      outgoingSalary,
      incomingSalary,
      salaryDelta: incomingSalary - outgoingSalary,
      rosterSizeAfter,
      isOverCapAfter: newTotalSalary > NBA_RULES.SALARY_CAP,
      isOverHardCapAfter: newTotalSalary > NBA_RULES.SECOND_APRON,
      newTotalSalary,
    };
  }

  private validateSalaryMatching(details: TeamTradeDetails): DomainError[] {
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
    if (postTradeSalary > NBA_RULES.SECOND_APRON) {
      // Second Apron: Dollar for dollar (incoming <= outgoing)
      maxIncoming =
        outgoing * NBA_RULES.MATCHING_TIERS.SECOND_APRON.incomingMultiplier +
        NBA_RULES.MATCHING_TIERS.SECOND_APRON.flatBonus;
    } else if (postTradeSalary > NBA_RULES.FIRST_APRON) {
      // First Apron
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
          `${details.teamId}: Incoming salary ($${details.incomingSalary.toLocaleString()}) exceeds allowed maximum ($${maxIncoming.toLocaleString()}) based on their tax bracket`
        )
      );
    }

    return errors;
  }

  private validateRosterSize(teamId: string, rosterSize: number): DomainError[] {
    const errors: DomainError[] = [];

    if (rosterSize < NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN) {
      errors.push(
        new RosterSizeError(
          `${teamId}: Roster size (${rosterSize}) below minimum (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MIN})`
        )
      );
    }

    if (rosterSize > NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX) {
      errors.push(
        new RosterSizeError(
          `${teamId}: Roster size (${rosterSize}) exceeds maximum (${NBA_RULES.ROSTER_LIMITS.IN_SEASON_MAX})`
        )
      );
    }

    return errors;
  }

  canExecuteTrade(
    teamAContracts: Contract[],
    teamBContracts: Contract[],
    packageA: TradePackage,
    packageB: TradePackage
  ): boolean {
    const result = this.validateTrade(teamAContracts, teamBContracts, packageA, packageB);
    return result.isValid;
  }
}
