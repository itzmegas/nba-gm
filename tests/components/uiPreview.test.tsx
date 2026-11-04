// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UiPreviewPage from "@/app/ui-preview/page";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { UiPreview } from "@/components/design/ui-preview";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("next/font/local", () => ({
  default: ({ variable }: { variable: string }) => ({ variable: `${variable.slice(2)}-class` }),
}));

const { isMobile } = vi.hoisted(() => ({ isMobile: vi.fn(() => false) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: isMobile }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.uiPreview;
  document.documentElement.className = "";
  isMobile.mockReturnValue(false);
});

function renderPreview(fontClassName = "") {
  return render(
    <I18nProvider locale="en">
      <TooltipProvider>
        <UiPreview fontClassName={fontClassName} />
      </TooltipProvider>
    </I18nProvider>
  );
}

describe("isolated Courtside design system", () => {
  it("keeps the framed inset shell and franchise placeholder without a sidebar wordmark", () => {
    renderPreview();
    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute("data-variant")).toBe("inset");
    expect(sidebar?.textContent).not.toMatch(/courtside/i);
    expect(screen.getByText("Placeholder crest")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Simulation unavailable in catalog" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("shows fictional dashboard modules, financial charges and local-only destinations", () => {
    renderPreview();
    const dashboard = screen.getByRole("region", { name: "FRANCHISE AT A GLANCE" });
    expect(within(dashboard).getByText("Nearby standings")).toBeTruthy();
    expect(dashboard.querySelector('[aria-current="true"]')?.textContent).toContain(
      "SAC · Your franchise"
    );
    expect(within(dashboard).getByRole("img", { name: /release charges 4 million/ })).toBeTruthy();
    for (const link of within(dashboard).getAllByRole("link")) {
      const href = link.getAttribute("href");
      expect(href?.startsWith("#preview-")).toBe(true);
      expect(document.querySelector(href ?? "")).toBeTruthy();
    }
  });

  it("reviews loading, error and compact season-end states without real simulation", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Loading" }));
    expect(screen.getByLabelText("Loading dashboard sample").getAttribute("aria-busy")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByText(/Illustrative error: dashboard unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    expect(screen.getByText("SAC vs Harbor Comets")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Season end" }));
    expect(screen.getByText("No next game · season complete")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Postseason / offseason sample" }).getAttribute("href")
    ).toBe("#preview-postseason");
    expect(screen.queryByRole("button", { name: /next season/i })).toBeNull();
  });

  it("is unavailable outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiPreviewPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    vi.stubEnv("NODE_ENV", "development");
    expect(UiPreviewPage().type).toBe(UiPreview);
  });

  it("activates only the catalog and supports all 30 team themes without forcing dark mode", () => {
    const { unmount } = renderPreview();
    expect(document.documentElement.dataset.uiPreview).toBe("courtside");
    expect(document.documentElement.dataset.team).toBe("SAC");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getAllByRole("option")).toHaveLength(30);
    fireEvent.change(screen.getByLabelText("Franchise"), { target: { value: "LAL" } });
    expect(document.documentElement.dataset.team).toBe("LAL");
    unmount();
    expect(document.documentElement.dataset.uiPreview).toBeUndefined();
    expect(document.documentElement.dataset.team).toBeUndefined();
  });

  it("restores the previous root marker and only removes the font classes it added", () => {
    document.documentElement.dataset.uiPreview = "current";
    document.documentElement.className = "dark existing-font";
    const { unmount } = renderPreview("existing-font preview-body preview-display");
    expect(document.documentElement.classList.contains("preview-body")).toBe(true);
    expect(document.documentElement.classList.contains("preview-display")).toBe(true);
    unmount();
    expect(document.documentElement.dataset.uiPreview).toBe("current");
    expect(document.documentElement.className).toBe("dark existing-font");
  });

  it("uses native selection buttons and announces the selected fictional player", () => {
    renderPreview();
    const first = screen.getByRole("button", { name: "Select Alex Morgan" });
    const next = screen.getByRole("button", { name: "Select Jordan Williams-Smith" });
    expect(first.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(next);
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(next.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Selected: Jordan Williams-Smith");
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(
      screen.getByText("Overall rating 88 out of 100").parentElement?.classList.contains("relative")
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Unavailable" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Updating…" }).getAttribute("aria-busy")).toBe(
      "true"
    );
  });

  it("filters, sorts and changes table views without loading game data", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Player" }));
    expect(screen.getAllByRole("row")[1].textContent).toContain("Jordan Williams-Smith");
    fireEvent.change(screen.getByLabelText("Search players"), { target: { value: "Casey" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /contracts/i }));
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByText("Unverified")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search players"), { target: { value: "Not found" } });
    expect(screen.getByText("No sample players match these filters.")).toBeTruthy();
    const source = readFileSync("src/components/design/ui-preview.tsx", "utf8");
    expect(source).not.toMatch(/@\/application\/(hooks|stores)|@\/infrastructure|\bfetch\(/);
  });

  it("renders the existing dialog through a body portal and returns focus to its actual opener", async () => {
    renderPreview();
    const opener = screen.getByRole("button", { name: "Inspect sample" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Player identity specimen" });
    expect(document.querySelector("[data-slot=sidebar-wrapper]")?.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(document.documentElement.dataset.uiPreview).toBe("courtside");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close specimen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("keeps font configuration local to the preview route and uses real TrueType files", () => {
    const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
    expect(rootLayout).not.toContain("font-courtside");
    for (const name of ["Barlow-Regular", "Barlow-SemiBold", "BarlowCondensed-SemiBold"]) {
      expect(readFileSync(`src/app/ui-preview/fonts/${name}.ttf`).readUInt32BE(0)).toBe(0x00010000);
    }
    expect(readFileSync("src/app/ui-preview/fonts/OFL.txt", "utf8")).toContain(
      "SIL OPEN FONT LICENSE Version 1.1"
    );
  });

  it("dismisses the mobile navigation when a catalog destination is selected", async () => {
    isMobile.mockReturnValue(true);
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    const drawer = await screen.findByRole("dialog", { name: "Sidebar" });
    fireEvent.click(within(drawer).getByRole("link", { name: "Roster specimen" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull());
  });
});
