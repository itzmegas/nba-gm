import { describe, expect, it } from "vitest";
import { CONTRACT_FALLBACK_BLOCK_REASON } from "@/domain/contracts/ContractClassification";
import { resolveContractFallback } from "@/domain/contracts/ContractFallback";

const base = {
  season: "2026-27",
  currentStandardSalary: null,
  isOfficialTwoWay: false,
  isActiveStandardRoster: true,
  allowCurrentRosterExperienceFallback: false,
  yearsOfService: 1,
  age: 23,
  inactiveEvidence: null,
};

describe("resolveContractFallback", () => {
  it("preserves observed salary before every fallback", () => {
    expect(resolveContractFallback({ ...base, currentStandardSalary: 2_000_000 })).toMatchObject({
      status: "resolved",
      salaryAmount: 2_000_000,
      estimated: false,
      contractType: "standard",
    });
  });

  it("classifies official two-way compensation as unknown and cap-excluded", () => {
    expect(resolveContractFallback({ ...base, isOfficialTwoWay: true })).toMatchObject({
      status: "resolved",
      salaryAmount: null,
      contractType: "two-way",
      capTreatment: "excluded-two-way",
    });
  });

  it("estimates the verified minimum for an eligible active player", () => {
    expect(resolveContractFallback(base)).toMatchObject({
      status: "resolved",
      salaryAmount: 2_185_116,
      estimated: true,
    });
  });

  it("estimates the 2026-27 rookie minimum when current-roster ESPN experience is omitted", () => {
    expect(
      resolveContractFallback({
        ...base,
        yearsOfService: null,
        allowCurrentRosterExperienceFallback: true,
      })
    ).toMatchObject({
      status: "resolved",
      salaryAmount: 1_357_763,
      estimated: true,
      method: "current-roster-espn-omitted-experience-minimum",
      capTreatment: "standard-cap-and-matching",
      evidence: {
        assumption: "espn-omitted-experience-assumed-zero-years-of-service",
      },
    });
  });

  it.each([
    { age: 30, salaryAmount: 1_357_763, assumedYearsOfService: 0 },
    { age: 31, salaryAmount: 3_876_529, assumedYearsOfService: 10 },
    { age: 40, salaryAmount: 3_876_529, assumedYearsOfService: 10 },
    { age: null, salaryAmount: 1_357_763, assumedYearsOfService: 0 },
  ])("estimates $salaryAmount for missing experience at age $age", ({
    age,
    salaryAmount,
    assumedYearsOfService,
  }) => {
    expect(
      resolveContractFallback({
        ...base,
        age,
        yearsOfService: null,
        allowCurrentRosterExperienceFallback: true,
      })
    ).toMatchObject({
      status: "resolved",
      salaryAmount,
      estimated: true,
      quality: "estimated",
      evidence: {
        age,
        assumedYearsOfService,
        assumption:
          assumedYearsOfService === 10
            ? "espn-omitted-experience-age-over-30-assumed-ten-years-of-service"
            : "espn-omitted-experience-assumed-zero-years-of-service",
      },
    });
  });

  it("uses known service instead of age when estimating the minimum", () => {
    expect(
      resolveContractFallback({
        ...base,
        age: 35,
        yearsOfService: 2,
        allowCurrentRosterExperienceFallback: true,
      })
    ).toMatchObject({
      salaryAmount: 2_449_421,
      method: "years-of-service-minimum",
    });
  });

  it("does not replace an observed salary or official two-way classification with an age estimate", () => {
    const input = {
      ...base,
      age: 35,
      yearsOfService: null,
      allowCurrentRosterExperienceFallback: true,
    };
    expect(resolveContractFallback({ ...input, currentStandardSalary: 9_000_000 })).toMatchObject({
      salaryAmount: 9_000_000,
      estimated: false,
    });
    expect(resolveContractFallback({ ...input, isOfficialTwoWay: true })).toMatchObject({
      contractType: "two-way",
      salaryAmount: null,
      estimated: false,
    });
  });

  it("does not silently bypass an unavailable official tracker", () => {
    expect(
      resolveContractFallback({
        ...base,
        yearsOfService: null,
        isOfficialTwoWay: null,
        allowCurrentRosterExperienceFallback: true,
      })
    ).toEqual({
      status: "blocked",
      reason: CONTRACT_FALLBACK_BLOCK_REASON.TWO_WAY_SOURCE_UNAVAILABLE,
    });
  });

  it("excludes trustworthy inactive evidence without creating a contract", () => {
    expect(
      resolveContractFallback({
        ...base,
        allowCurrentRosterExperienceFallback: true,
        inactiveEvidence: {
          sourceUrl: "https://example.com/status",
          observedDate: "2026-06-29",
          evidence: "Waived",
        },
      })
    ).toMatchObject({ status: "excluded", capTreatment: "excluded-inactive" });
  });

  it("gates inactive players before observed, two-way, or estimated salary resolution", () => {
    expect(
      resolveContractFallback({
        ...base,
        currentStandardSalary: 9_000_000,
        isOfficialTwoWay: true,
        allowCurrentRosterExperienceFallback: true,
        inactiveEvidence: {
          sourceUrl: "https://example.com/status",
          observedDate: "2026-06-29",
          evidence: "Waived",
        },
      })
    ).toMatchObject({ status: "excluded", capTreatment: "excluded-inactive" });
  });

  it("never estimates a player outside the active current roster", () => {
    expect(
      resolveContractFallback({
        ...base,
        allowCurrentRosterExperienceFallback: true,
        isActiveStandardRoster: false,
        yearsOfService: null,
      })
    ).toMatchObject({ status: "excluded", capTreatment: "excluded-inactive" });
  });

  it("keeps unknown experience as a typed minimum blocker", () => {
    expect(resolveContractFallback({ ...base, yearsOfService: null })).toEqual({
      status: "blocked",
      reason: CONTRACT_FALLBACK_BLOCK_REASON.MISSING_YEARS_OF_SERVICE,
    });
  });
});
