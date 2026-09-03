import { describe, expect, it } from "vitest";
import { CONTRACT_FALLBACK_BLOCK_REASON } from "@/domain/contracts/ContractClassification";
import { resolveContractFallback } from "@/domain/contracts/ContractFallback";

const base = {
  season: "2026-27",
  currentStandardSalary: null,
  isOfficialTwoWay: false,
  isActiveStandardRoster: true,
  isMatchedSourcePlayer: false,
  allowUnmatchedRosterExperienceFallback: false,
  yearsOfService: 1,
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
        allowUnmatchedRosterExperienceFallback: true,
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

  it("does not assume rookie experience for a matched source player", () => {
    expect(
      resolveContractFallback({
        ...base,
        isMatchedSourcePlayer: true,
        yearsOfService: null,
        allowUnmatchedRosterExperienceFallback: true,
      })
    ).toEqual({
      status: "blocked",
      reason: CONTRACT_FALLBACK_BLOCK_REASON.MISSING_YEARS_OF_SERVICE,
    });
  });

  it("does not silently bypass an unavailable official tracker", () => {
    expect(resolveContractFallback({ ...base, isOfficialTwoWay: null })).toEqual({
      status: "blocked",
      reason: CONTRACT_FALLBACK_BLOCK_REASON.TWO_WAY_SOURCE_UNAVAILABLE,
    });
  });

  it("excludes trustworthy inactive evidence without creating a contract", () => {
    expect(
      resolveContractFallback({
        ...base,
        allowUnmatchedRosterExperienceFallback: true,
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
        allowUnmatchedRosterExperienceFallback: true,
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
        allowUnmatchedRosterExperienceFallback: true,
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
