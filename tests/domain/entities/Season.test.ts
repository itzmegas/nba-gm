import { describe, expect, it } from "vitest";
import {
  formatSalarySeasonLabel,
  formatSeasonLabel,
  getSalarySeasonYears,
  getYearsRemaining,
  isCurrentSalarySeason,
} from "@/domain/entities/Season";
import {
  DEFAULT_SEASON_ERA_ID,
  getSeasonEraById,
  SEASON_ERA_IDS,
  SEASON_ERAS,
} from "@/domain/entities/SeasonEra";

describe("Season helpers", () => {
  describe("formatSeasonLabel", () => {
    it("formats modern season labels", () => {
      expect(formatSeasonLabel(2024)).toBe("24-25");
    });

    it("formats historical season labels", () => {
      expect(formatSeasonLabel(1995)).toBe("95-96");
    });

    it("formats century rollover season labels", () => {
      expect(formatSeasonLabel(1999)).toBe("99-00");
    });
  });

  it("returns consecutive salary season years from the selected base season", () => {
    expect(getSalarySeasonYears(2025, 3)).toEqual([2025, 2026, 2027]);
  });

  it("returns an empty salary season list for non-positive counts", () => {
    expect(getSalarySeasonYears(2025, 0)).toEqual([]);
    expect(getSalarySeasonYears(2025, -1)).toEqual([]);
  });

  it("formats salary season labels with the shared season formatter", () => {
    expect(formatSalarySeasonLabel(2025)).toBe("25-26");
  });

  it("identifies the current salary season from the selected base season", () => {
    expect(isCurrentSalarySeason(2025, 2025)).toBe(true);
    expect(isCurrentSalarySeason(2025, 2026)).toBe(false);
  });

  it("calculates inclusive years remaining from the selected base season", () => {
    expect(getYearsRemaining(2025, 2025)).toBe(1);
    expect(getYearsRemaining(2025, 2027)).toBe(3);
    expect(getYearsRemaining(2025, 2024)).toBe(0);
  });
});

describe("Season era catalog", () => {
  it("exposes a default era from the catalog", () => {
    const defaultEra = getSeasonEraById(DEFAULT_SEASON_ERA_ID);

    expect(SEASON_ERAS).toContain(defaultEra);
  });

  it("marks the LeBron era as a historical dataset", () => {
    expect(getSeasonEraById(SEASON_ERA_IDS.LEBRON).isHistoricalDatasetAvailable).toBe(true);
  });

  it("marks the Jordan era as a historical dataset", () => {
    expect(getSeasonEraById(SEASON_ERA_IDS.JORDAN).isHistoricalDatasetAvailable).toBe(true);
  });

  it("describes the Jordan era with real rosters and approximate contracts", () => {
    const jordanEra = getSeasonEraById(SEASON_ERA_IDS.JORDAN);

    expect(jordanEra.description).toContain("1995-96");
    expect(jordanEra.description.toLowerCase()).toContain("aproximados");
  });
});
