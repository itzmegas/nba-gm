// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import { DashboardSidebar } from "@/components/dashboard/layout-components";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { postseasonFixture } from "@/infrastructure/repositories/postseason.test-fixture";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "courtside-font", variable: "courtside-variable" }),
}));

const { postseason, offseason } = vi.hoisted(() => ({ postseason: vi.fn(), offseason: vi.fn() }));
const mobile = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

vi.mock("next/navigation", () => ({ usePathname: () => "/games/game/dashboard/roster" }));
vi.mock("@/application/hooks/postseason/usePostseason", () => ({
  usePostseason: postseason,
}));
vi.mock("@/application/hooks/offseason/useOffseason", () => ({
  useOffseason: offseason,
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({
    data: [
      {
        id: "team",
        name: "Chicago Bulls",
        city: "Chicago",
        conference: "East",
        logoUrl: "/team-logo.png",
      },
    ],
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

beforeEach(() => {
  mobile.value = false;
  useBatchSimulationStore.setState({
    isActive: false,
    stopRequested: false,
    mode: null,
    completedDays: 0,
    totalDays: null,
    error: null,
  });
  postseason.mockReturnValue({ data: undefined });
  offseason.mockReturnValue({ data: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSidebar(defaultOpen = true) {
  return render(
    <I18nProvider locale="en">
      <TooltipProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SidebarTrigger aria-label="Open navigation" />
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
  it("dismisses the mobile drawer when a real navigation route is selected", async () => {
    mobile.value = true;
    renderSidebar();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog", { name: "Sidebar" });
    const route = within(drawer).getByRole("link", { name: "Calendar" });
    expect(route.getAttribute("href")).toBe("/games/game/dashboard/schedule");
    fireEvent.click(route);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("preserves batch progress, exclusion and pause", () => {
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.MONTH, 30);
    useBatchSimulationStore.getState().updateProgress(12);
    renderSidebar();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("12");
    expect(screen.getByRole("button", { name: "Simulate day" }).hasAttribute("disabled")).toBe(
      true
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(useBatchSimulationStore.getState().stopRequested).toBe(true);
  });

  it("keeps simulation errors visible", () => {
    useBatchSimulationStore.getState().failBatch("Failed");
    renderSidebar();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("limits production typography to sidebar surfaces without activating the preview", () => {
    const { container } = renderSidebar();
    expect(container.querySelectorAll(".game-shell-sidebar.courtside-font")).toHaveLength(3);
    expect(document.documentElement.hasAttribute("data-ui-preview")).toBe(false);
    expect(screen.queryByText("Courtside")).toBeNull();
    expect(container.querySelector('[data-variant="sidebar"]')).toBeTruthy();
  });

  it("shows persisted offseason planning without enabling simulation or changing the season", () => {
    postseason.mockReturnValue({
      data: postseasonFixture({ phase: "complete", championTeamId: "team" }),
    });
    offseason.mockReturnValue({ data: { seasonYear: 2026, enteredAt: "2027-06-10T00:00:00Z" } });
    renderSidebar();
    expect(offseason).toHaveBeenCalledWith("game", 2026);
    expect(screen.getByRole("link", { name: "Offseason planning open" }).getAttribute("href")).toBe(
      "/games/game/dashboard/postseason"
    );
    expect(screen.getByText("Season complete")).toBeTruthy();
    expect(screen.getByText(/Starting the next season is not available/)).toBeTruthy();
    expect(screen.getByText("Oct 1, 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simulate day" }).hasAttribute("disabled")).toBe(
      true
    );
    expect(
      screen.getByRole("button", { name: "More simulation options" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("places Calendar immediately after Dashboard", () => {
    const { container } = renderSidebar();
    const links = [...container.querySelectorAll('[data-slot="sidebar-menu-button"]')];
    expect(links.slice(0, 2).map((link) => link.textContent?.trim())).toEqual([
      "Dashboard",
      "Calendar",
    ]);
    expect(links[1]?.getAttribute("href")).toBe("/games/game/dashboard/schedule");
  });

  it("shows compact franchise identity and localized conference", () => {
    renderSidebar();
    const identity = screen.getByRole("link", { name: "Chicago Bulls" });
    expect(identity.getAttribute("href")).toBe("/games/game/dashboard");
    expect(identity.querySelector("img")?.classList.contains("size-10")).toBe(true);
    expect(identity.querySelector("img")?.getAttribute("width")).toBe("40");
    expect(screen.getByText("Chicago Bulls", { exact: true })).toBeTruthy();
    expect(screen.getByText("Eastern Conference")).toBeTruthy();
    expect(screen.queryByText("Chicago", { exact: true })).toBeNull();
  });

  it("contains the whole team logo without a circular crop or flex shrinking", () => {
    renderSidebar();
    const logo = screen.getByRole("link", { name: "Chicago Bulls" }).querySelector("img");
    expect(logo?.classList.contains("object-contain")).toBe(true);
    expect(logo?.classList.contains("shrink-0")).toBe(true);
    expect(logo?.classList.contains("rounded-full")).toBe(false);
    expect(logo?.classList.contains("object-cover")).toBe(false);
    expect(logo?.classList.contains("size-10")).toBe(true);
  });

  it.each([true, false])("enlarges square navigation items with the sidebar open=%s", (open) => {
    const { container } = renderSidebar(open);
    const items = container.querySelectorAll('[data-slot="sidebar-menu-button"]');
    expect(items).toHaveLength(8);
    for (const item of items) {
      expect(item.classList.contains("h-11")).toBe(true);
      expect(item.classList.contains("text-sm")).toBe(true);
      expect(item.classList.contains("rounded-sm")).toBe(true);
      expect(item.classList.contains("[&_svg]:size-5")).toBe(true);
      expect(item.classList.contains("group-data-[collapsible=icon]:size-10!")).toBe(true);
    }
    const roster = screen.getByRole("link", { name: "Roster" });
    expect(roster.getAttribute("href")).toBe("/games/game/dashboard/roster");
    expect(roster.getAttribute("data-active")).toBe("true");
    expect(roster.getAttribute("aria-current")).toBe("page");
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="sidebar-group"]')).toHaveLength(3);
    expect(
      container.querySelector('[data-slot="sidebar"][data-state]')?.getAttribute("data-state")
    ).toBe(open ? "expanded" : "collapsed");
  });
});
