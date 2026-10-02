import { describe, expect, it } from "vitest";
import { CONTRACT_CAP_TREATMENT } from "@/domain/contracts/ContractClassification";
import { CONTRACT_IDENTITY_RESOLUTION_STATUS } from "@/domain/contracts/GameContract";
import {
  evaluateFreeAgencyOffer,
  type FreeAgencyCandidate,
  type FreeAgencyTeam,
  getEligibleFreeAgents,
} from "@/domain/freeAgency/freeAgencyMarket";

const gameId = "game-1";
const teamId = "team-1";
const playerId = "player-1";

function candidate(overrides: Partial<FreeAgencyCandidate> = {}): FreeAgencyCandidate {
  return {
    gameId,
    player: {
      id: playerId,
      firstName: "Alex",
      lastName: "Example",
      fullName: "Alex Example",
      yearsOfExperience: 4,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    playerState: {
      id: "state-1",
      gameId,
      playerId,
      morale: 50,
      fatigue: 0,
      isActive: true,
      isInjured: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    contractState: {
      playerId,
      resolutionStatus: CONTRACT_IDENTITY_RESOLUTION_STATUS.OBSERVED_STANDARD,
      contractType: null,
      provenanceQuality: null,
      sourceMethod: null,
      estimated: false,
      capTreatment: CONTRACT_CAP_TREATMENT.STANDARD,
      exclusionEvidence: null,
      agreement: null,
    },
    classification: "confirmed-unrestricted-free-agent",
    ...overrides,
  };
}

function team(overrides: Partial<FreeAgencyTeam> = {}): FreeAgencyTeam {
  return {
    gameId,
    teamId,
    payroll: 100_000_000,
    rosterCount: 12,
    roleOpportunity: 70,
    teamQuality: 60,
    ...overrides,
  };
}

describe("freeAgencyMarket", () => {
  it("includes only explicitly classified, teamless players from this game", () => {
    const eligible = candidate();
    const signed = candidate({
      playerState: { ...eligible.playerState, teamId },
    });
    const unknown = candidate({ classification: "unclassified" });
    const wrongGame = candidate({ gameId: "game-2" });
    const twoWay = candidate({
      contractState: {
        ...eligible.contractState,
        resolutionStatus: CONTRACT_IDENTITY_RESOLUTION_STATUS.OFFICIAL_TWO_WAY,
      },
    });

    expect(getEligibleFreeAgents(gameId, [eligible, signed, unknown, wrongGame, twoWay])).toEqual([
      eligible,
    ]);
  });

  it("allows a legal cap-room offer and explains money and team opportunity", () => {
    const result = evaluateFreeAgencyOffer({
      gameId,
      team: team({ payroll: 90_000_000 }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 10_000_000, years: 2 },
      simulationPolicy: { moneyWeight: 0.6, opportunityWeight: 0.25, teamQualityWeight: 0.15 },
    });

    expect(result.legal).toBe(true);
    expect(result.reasons.map(({ code }) => code)).toContain("cap-room");
    expect(result.reasons.map(({ code }) => code)).toContain("role-opportunity");
    expect(result.score).toBeGreaterThan(0);
  });

  it("allows the verified minimum salary exception but rejects unsupported salary and roster limits", () => {
    const minimum = evaluateFreeAgencyOffer({
      gameId,
      team: team({ payroll: 180_000_000 }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
    });
    const overRoom = evaluateFreeAgencyOffer({
      gameId,
      team: team({ payroll: 180_000_000 }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 10_000_000, years: 1 },
    });
    const fullRoster = evaluateFreeAgencyOffer({
      gameId,
      team: team({ rosterCount: 15 }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
    });

    expect(minimum.legal).toBe(true);
    expect(minimum.reasons.map(({ code }) => code)).toContain("minimum-salary-exception");
    expect(overRoom.legal).toBe(false);
    expect(fullRoster.reasons.map(({ code }) => code)).toContain("roster-maximum");
  });

  it("fails closed on malformed numbers, cross-game input, and unavailable salary schedules", () => {
    const malformed = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: Number.NaN, years: 1 },
    });
    const crossGame = evaluateFreeAgencyOffer({
      gameId,
      team: team({ gameId: "game-2" }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
    });
    const unknownSeason = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2027-28", annualSalary: 2_625_627, years: 1 },
    });

    expect(malformed.legal).toBe(false);
    expect(malformed.reasons.map(({ code }) => code)).toContain("invalid-offer");
    expect(crossGame.legal).toBe(false);
    expect(unknownSeason.reasons.map(({ code }) => code)).toContain("salary-schedule-unavailable");
  });

  it("rejects a salary above the supported service-tier maximum and a non-integer term", () => {
    const aboveMaximum = evaluateFreeAgencyOffer({
      gameId,
      team: team({ payroll: 90_000_000 }),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 50_000_000, years: 1 },
    });
    const fractionalTerm = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1.5 },
    });

    expect(aboveMaximum.legal).toBe(false);
    expect(aboveMaximum.reasons.map(({ code }) => code)).toContain("salary-above-maximum");
    expect(fractionalTerm.legal).toBe(false);
    expect(fractionalTerm.reasons.map(({ code }) => code)).toContain("invalid-offer");
  });

  it("rejects below-minimum salary and invalid player timestamps", () => {
    const belowMinimum = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_000_000, years: 1 },
    });
    const invalidDates = candidate({
      playerState: {
        ...candidate().playerState,
        updatedAt: new Date("invalid"),
      },
    });

    expect(belowMinimum.legal).toBe(false);
    expect(belowMinimum.reasons.map(({ code }) => code)).toContain("salary-below-minimum");
    expect(getEligibleFreeAgents(gameId, [invalidDates])).toEqual([]);
  });

  it("keeps evaluation scores and reason contributions finite for large finite weights", () => {
    const result = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      simulationPolicy: { moneyWeight: 0, opportunityWeight: 1e307, teamQualityWeight: 0 },
    });
    const contributions = result.reasons
      .map(({ contribution }) => contribution)
      .filter((value): value is number => value !== undefined);

    expect(result.legal).toBe(true);
    expect(result.score).toBeCloseTo(70);
    expect(contributions.every(Number.isFinite)).toBe(true);
    expect(contributions.reduce((total, value) => total + value, 0)).toBeCloseTo(result.score);
  });

  it("normalizes finite weights even when their unscaled sum overflows", () => {
    const result = evaluateFreeAgencyOffer({
      gameId,
      team: team(),
      candidate: candidate(),
      offer: { season: "2026-27", annualSalary: 2_625_627, years: 1 },
      simulationPolicy: {
        moneyWeight: 1e308,
        opportunityWeight: 1e308,
        teamQualityWeight: 1e308,
      },
    });
    const contributions = result.reasons
      .map(({ contribution }) => contribution)
      .filter((value): value is number => value !== undefined);

    expect(result.legal).toBe(true);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(contributions.every(Number.isFinite)).toBe(true);
    expect(contributions.reduce((total, value) => total + value, 0)).toBeCloseTo(result.score);
  });
});
