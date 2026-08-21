import { NBA_RULES } from "../constants/nba-rules";
import type { Contract } from "../entities/Contract";

export class SalaryCapCalculator {
  calculateTotalSalary(contracts: Contract[], additionalCapHolds: number = 0): number {
    // Suma solo el salario del año 1 (actual) de todos los contratos garantizados
    const activeSalaries = contracts.reduce((total, contract) => {
      return total + (contract.salaryY1 || 0);
    }, 0);
    return activeSalaries + additionalCapHolds;
  }

  calculateCapHold(previousSalary: number, isFullBird: boolean = true): number {
    // Implementación simplificada: 150% para Full Bird
    if (isFullBird) {
      return previousSalary * 1.5;
    }
    // Early Bird: 130%, Non-Bird: 120% (simplificación)
    return previousSalary * 1.2;
  }

  calculateCapSpace(contracts: Contract[], additionalCapHolds: number = 0): number {
    const totalSalary = this.calculateTotalSalary(contracts, additionalCapHolds);
    return Math.max(0, NBA_RULES.SALARY_CAP - totalSalary);
  }

  isOverCap(contracts: Contract[], additionalCapHolds: number = 0): boolean {
    return this.calculateTotalSalary(contracts, additionalCapHolds) > NBA_RULES.SALARY_CAP;
  }

  isOverLuxuryTax(contracts: Contract[], additionalCapHolds: number = 0): boolean {
    return this.calculateTotalSalary(contracts, additionalCapHolds) > NBA_RULES.LUXURY_TAX;
  }

  calculateTaxBill(totalSalary: number): number {
    const taxThreshold = NBA_RULES.LUXURY_TAX;
    if (totalSalary <= taxThreshold) return 0;

    const overage = totalSalary - taxThreshold;
    let tax = 0;

    const brackets = [
      { max: 5_000_000, rate: 1.5 },
      { max: 5_000_000, rate: 1.75 },
      { max: 5_000_000, rate: 2.5 },
      { max: 5_000_000, rate: 3.25 },
    ];

    let remaining = overage;
    for (const bracket of brackets) {
      if (remaining > 0) {
        const taxableInBracket = Math.min(remaining, bracket.max);
        tax += taxableInBracket * bracket.rate;
        remaining -= taxableInBracket;
      }
    }

    if (remaining > 0) {
      let currentRate = 3.75;
      while (remaining > 0) {
        const taxableInBracket = Math.min(remaining, 5_000_000);
        tax += taxableInBracket * currentRate;
        remaining -= taxableInBracket;
        currentRate += 0.5;
      }
    }

    return tax;
  }

  getFinancialStatus(
    contracts: Contract[],
    additionalCapHolds: number = 0
  ): {
    totalSalary: number;
    capSpace: number;
    isOverCap: boolean;
    isOverLuxuryTax: boolean;
    taxBill: number;
    apronStatus: "None" | "First" | "Second";
  } {
    const totalSalary = this.calculateTotalSalary(contracts, additionalCapHolds);

    let apronStatus: "None" | "First" | "Second" = "None";
    if (totalSalary > NBA_RULES.SECOND_APRON) apronStatus = "Second";
    else if (totalSalary > NBA_RULES.FIRST_APRON) apronStatus = "First";

    return {
      totalSalary,
      capSpace: this.calculateCapSpace(contracts, additionalCapHolds),
      isOverCap: this.isOverCap(contracts, additionalCapHolds),
      isOverLuxuryTax: this.isOverLuxuryTax(contracts, additionalCapHolds),
      taxBill: this.calculateTaxBill(totalSalary),
      apronStatus,
    };
  }
}
