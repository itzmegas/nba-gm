import { describe, expect, it } from "vitest";
import { NBA_RULES } from "../../../src/domain/constants/nba-rules";
import type { Contract } from "../../../src/domain/entities/Contract";
import { SalaryCapCalculator } from "../../../src/domain/services/SalaryCapCalculator";

describe("SalaryCapCalculator", () => {
  const calc = new SalaryCapCalculator();

  const createContract = (salaryY1: number): Contract => ({ salaryY1 }) as Contract;

  describe("calculateTotalSalary", () => {
    it("should sum up all contract salaries correctly", () => {
      const contracts = [createContract(10_000_000), createContract(5_000_000)];
      expect(calc.calculateTotalSalary(contracts)).toBe(15_000_000);
    });

    it("should add additional cap holds to the total", () => {
      const contracts = [createContract(10_000_000)];
      expect(calc.calculateTotalSalary(contracts, 2_000_000)).toBe(12_000_000);
    });
  });

  describe("calculateCapHold", () => {
    it("should return 150% of previous salary for Full Bird", () => {
      expect(calc.calculateCapHold(10_000_000, true)).toBe(15_000_000);
    });

    it("should return 120% of previous salary for Non-Bird", () => {
      expect(calc.calculateCapHold(10_000_000, false)).toBe(12_000_000);
    });
  });

  describe("calculateCapSpace", () => {
    it("should return available cap space when under the cap", () => {
      const contracts = [createContract(100_588_000)]; // 40M under cap
      expect(calc.calculateCapSpace(contracts)).toBe(40_000_000);
    });

    it("should return 0 when over the cap", () => {
      const contracts = [createContract(NBA_RULES.SALARY_CAP + 1_000_000)];
      expect(calc.calculateCapSpace(contracts)).toBe(0);
    });
  });

  describe("isOverCap & isOverLuxuryTax", () => {
    it("should identify when over cap", () => {
      expect(calc.isOverCap([createContract(NBA_RULES.SALARY_CAP + 1)])).toBe(true);
      expect(calc.isOverCap([createContract(NBA_RULES.SALARY_CAP)])).toBe(false);
    });

    it("should identify when over luxury tax", () => {
      expect(calc.isOverLuxuryTax([createContract(NBA_RULES.LUXURY_TAX + 1)])).toBe(true);
      expect(calc.isOverLuxuryTax([createContract(NBA_RULES.LUXURY_TAX)])).toBe(false);
    });
  });

  describe("calculateTaxBill", () => {
    it("should return 0 if under or exactly at tax threshold", () => {
      expect(calc.calculateTaxBill(NBA_RULES.LUXURY_TAX)).toBe(0);
    });

    it("should calculate progressive tax correctly", () => {
      // 1st bracket: 0 - 5M @ 1.5 => 5M * 1.5 = 7.5M
      const tax1 = calc.calculateTaxBill(NBA_RULES.LUXURY_TAX + 5_000_000);
      expect(tax1).toBe(7_500_000);

      // 2nd bracket: 5M - 10M @ 1.75 => 7.5M + (5M * 1.75) = 16.25M
      const tax2 = calc.calculateTaxBill(NBA_RULES.LUXURY_TAX + 10_000_000);
      expect(tax2).toBe(16_250_000);

      // 3rd bracket: 10M - 15M @ 2.5 => 16.25M + (5M * 2.5) = 28.75M
      const tax3 = calc.calculateTaxBill(NBA_RULES.LUXURY_TAX + 15_000_000);
      expect(tax3).toBe(28_750_000);

      // 4th bracket: 15M - 20M @ 3.25 => 28.75M + (5M * 3.25) = 45M
      const tax4 = calc.calculateTaxBill(NBA_RULES.LUXURY_TAX + 20_000_000);
      expect(tax4).toBe(45_000_000);

      // 5th bracket: 20M - 25M @ 3.75 => 45M + (5M * 3.75) = 63.75M
      const tax5 = calc.calculateTaxBill(NBA_RULES.LUXURY_TAX + 25_000_000);
      expect(tax5).toBe(63_750_000);
    });
  });

  describe("getFinancialStatus", () => {
    it("should return full financial snapshot with correct apron status", () => {
      const contracts = [createContract(NBA_RULES.FIRST_APRON + 1_000_000)];
      const status = calc.getFinancialStatus(contracts);

      expect(status.totalSalary).toBe(NBA_RULES.FIRST_APRON + 1_000_000);
      expect(status.capSpace).toBe(0);
      expect(status.isOverCap).toBe(true);
      expect(status.isOverLuxuryTax).toBe(true);
      expect(status.apronStatus).toBe("First");
      expect(status.taxBill).toBeGreaterThan(0);
    });

    it("should identify Second Apron status", () => {
      const contracts = [createContract(NBA_RULES.SECOND_APRON + 10)];
      const status = calc.getFinancialStatus(contracts);
      expect(status.apronStatus).toBe("Second");
    });
  });
});
