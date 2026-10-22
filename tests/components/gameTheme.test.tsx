// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamThemeApplier } from "@/components/theme/team-theme-applier";
import { TEAM_COLORS } from "@/domain/constants/team-colors";

const stylesheet = readFileSync("src/app/globals.css", "utf8");

afterEach(() => {
  cleanup();
  document.head.querySelector("style")?.remove();
  delete document.documentElement.dataset.uiPreview;
  document.documentElement.classList.remove("dark");
});

function mountTheme(dark = false) {
  const style = document.createElement("style");
  style.textContent = stylesheet;
  document.head.append(style);
  document.documentElement.classList.toggle("dark", dark);
  return render(<TeamThemeApplier teamAbbreviation="CHI" />);
}

describe("approved game theme", () => {
  for (const dark of [false, true]) {
    it(`neutralizes interactions without replacing franchise colors in ${dark ? "dark" : "light"} mode`, () => {
      mountTheme(dark);
      for (const team of Object.keys(TEAM_COLORS)) {
        document.documentElement.dataset.team = team;
        document.documentElement.dataset.uiPreview = "current";
        const preservedTokens = [
          "--primary",
          "--primary-foreground",
          "--sidebar-primary",
          "--sidebar-primary-foreground",
          "--chart-1",
          "--chart-2",
          "--chart-3",
          "--chart-4",
          "--chart-5",
          "--radius",
        ];
        const before = getComputedStyle(document.documentElement);
        const values = preservedTokens.map((token) => before.getPropertyValue(token));
        delete document.documentElement.dataset.uiPreview;
        const styles = getComputedStyle(document.documentElement);
        expect(styles.getPropertyValue("--background").trim()).toBe(dark ? "#141416" : "#f4f4f5");
        expect(styles.getPropertyValue("--secondary")).toBe(styles.getPropertyValue("--muted"));
        expect(styles.getPropertyValue("--accent")).toBe(styles.getPropertyValue("--muted"));
        expect(styles.getPropertyValue("--sidebar").trim()).toBe(dark ? "#1c1c1f" : "#fafafa");
        expect(styles.getPropertyValue("--ring").trim()).toBe(dark ? "#d4d4d8" : "#52525b");
        expect(preservedTokens.map((token) => styles.getPropertyValue(token))).toEqual(values);
      }
    });
  }

  it("keeps the historical preview comparison and removes game styles on exit", () => {
    const { unmount } = mountTheme();
    document.documentElement.dataset.uiPreview = "current";
    expect(getComputedStyle(document.documentElement).getPropertyValue("--background").trim()).toBe(
      "oklch(1 0 0)"
    );
    document.documentElement.dataset.uiPreview = "proposed";
    expect(getComputedStyle(document.documentElement).getPropertyValue("--background").trim()).toBe(
      "#f4f4f5"
    );
    delete document.documentElement.dataset.uiPreview;
    unmount();
    expect(document.documentElement.dataset.team).toBeUndefined();
    expect(getComputedStyle(document.documentElement).getPropertyValue("--background").trim()).toBe(
      "oklch(1 0 0)"
    );
  });
});
