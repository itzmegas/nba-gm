import { describe, expect, it } from "vitest";
import { NBA_RULES } from "../../../src/domain/constants/nba-rules";
import type { Player } from "../../../src/domain/entities/Player";
import { ContractGenerator } from "../../../src/domain/services/ContractGenerator";

describe("ContractGenerator", () => {
  const generator = new ContractGenerator();

  const createPlayer = (yoe: number): Player => ({ yearsOfExperience: yoe }) as Player;

  describe("calculateMaxSalary", () => {
    it("should return 25% of cap for players with 0-6 years of experience", () => {
      const expected = Math.floor(NBA_RULES.SALARY_CAP * 0.25);
      expect(generator.calculateMaxSalary(createPlayer(0))).toBe(expected);
      expect(generator.calculateMaxSalary(createPlayer(5))).toBe(expected);
      expect(generator.calculateMaxSalary(createPlayer(6))).toBe(expected);
    });

    it("should return 30% of cap for players with 7-9 years of experience", () => {
      const expected = Math.floor(NBA_RULES.SALARY_CAP * 0.3);
      expect(generator.calculateMaxSalary(createPlayer(7))).toBe(expected);
      expect(generator.calculateMaxSalary(createPlayer(9))).toBe(expected);
    });

    it("should return 35% of cap for players with 10+ years of experience", () => {
      const expected = Math.floor(NBA_RULES.SALARY_CAP * 0.35);
      expect(generator.calculateMaxSalary(createPlayer(10))).toBe(expected);
      expect(generator.calculateMaxSalary(createPlayer(15))).toBe(expected);
    });
  });
});
