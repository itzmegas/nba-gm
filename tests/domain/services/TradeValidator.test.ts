import { describe, expect, it } from "vitest";
import { NBA_RULES } from "@/domain/constants/nba-rules";
import type { Contract } from "@/domain/entities/Contract";
import type { TradeAsset, TradePackage, TradeTeamSnapshot } from "@/domain/entities/Trade";
import { TradeValidator } from "@/domain/services/TradeValidator";

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
  const snapshot = (contracts: Contract[], rosterSize = contracts.length): TradeTeamSnapshot => ({
    contracts,
    rosterSize,
  });

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

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
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

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
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

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
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

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
      expect(result.isValid).toBe(true);
    });

    it("should enforce taxpayer matching rules (incoming <= 125% + 100k)", () => {
      // Keep payroll strictly between the luxury-tax line and first apron.
      // This must use taxpayer matching even though it remains below the first apron.
      const teamAContracts = generateRoster(NBA_RULES.LUXURY_TAX + 1_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(20_000_000)],
        incomingAssets: [],
      };

      // 20M * 1.25 + 100k = 25.1M max.
      // Post-trade salary also remains strictly below the first apron.
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(25_100_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
      expect(result.isValid).toBe(true);

      const pkgB_Invalid: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(25_200_000)],
        incomingAssets: [],
      };

      const resultInvalid = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB_Invalid
      );
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errors.some((e) => e.name === "SalaryMatchingError")).toBe(true);
    });

    it("does not treat the second apron as a universal hard cap", () => {
      const teamAContracts = generateRoster(NBA_RULES.SECOND_APRON - 5_000_000); // 183.9M
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(10_000_000)],
        incomingAssets: [],
      };

      // Taking in 16M. New salary = 183.9M - 10M + 16M = 189.9M (Over Second Apron: 188.9M)
      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(16_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "SalaryMatchingError")).toBe(true);
      expect(result.errors.some((e) => e.name === "HardCapError")).toBe(false);
    });

    it("allows an equal-salary trade for a team already over the second apron", () => {
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

      const resultValid = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB_Valid
      );
      expect(resultValid.isValid).toBe(true);
      expect(resultValid.errors.some((e) => e.name === "HardCapError")).toBe(false);
    });

    it("enforces an explicitly triggered hard cap", () => {
      const hardCapLimit = NBA_RULES.FIRST_APRON;
      const teamAContracts = generateRoster(hardCapLimit - 1_000_000);
      const teamBContracts = generateRoster(100_000_000);

      const pkgA: TradePackage = {
        teamId: "A",
        teamName: "Team A",
        outgoingAssets: [createPlayerAsset(10_000_000)],
        incomingAssets: [],
      };

      const pkgB: TradePackage = {
        teamId: "B",
        teamName: "Team B",
        outgoingAssets: [createPlayerAsset(12_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        { ...snapshot(teamAContracts), hardCapLimit },
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "HardCapError")).toBe(true);
    });

    it("uses team names instead of identifiers in validation messages", () => {
      const pkgA: TradePackage = {
        teamId: "ee149566-1111-4111-8111-111111111111",
        teamName: "Philadelphia 76ers",
        outgoingAssets: [createPlayerAsset(5_000_000)],
        incomingAssets: [],
      };
      const pkgB: TradePackage = {
        teamId: "bbbbbbbb-1111-4111-8111-111111111111",
        teamName: "Los Angeles Lakers",
        outgoingAssets: [createPlayerAsset(9_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(generateRoster(100_000_000), 11),
        snapshot(generateRoster(100_000_000), 15),
        pkgA,
        pkgB,
        2024
      );

      expect(result.errors.map(({ message }) => message).join(" ")).not.toContain("ee149566");
      expect(result.errors.some(({ message }) => message.includes("Philadelphia 76ers"))).toBe(
        true
      );
    });

    it("applies season-adjusted thresholds to the 2026-27 salary base", () => {
      const pkgA: TradePackage = {
        teamId: "PHI",
        teamName: "Philadelphia 76ers",
        outgoingAssets: [createPlayerAsset(20_000_000)],
        incomingAssets: [],
      };
      const pkgB: TradePackage = {
        teamId: "LAL",
        teamName: "Los Angeles Lakers",
        outgoingAssets: [createPlayerAsset(22_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(generateRoster(190_000_000)),
        snapshot(generateRoster(190_000_000)),
        pkgA,
        pkgB,
        2026
      );

      expect(result.isValid).toBe(true);
      expect(result.errors.some(({ name }) => name === "HardCapError")).toBe(false);
    });

    it("keeps a mathematically correct post-trade roster minimum violation", () => {
      const pkgA: TradePackage = {
        teamId: "PHI",
        teamName: "Philadelphia 76ers",
        outgoingAssets: Array.from({ length: 4 }, () => createPlayerAsset(2_000_000)),
        incomingAssets: [],
      };
      const pkgB: TradePackage = {
        teamId: "LAL",
        teamName: "Los Angeles Lakers",
        outgoingAssets: [createPlayerAsset(8_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(generateRoster(100_000_000), 14),
        snapshot(generateRoster(100_000_000), 12),
        pkgA,
        pkgB,
        2024
      );

      expect(result.details.teamA.rosterSizeAfter).toBe(11);
      expect(
        result.errors.some(
          ({ name, message }) =>
            name === "RosterSizeError" && message.includes("Philadelphia 76ers")
        )
      ).toBe(true);
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
      const result = validator.validateTrade(
        snapshot(teamAContracts),
        snapshot(teamBContracts),
        pkgA,
        pkgB
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.name === "RosterSizeError")).toBe(true);
    });

    it("uses the visible roster size instead of counting contract rows", () => {
      const teamAContracts = generateRoster(100_000_000, 17);
      const teamBContracts = generateRoster(100_000_000, 8);
      const pkgA: TradePackage = {
        teamId: "PHI",
        teamName: "Philadelphia 76ers",
        outgoingAssets: [createPlayerAsset(5_000_000)],
        incomingAssets: [],
      };
      const pkgB: TradePackage = {
        teamId: "BOS",
        teamName: "Boston Celtics",
        outgoingAssets: [createPlayerAsset(5_000_000)],
        incomingAssets: [],
      };

      const result = validator.validateTrade(
        snapshot(teamAContracts, 14),
        snapshot(teamBContracts, 8),
        pkgA,
        pkgB
      );

      expect(result.details.teamA.rosterSizeAfter).toBe(14);
      expect(result.details.teamB.rosterSizeAfter).toBe(8);
      expect(result.errors.some((error) => error.message.includes("Roster size (17)"))).toBe(false);
    });
  });
});
