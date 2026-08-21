import { describe, expect, it } from "vitest";
import { NBA_RULES } from "../../../src/domain/constants/nba-rules";
import type { Contract } from "../../../src/domain/entities/Contract";
import type { TradeAsset, TradePackage } from "../../../src/domain/entities/Trade";
import { TradeValidator } from "../../../src/domain/services/TradeValidator";

describe("TradeValidator", () => {
  const validator = new TradeValidator();

  const createContract = (salaryY1: number): Contract => ({ salaryY1 }) as Contract;
  const createPlayerAsset = (salaryY1: number): TradeAsset => ({
    type: "player",
    contract: createContract(salaryY1),
  });

  // Helper to generate a valid starting roster (15 players)
  const generateRoster = (totalSalary: number, count = 15): Contract[] => {
    const avgSalary = totalSalary / count;
    return Array.from({ length: count }, () => createContract(avgSalary));
  };

  describe("validateTrade", () => {
    it("should allow a valid non-taxpayer low tier trade (incoming <= 175% + 100k)", () => {
      const teamAContracts = generateRoster(100_000_000); // 100M total
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(5_000_000)], // Outgoing A = 5M
        incomingAssets: [],
      };

      // Max allowed incoming for A is 5M * 1.75 + 100k = 8.85M
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(8_800_000)], // Incoming A = 8.8M
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should block an invalid non-taxpayer low tier trade", () => {
      const teamAContracts = generateRoster(100_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(5_000_000)],
        incomingAssets: [],
      };

      // Max allowed incoming for A is 5M * 1.75 + 100k = 8.85M
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(9_000_000)], // Incoming A = 9M (Too high)
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "SalaryMatchingError")).toBe(true);
    });

    it("should allow a valid non-taxpayer mid tier trade (incoming <= outgoing + 5M)", () => {
      const teamAContracts = generateRoster(100_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(20_000_000)], // Outgoing A = 20M
        incomingAssets: [],
      };

      // Max allowed incoming for A is 20M + 5M = 25M
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(24_000_000)], // Incoming A = 24M
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(true);
    });

    it("should allow a valid non-taxpayer high tier trade (incoming <= 125% + 100k)", () => {
      const teamAContracts = generateRoster(100_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(30_000_000)], // Outgoing A = 30M
        incomingAssets: [],
      };

      // Max allowed incoming for A is 30M * 1.25 + 100k = 37.6M
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(37_000_000)], // Incoming A = 37M
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(true);
    });

    it("should enforce taxpayer matching rules (incoming <= 125% + 100k)", () => {
      // First Apron is ~178M, Second is ~188M.
      // 180M starting salary puts us firmly in taxpayer territory.
      const teamAContracts = generateRoster(NBA_RULES.FIRST_APRON + 5_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(20_000_000)],
        incomingAssets: [],
      };

      // 20M * 1.25 + 100k = 25.1M max.
      // New salary = 183.1M - 20M + 25.1M = 188.2M (still under 188.9M Second Apron)
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(25_100_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(true);

      const pkgB_Invalid: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(25_200_000)],
        incomingAssets: [],
      };

      const resultInvalid = validator.validateTrade(
        teamAContracts,
        teamBContracts,
        pkgA,
        pkgB_Invalid
      );
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errors.some((e) => e.name === "SalaryMatchingError")).toBe(true);
    });

    it("should flag Hard Cap violations (HardCapError) if trade pushes team over Second Apron", () => {
      const teamAContracts = generateRoster(NBA_RULES.SECOND_APRON - 5_000_000); // 183.9M
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(10_000_000)],
        incomingAssets: [],
      };

      // Taking in 16M. New salary = 183.9M - 10M + 16M = 189.9M (Over Second Apron: 188.9M)
      // This will trigger a HardCapError because newTotalSalary > SECOND_APRON.
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(16_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "HardCapError")).toBe(true);
    });

    it("should return HardCapError for teams already over the Second Apron", () => {
      const teamAContracts = generateRoster(NBA_RULES.SECOND_APRON + 5_000_000); // 193.9M
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(20_000_000)],
        incomingAssets: [],
      };

      const pkgB_Valid: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(20_000_000)],
        incomingAssets: [],
      };

      const resultValid = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB_Valid);
      expect(resultValid.isValid).toBe(false); // Fails because of HardCapError
      expect(resultValid.errors.some((e) => e.name === "HardCapError")).toBe(true);
    });

    it("should flag Hard Cap violations (HardCapError) if trade pushes team over Second Apron", () => {
      const teamAContracts = generateRoster(NBA_RULES.SECOND_APRON - 5_000_000); // 183.9M
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(10_000_000)],
        incomingAssets: [],
      };

      // Taking in 16M. New salary = 183.9M - 10M + 16M = 189.9M (Over Second Apron: 188.9M)
      // Wait, is 16M allowed under taxpayer rules?
      // 189.9M > FIRST_APRON, so taxpayer rules apply? Wait. If new salary > SECOND_APRON,
      // it uses SECOND_APRON rules (incoming <= outgoing).
      // Here incoming (16M) > outgoing (10M), so it violates salary matching AND triggers a Hard Cap error!
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(16_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "HardCapError")).toBe(true);
    });

    it("should validate roster limits after trade", () => {
      const teamAContracts = generateRoster(100_000_000, 15); // Max roster
      const teamBContracts = generateRoster(100_000_000, 15);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(5_000_000)], // Sending 1 player
        incomingAssets: [],
      };

      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(2_500_000), createPlayerAsset(2_500_000)], // Receiving 2 players
        incomingAssets: [],
      };

      // Team A will have 15 - 1 + 2 = 16 players (Over limit)
      const result = validator.validateTrade(teamAContracts, teamBContracts, pkgA, pkgB);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "RosterSizeError")).toBe(true);
    });
  });
});
