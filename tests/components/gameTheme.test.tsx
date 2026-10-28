// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { Features, transform } from "lightningcss";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { TeamThemeApplier } from "@/components/theme/team-theme-applier";
import { Button } from "@/components/ui/button";
import { TEAM_COLORS } from "@/domain/constants/team-colors";

const stylesheet = readFileSync("src/app/globals.css", "utf8");
const boundary = 'html[data-ui-preview="courtside"]';
const boundaryIndex = stylesheet.indexOf(boundary);
const productionStylesheet = stylesheet.slice(0, boundaryIndex);
// happy-dom cannot parse CSS nesting; use the installed Tailwind toolchain's CSS transformer.
const courtsideStylesheet = transform({
  filename: "courtside.css",
  code: Buffer.from(stylesheet.slice(boundaryIndex)),
  include: Features.Nesting,
}).code.toString();

afterEach(() => {
  cleanup();
  document.head.querySelector("style")?.remove();
  delete document.documentElement.dataset.uiPreview;
  delete document.documentElement.dataset.team;
  document.documentElement.classList.remove("dark");
});

function mountTheme(dark = false) {
  const style = document.createElement("style");
  style.textContent = productionStylesheet + courtsideStylesheet;
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

describe("isolated Courtside foundation", () => {
  const tokens = [
    "--background",
    "--foreground",
    "--sidebar",
    "--card",
    "--muted",
    "--border",
    "--primary",
    "--primary-foreground",
    "--cs-control",
    "--cs-control-border",
    "--font-sans",
  ];
  const readTokens = () => {
    const styles = getComputedStyle(document.documentElement);
    return tokens.map((token) =>
      styles
        .getPropertyValue(token)
        .trim()
        .replace(/^#fff$/, "#ffffff")
    );
  };

  it("has one explicit opt-in boundary and no unscoped appended rules", () => {
    expect(boundaryIndex).toBeGreaterThan(0);
    expect(stylesheet.match(/html\[data-ui-preview="courtside"\]/g)).toHaveLength(1);
    const style = document.createElement("style");
    style.textContent = courtsideStylesheet;
    document.head.append(style);
    const assertGated = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if ("selectorText" in rule) {
          expect(String(rule.selectorText)).toContain('html[data-ui-preview="courtside"]');
        } else if ("cssRules" in rule) {
          assertGated(rule.cssRules as CSSRuleList);
        }
      }
    };
    if (!style.sheet) throw new Error("Courtside stylesheet not mounted");
    expect(style.sheet.cssRules.length).toBeGreaterThan(0);
    assertGated(style.sheet.cssRules);
  });

  for (const dark of [false, true]) {
    it(`leaves production untouched and restores it after ${dark ? "dark" : "light"} preview`, () => {
      mountTheme(dark);
      const { getByRole } = render(<Button>Inspect</Button>);
      const button = getByRole("button", { name: "Inspect" });
      const style = document.head.querySelector("style");
      if (!style) throw new Error("Theme stylesheet not mounted");
      style.textContent = productionStylesheet;
      const originalTokens = readTokens();
      const originalRadius = getComputedStyle(button).borderRadius;
      style.textContent = productionStylesheet + courtsideStylesheet;
      button.parentElement?.append(button);
      expect(readTokens()).toEqual(originalTokens);
      expect(getComputedStyle(button).borderRadius).toBe(originalRadius);

      document.documentElement.dataset.uiPreview = "courtside";
      // happy-dom caches descendant styles after ancestor changes; reattach to recalculate.
      button.parentElement?.append(button);
      const styles = getComputedStyle(document.documentElement);
      const expectedSurfaces = dark
        ? ["#101114", "#f4f4f6", "#141518", "#191b1f", "#202227", "#2d2f35"]
        : ["#f4f4f6", "#202227", "#ececf0", "#ffffff", "#e8e9ee", "#d3d5dd"];
      expect(readTokens().slice(0, 6)).toEqual(expectedSurfaces);
      expect(styles.getPropertyValue("--cs-control-border").trim()).toBe(
        dark ? "#626674" : "#858893"
      );
      expect(getComputedStyle(button).borderRadius).toBe("4px");
      expect(getComputedStyle(button).minHeight).toBe("38px");
      expect(document.documentElement.classList.contains("dark")).toBe(dark);

      delete document.documentElement.dataset.uiPreview;
      button.parentElement?.append(button);
      expect(readTokens()).toEqual(originalTokens);
      expect(getComputedStyle(button).borderRadius).toBe(originalRadius);
    });

    it(`preserves all 30 primary pairs except the deliberate SAC reference in ${dark ? "dark" : "light"}`, () => {
      mountTheme(dark);
      expect(Object.keys(TEAM_COLORS)).toHaveLength(30);
      for (const team of Object.keys(TEAM_COLORS)) {
        document.documentElement.dataset.team = team;
        delete document.documentElement.dataset.uiPreview;
        const original = readTokens().slice(6, 8);
        document.documentElement.dataset.uiPreview = "courtside";
        expect(readTokens().slice(6, 8)).toEqual(
          team === "SAC" ? ["#713eb8", "#ffffff"] : original
        );
        const themed = getComputedStyle(document.documentElement);
        expect(themed.getPropertyValue("--secondary")).toBe(themed.getPropertyValue("--muted"));
        expect(themed.getPropertyValue("--accent")).toBe(themed.getPropertyValue("--muted"));
        expect(themed.getPropertyValue("--ring")).toBe(themed.getPropertyValue("--foreground"));
        if (team === "SAC") {
          const styles = getComputedStyle(document.documentElement);
          expect(styles.getPropertyValue("--cs-hover").trim()).toBe("#8250ca");
          expect(styles.getPropertyValue("--cs-ink").trim()).toBe(dark ? "#c9abf2" : "#63349e");
          expect(styles.getPropertyValue("--cs-soft").trim()).toBe(dark ? "#282035" : "#eee6f8");
        } else {
          const styles = getComputedStyle(document.documentElement);
          for (const token of ["--cs-hover", "--cs-ink", "--cs-soft"]) {
            expect(styles.getPropertyValue(token)).toContain("color-mix(");
          }
        }
      }
    });
  }

  it("inherits root tokens and geometry into a body-portal button without resizing compact buttons", () => {
    mountTheme(true);
    document.documentElement.dataset.team = "SAC";
    document.documentElement.dataset.uiPreview = "courtside";
    const { getByRole } = render(
      <section>
        {createPortal(<Button>Portal action</Button>, document.body)}
        <Button size="icon-xs" aria-label="Compact action" />
      </section>
    );
    const portalButton = getByRole("button", { name: "Portal action" });
    expect(portalButton.parentElement).toBe(document.body);
    // happy-dom resolves inherited var() values but does not expose inherited custom properties.
    expect(getComputedStyle(portalButton).backgroundColor).toBe("#713eb8");
    expect(getComputedStyle(portalButton).color).toBe("#fff");
    expect(getComputedStyle(portalButton).borderRadius).toBe("4px");
    expect(getComputedStyle(portalButton).minHeight).toBe("38px");
    expect(getComputedStyle(getByRole("button", { name: "Compact action" })).minHeight).not.toBe(
      "38px"
    );
    delete document.documentElement.dataset.uiPreview;
    portalButton.parentElement?.append(portalButton);
    expect(getComputedStyle(portalButton).borderRadius).not.toBe("4px");
  });
});
