import { describe, expect, it } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import {
  formatRosterSalary,
  getRosterContractClassification,
  shouldRenderRosterPlayer,
} from "@/components/roster/roster-table";

function rosterPlayer(gameContract: RosterPlayer["gameContract"]): RosterPlayer {
  return { player: { id: "player" }, contract: null, gameContract } as unknown as RosterPlayer;
}

describe("roster contract presentation", () => {
  it("renders unknown salary instead of zero", () => {
    expect(formatRosterSalary(null)).toBe("Unknown");
    expect(formatRosterSalary(undefined)).toBe("Unknown");
    expect(formatRosterSalary(0)).toBe("$0");
  });

  it("exposes two-way, estimated, and proven observed standard classifications", () => {
    expect(
      getRosterContractClassification(
        rosterPlayer({ contractType: "two-way", estimated: false } as RosterPlayer["gameContract"])
      ).label
    ).toBe("Two-Way");
    expect(
      getRosterContractClassification(
        rosterPlayer({ contractType: "standard", estimated: true } as RosterPlayer["gameContract"])
      ).label
    ).toBe("Estimated");
    expect(
      getRosterContractClassification(
        rosterPlayer({
          resolutionStatus: "observed-standard",
          contractType: "standard",
          provenanceQuality: "observed",
          estimated: false,
        } as RosterPlayer["gameContract"])
      ).label
    ).toBe("Standard");
  });

  it("renders unknown for missing or unrecognized contract state", () => {
    expect(getRosterContractClassification(rosterPlayer(null)).label).toBe("Unknown");
    expect(
      getRosterContractClassification(
        rosterPlayer({
          resolutionStatus: "unclassified",
          contractType: null,
          provenanceQuality: null,
          estimated: false,
        } as RosterPlayer["gameContract"])
      ).label
    ).toBe("Unknown");
    expect(
      getRosterContractClassification(
        rosterPlayer({
          resolutionStatus: "future-provider-status",
          contractType: "future-contract-type",
          provenanceQuality: "future-quality",
          estimated: false,
        } as unknown as RosterPlayer["gameContract"])
      ).label
    ).toBe("Unknown");
  });

  it("excludes inactive contract classifications from roster rendering", () => {
    expect(
      shouldRenderRosterPlayer(
        rosterPlayer({ resolutionStatus: "inactive-excluded" } as RosterPlayer["gameContract"])
      )
    ).toBe(false);
    expect(shouldRenderRosterPlayer(rosterPlayer(null))).toBe(true);
  });
});
