import { describe, expect, it } from "vitest";
import type { OffseasonContractOutlook } from "@/domain/entities/Offseason";
import type { OffseasonContract } from "@/domain/entities/OffseasonContract";
import type { OffseasonPlayerOption } from "@/domain/entities/OffseasonPlayerOption";
import { getOffseasonRosterProjection as project } from "@/domain/services/OffseasonRosterProjection";

const outlook: OffseasonContractOutlook = {
  status: "team_option",
  nextSalary: 100,
  estimated: false,
};
const plan: OffseasonContract = {
  playerId: "player",
  teamId: "team",
  seasonYear: 2026,
  status: "team_option",
  nextSalary: 100,
  decision: "exercise",
};
const option: OffseasonPlayerOption = {
  gameId: "career",
  playerId: "player",
  teamId: "team",
  seasonYear: 2026,
  currentSalary: 90,
  nextSalary: 100,
  decision: "exercise",
  reason: "salary_not_lower",
  policyVersion: "salary-comparison-v1",
  resolvedAt: "2027-06-10T00:00:00Z",
};

describe("read-only offseason roster projection", () => {
  it("distinguishes coverage, expiry, and unknown or estimated evidence", () => {
    expect(project({ ...outlook, status: "continuing" })).toBe("projectedCoverage");
    expect(project({ ...outlook, status: "expiring", nextSalary: null })).toBe(
      "projectedDeparture"
    );
    expect(project({ ...outlook, status: "unknown" }, plan)).toBe("projectedUnknown");
    expect(project({ ...outlook, estimated: true }, plan)).toBe("projectedUnknown");
  });
  it("uses saved team decisions without mutating inputs", () => {
    Object.freeze(outlook);
    Object.freeze(plan);
    expect(project(outlook, plan)).toBe("projectedExercise");
    expect(project(outlook, { ...plan, decision: "decline" })).toBe("projectedDeparture");
    expect(project(outlook, { ...plan, decision: null })).toBe("projectedPending");
    expect(project(outlook)).toBe("projectedPending");
    expect(plan.decision).toBe("exercise");
  });
  it("uses saved player decisions, never the salary heuristic", () => {
    const playerOutlook = { ...outlook, status: "player_option" } as const;
    const playerPlan = { ...plan, status: "player_option", decision: null } as const;
    expect(project(playerOutlook, playerPlan)).toBe("projectedPending");
    expect(project(playerOutlook, playerPlan, option)).toBe("projectedExercise");
    expect(
      project(playerOutlook, playerPlan, { ...option, decision: "decline", reason: "salary_lower" })
    ).toBe("projectedDeparture");
  });
  it("does not trust conflicting classifications or salaries", () => {
    expect(project(outlook, { ...plan, status: "expiring" })).toBe("projectedUnknown");
    expect(project(outlook, { ...plan, nextSalary: 200 })).toBe("projectedUnknown");
    expect(
      project({ ...outlook, status: "player_option" }, undefined, { ...option, nextSalary: 200 })
    ).toBe("projectedUnknown");
    expect(project({ ...outlook, nextSalary: null })).toBe("projectedPending");
  });
  it("preserves zero as a known salary", () => {
    expect(project({ ...outlook, nextSalary: 0 }, { ...plan, nextSalary: 0 })).toBe(
      "projectedExercise"
    );
  });
});
