import type { Contract } from "../entities/Contract";

export class SalaryCapCalculator {
  // Cap Space de Referencia (Esto después lo podés sacar de una config o DB)
  private static readonly SALARY_CAP = 140_000_000;
  private static readonly LUXURY_TAX_THRESHOLD = 170_000_000;
  private static readonly FIRST_APRON = 178_000_000;
  private static readonly SECOND_APRON = 189_000_000;

  calculateTotalSalary(contracts: Contract[]): number {
    // Suma solo el salario del año 1 (actual) de todos los contratos garantizados
    // Nota: Acá podrías meter lógica más compleja para contratos no garantizados
    return contracts.reduce((total, contract) => {
      return total + (contract.salaryY1 || 0);
    }, 0);
  }

  calculateCapSpace(contracts: Contract[]): number {
    const totalSalary = this.calculateTotalSalary(contracts);
    return Math.max(0, SalaryCapCalculator.SALARY_CAP - totalSalary);
  }

  isOverCap(contracts: Contract[]): boolean {
    return this.calculateTotalSalary(contracts) > SalaryCapCalculator.SALARY_CAP;
  }

  isOverLuxuryTax(contracts: Contract[]): boolean {
    return this.calculateTotalSalary(contracts) > SalaryCapCalculator.LUXURY_TAX_THRESHOLD;
  }

  getFinancialStatus(contracts: Contract[]): {
    totalSalary: number;
    capSpace: number;
    isOverCap: boolean;
    isOverLuxuryTax: boolean;
    taxBill: number; // Placeholder
    apronStatus: "None" | "First" | "Second";
  } {
    const totalSalary = this.calculateTotalSalary(contracts);

    let apronStatus: "None" | "First" | "Second" = "None";
    if (totalSalary > SalaryCapCalculator.SECOND_APRON) apronStatus = "Second";
    else if (totalSalary > SalaryCapCalculator.FIRST_APRON) apronStatus = "First";

    return {
      totalSalary,
      capSpace: this.calculateCapSpace(contracts),
      isOverCap: this.isOverCap(contracts),
      isOverLuxuryTax: this.isOverLuxuryTax(contracts),
      taxBill: 0, // TODO: Implementar cálculo progresivo de tax
      apronStatus,
    };
  }
}
