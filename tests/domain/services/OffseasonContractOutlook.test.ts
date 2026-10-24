import { describe, expect, it } from "vitest";
import type {
  GameContractAgreement,
  GamePlayerContractState,
} from "@/domain/contracts/GameContract";
import type { Contract } from "@/domain/entities/Contract";
import { getOffseasonContractOutlook as outlook } from "@/domain/services/OffseasonContractOutlook";

const season: GameContractAgreement["seasons"][number] = {
  seasonLabel: "2026-27",
  startYear: 2026,
  endYear: 2027,
  salaryAmount: 10_000_000,
  optionKind: "none",
  guaranteeKind: "unknown",
};

function canonical(overrides: Partial<GameContractAgreement> = {}): GamePlayerContractState {
  return {
    playerId: "player",
    resolutionStatus: "observed-standard",
    contractType: "standard",
    provenanceQuality: "observed",
    sourceMethod: "basketball-reference-current-salary",
    estimated: false,
    capTreatment: "standard-cap-and-matching",
    exclusionEvidence: null,
    agreement: {
      id: "agreement",
      gameId: "game",
      playerId: "player",
      teamId: "team",
      startSeasonLabel: null,
      endSeasonLabel: null,
      remainingGuaranteedAmount: null,
      contractType: "standard",
      provenanceQuality: "observed",
      sourceMethod: "basketball-reference-current-salary",
      estimated: false,
      capTreatment: "standard-cap-and-matching",
      seasons: [season],
      ...overrides,
    },
  };
}

function legacy(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract",
    gameId: "game",
    playerId: "player",
    teamId: "team",
    startYear: 2026,
    endYear: 2027,
    salaryY1: 10_000_000,
    salaryY2: 11_000_000,
    isPlayerOption: false,
    isTeamOption: false,
    isGuaranteed: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe("offseason contract outlook", () => {
  it("does not turn the last observed salary into a claimed contract expiration", () => {
    const projected = legacy({
      compatibilityProjection: "observed-season-coverage",
      endYear: 2026,
    });
    expect(outlook(projected, canonical(), 2026)).toEqual({
      status: "unknown",
      nextSalary: null,
      estimated: false,
    });
    expect(outlook(projected, null, 2026).status).toBe("unknown");
  });

  it("reports expiration only from an explicit current-season agreement boundary", () => {
    expect(outlook(null, canonical({ endSeasonLabel: "2026-27" }), 2026)).toEqual({
      status: "expiring",
      nextSalary: null,
      estimated: false,
    });
  });

  it.each([
    ["player", "player_option"],
    ["team", "team_option"],
    ["none", "continuing"],
    ["unknown", "unknown"],
  ] as const)("reads the next season's %s option, not the current season's", (optionKind, status) => {
    const state = canonical({
      seasons: [
        { ...season, optionKind: "team" },
        {
          seasonLabel: "2027-28",
          startYear: 2027,
          endYear: 2028,
          salaryAmount: 12_000_000,
          optionKind,
          guaranteeKind: "unknown",
        },
      ],
    });
    const before = structuredClone(state);
    expect(outlook(null, state, 2026)).toEqual({
      status,
      nextSalary: 12_000_000,
      estimated: false,
    });
    expect(state).toEqual(before);
  });

  it("keeps unknown two-way/estimated salary and boundaries unknown rather than zero", () => {
    const estimated = canonical({ estimated: true, seasons: [] });
    estimated.estimated = true;
    expect(outlook(null, estimated, 2026)).toEqual({
      status: "unknown",
      nextSalary: null,
      estimated: true,
    });
    expect(outlook(null, { ...canonical(), agreement: null }, 2026).status).toBe("unknown");
    expect(outlook(legacy(), { ...canonical(), agreement: null }, 2026).status).toBe("unknown");
  });

  it("does not resolve inconsistent boundaries or infer missing future seasons", () => {
    const next = {
      ...season,
      startYear: 2027,
      endYear: 2028,
      seasonLabel: "2027-28",
    };
    expect(
      outlook(null, canonical({ endSeasonLabel: "2026-27", seasons: [next] }), 2026).status
    ).toBe("unknown");
    expect(outlook(null, canonical({ endSeasonLabel: "2028-29" }), 2026).status).toBe("unknown");
  });

  it("does not treat blank future columns as coverage and preserves a known zero", () => {
    const next = { ...season, startYear: 2027, endYear: 2028, seasonLabel: "2027-28" };
    for (const salaryAmount of [null, 0])
      expect(outlook(null, canonical({ seasons: [{ ...next, salaryAmount }] }), 2026)).toEqual({
        status: salaryAmount === null ? "unknown" : "continuing",
        nextSalary: salaryAmount,
        estimated: false,
      });
  });

  it("does not treat a materialized minimum-salary estimate as an observed expiry", () => {
    const state = canonical({
      startSeasonLabel: "2026-27",
      endSeasonLabel: "2026-27",
      provenanceQuality: "estimated",
      estimated: true,
    });
    state.estimated = true;
    state.provenanceQuality = "estimated";
    expect(outlook(null, state, 2026)).toEqual({
      status: "unknown",
      nextSalary: null,
      estimated: true,
    });
  });

  it("can show an evidenced option without a known salary", () => {
    const next = { ...season, startYear: 2027, endYear: 2028, seasonLabel: "2027-28" };
    expect(
      outlook(
        null,
        canonical({ seasons: [{ ...next, salaryAmount: null, optionKind: "team" }] }),
        2026
      )
    ).toEqual({
      status: "team_option",
      nextSalary: null,
      estimated: false,
    });
  });

  it("lets simulated contracts override immutable source agreements", () => {
    expect(
      outlook(legacy({ origin: "simulated-agreement", endYear: 2026 }), canonical(), 2026)
    ).toEqual({
      status: "expiring",
      nextSalary: null,
      estimated: false,
    });
  });

  it("handles legacy expiry, final-year options and missing salaries without extrapolating", () => {
    expect(outlook(legacy({ endYear: 2026 }), null, 2026).status).toBe("expiring");
    expect(outlook(legacy({ isTeamOption: true }), null, 2026)).toEqual({
      status: "team_option",
      nextSalary: 11_000_000,
      estimated: false,
    });
    expect(outlook(legacy({ isPlayerOption: true }), null, 2026).status).toBe("player_option");
    expect(outlook(legacy({ isTeamOption: true, endYear: 2028 }), null, 2026).status).toBe(
      "continuing"
    );
    expect(outlook(legacy({ salaryY2: undefined }), null, 2026).nextSalary).toBeNull();
    expect(outlook(legacy({ isPlayerOption: true, isTeamOption: true }), null, 2026).status).toBe(
      "unknown"
    );
    expect(outlook(legacy({ endYear: 2025 }), null, 2026).status).toBe("unknown");
    expect(outlook(null, null, 2026).status).toBe("unknown");
  });
});
