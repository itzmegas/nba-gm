import type { Contract } from "../entities/Contract";
import type { TeamTradeDetails, TradePackage, TradeValidationResult } from "../entities/Trade";
import { SalaryCapCalculator } from "./SalaryCapCalculator";

export class TradeValidator {
  private salaryCapCalc = new SalaryCapCalculator();

  // Constantes de la CBA (simplificadas)
  private static readonly MIN_ROSTER_SIZE = 12;
  private static readonly MAX_ROSTER_SIZE = 15;
  private static readonly HARD_CAP = 189_000_000; // Second Apron / Hard Cap
  private static readonly SALARY_MATCH_MARGIN_TAX = 1.25; // 125%
  private static readonly SALARY_MATCH_MARGIN_NON_TAX = 1.25; // También 125% post-2023

  validateTrade(
    teamAContracts: Contract[],
    teamBContracts: Contract[],
    packageA: TradePackage,
    packageB: TradePackage,
    currentYear: number = new Date().getFullYear()
  ): TradeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Calcular salarios salientes/entrantes
    const detailsA = this.calculateTradeDetails(teamAContracts, packageA, packageB, currentYear);
    const detailsB = this.calculateTradeDetails(teamBContracts, packageB, packageA, currentYear);

    // 2. Validar Salary Matching
    const salaryMatchErrors = this.validateSalaryMatching(detailsA, detailsB);
    errors.push(...salaryMatchErrors);

    // 3. Validar Roster Size
    const rosterErrorsA = this.validateRosterSize(detailsA.rosterSizeAfter);
    const rosterErrorsB = this.validateRosterSize(detailsB.rosterSizeAfter);
    errors.push(...rosterErrorsA.map((e) => `Team A: ${e}`));
    errors.push(...rosterErrorsB.map((e) => `Team B: ${e}`));

    // 4. Validar Hard Cap
    if (detailsA.isOverHardCapAfter) {
      errors.push(`${packageA.teamName} would exceed the Hard Cap ($189M) after this trade`);
    }
    if (detailsB.isOverHardCapAfter) {
      errors.push(`${packageB.teamName} would exceed the Hard Cap ($189M) after this trade`);
    }

    // 5. Warnings (no bloqueantes)
    if (detailsA.rosterSizeAfter > 13 && detailsA.rosterSizeAfter <= 15) {
      warnings.push(
        `${packageA.teamName} roster will be at ${detailsA.rosterSizeAfter} players (close to limit)`
      );
    }
    if (detailsB.rosterSizeAfter > 13 && detailsB.rosterSizeAfter <= 15) {
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
    currentYear: number
  ): TeamTradeDetails {
    const teamId = outgoingPackage.teamId;

    // Salarios actuales
    const currentTotalSalary = this.salaryCapCalc.calculateTotalSalary(currentContracts);

    // Salarios salientes (jugadores que damos)
    const outgoingSalary = outgoingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    // Salarios entrantes (jugadores que recibimos)
    const incomingSalary = incomingPackage.outgoingAssets
      .filter((asset) => asset.type === "player" && asset.contract)
      .reduce((sum, asset) => sum + (asset.contract?.salaryY1 || 0), 0);

    // Nuevo total salarial
    const newTotalSalary = currentTotalSalary - outgoingSalary + incomingSalary;

    // Calcular roster size después del trade
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
      isOverCapAfter: newTotalSalary > 140_000_000,
      isOverHardCapAfter: newTotalSalary > TradeValidator.HARD_CAP,
    };
  }

  private validateSalaryMatching(detailsA: TeamTradeDetails, detailsB: TeamTradeDetails): string[] {
    const errors: string[] = [];

    // Regla simplificada: El equipo que recibe más salario debe cumplir el margen
    // Si el equipo A recibe más plata que la que da, debe poder "absorber" la diferencia

    // Escenario 1: Team A recibe más salario del que envía
    if (detailsA.incomingSalary > detailsA.outgoingSalary) {
      const maxIncoming = detailsA.outgoingSalary * TradeValidator.SALARY_MATCH_MARGIN_TAX;
      if (detailsA.incomingSalary > maxIncoming) {
        errors.push(
          `${detailsA.teamId}: Incoming salary ($${detailsA.incomingSalary.toLocaleString()}) exceeds ` +
            `125% of outgoing salary ($${maxIncoming.toLocaleString()})`
        );
      }
    }

    // Escenario 2: Team B recibe más salario del que envía
    if (detailsB.incomingSalary > detailsB.outgoingSalary) {
      const maxIncoming = detailsB.outgoingSalary * TradeValidator.SALARY_MATCH_MARGIN_TAX;
      if (detailsB.incomingSalary > maxIncoming) {
        errors.push(
          `${detailsB.teamId}: Incoming salary ($${detailsB.incomingSalary.toLocaleString()}) exceeds ` +
            `125% of outgoing salary ($${maxIncoming.toLocaleString()})`
        );
      }
    }

    return errors;
  }

  private validateRosterSize(rosterSize: number): string[] {
    const errors: string[] = [];

    if (rosterSize < TradeValidator.MIN_ROSTER_SIZE) {
      errors.push(`Roster size (${rosterSize}) below minimum (${TradeValidator.MIN_ROSTER_SIZE})`);
    }

    if (rosterSize > TradeValidator.MAX_ROSTER_SIZE) {
      errors.push(
        `Roster size (${rosterSize}) exceeds maximum (${TradeValidator.MAX_ROSTER_SIZE})`
      );
    }

    return errors;
  }

  // Helper para chequear si un trade es válido rápidamente
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
