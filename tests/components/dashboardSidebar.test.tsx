// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { DashboardSidebar } from "@/components/dashboard/layout-components";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next/navigation", () => ({ usePathname: () => "/games/game/dashboard/roster" }));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({
    data: [{ id: "team", name: "Chicago Bulls", city: "Chicago", logoUrl: "/team-logo.png" }],
  }),
}));
vi.mock("@/application/hooks/simulation", () => ({
  getMonthEnd: () => "2026-10-31",
  useAdvanceRange: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/application/hooks/simulation/useAdvanceDay", () => ({
  useAdvanceDay: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/application/hooks/simulation/useCurrentTeamGame", () => ({
  useCurrentTeamGame: () => ({ data: undefined, isPending: false, isError: false }),
}));

afterEach(cleanup);

function renderSidebar(defaultOpen = true) {
  return render(
    <I18nProvider locale="en">
      <TooltipProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <DashboardSidebar
            gameId="game"
            selectedTeamId="team"
            simulationDate={new Date("2026-10-01T00:00:00Z")}
            seasonYear={2026}
          />
        </SidebarProvider>
      </TooltipProvider>
    </I18nProvider>
  );
}

describe("game sidebar visual adjustments", () => {
  it("places Calendar immediately after Dashboard", () => {
    const { container } = renderSidebar();
    const links = [...container.querySelectorAll('[data-slot="sidebar-menu-button"]')];
    expect(links.slice(0, 2).map((link) => link.textContent?.trim())).toEqual([
      "Dashboard",
      "Calendar",
    ]);
    expect(links[1]?.getAttribute("href")).toBe("/games/game/dashboard/schedule");
  });

  it("centers a larger logo without visible identity text and preserves the link name", () => {
    renderSidebar();
    const identity = screen.getByRole("link", { name: "Chicago Bulls" });
    expect(identity.getAttribute("href")).toBe("/games/game/dashboard");
    expect(identity.classList.contains("justify-center")).toBe(true);
    expect(identity.querySelector("img")?.classList.contains("size-28")).toBe(true);
    expect(screen.queryByText("Chicago Bulls", { exact: true })).toBeNull();
    expect(screen.queryByText("Chicago", { exact: true })).toBeNull();
  });

  it("contains the whole team logo without a circular crop or flex shrinking", () => {
    renderSidebar();
    const logo = screen.getByRole("link", { name: "Chicago Bulls" }).querySelector("img");
    expect(logo?.classList.contains("object-contain")).toBe(true);
    expect(logo?.classList.contains("shrink-0")).toBe(true);
    expect(logo?.classList.contains("rounded-full")).toBe(false);
    expect(logo?.classList.contains("object-cover")).toBe(false);
    expect(logo?.classList.contains("group-data-[collapsible=icon]:size-12")).toBe(true);
  });

  it.each([true, false])("enlarges square navigation items with the sidebar open=%s", (open) => {
    const { container } = renderSidebar(open);
    const items = container.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(item.classList.contains("h-11")).toBe(true);
      expect(item.classList.contains("text-base")).toBe(true);
      expect(item.classList.contains("rounded-none")).toBe(true);
      expect(item.classList.contains("[&_svg]:size-5")).toBe(true);
      expect(item.classList.contains("group-data-[collapsible=icon]:size-11!")).toBe(true);
    }
    const roster = screen.getByRole("link", { name: "Roster" });
    expect(roster.getAttribute("href")).toBe("/games/game/dashboard/roster");
    expect(roster.getAttribute("data-active")).toBe("true");
    expect(
      container.querySelector('[data-slot="sidebar"][data-state]')?.getAttribute("data-state")
    ).toBe(open ? "expanded" : "collapsed");
  });
});
