import { describe, expect, it } from "vitest";
import type { Contract } from "../../../src/domain/entities/Contract";
import { RosterValidator } from "../../../src/domain/services/RosterValidator";

describe("RosterValidator", () => {
  const validator = new RosterValidator();

  const createRoster = (size: number): Contract[] => {
    return Array.from({ length: size }, () => ({}) as Contract);
  };

  describe("validateRosterLimits", () => {
    describe("In-season", () => {
      it("should be valid for roster sizes between 12 and 15", () => {
        expect(validator.validateRosterLimits(createRoster(12)).isValid).toBe(true);
        expect(validator.validateRosterLimits(createRoster(14)).isValid).toBe(true);
        expect(validator.validateRosterLimits(createRoster(15)).isValid).toBe(true);
      });

      it("should return error if roster size is below 12", () => {
        const result = validator.validateRosterLimits(createRoster(11));
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("below minimum");
      });

      it("should return error if roster size is above 15", () => {
        const result = validator.validateRosterLimits(createRoster(16));
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("exceeds maximum");
      });
    });

    describe("Offseason", () => {
      it("should be valid for roster sizes up to 21", () => {
        expect(validator.validateRosterLimits(createRoster(10), true).isValid).toBe(true);
        expect(validator.validateRosterLimits(createRoster(21), true).isValid).toBe(true);
      });

      it("should return error if roster size is above 21", () => {
        const result = validator.validateRosterLimits(createRoster(22), true);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("exceeds maximum allowed (21)");
      });
    });
  });
});
