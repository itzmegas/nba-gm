// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import {
  BATCH_SIMULATION_MODE,
  useBatchSimulationStore,
} from "@/application/stores/useBatchSimulationStore";
import { DashboardSidebar } from "@/components/dashboard/layout-components";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const { day, range } = vi.hoisted(() => ({ day: vi.fn(), range: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/games/game/dashboard" }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: () => ({ data: [] }) }));
vi.mock("@/application/hooks/simulation", () => ({
  getMonthEnd: () => "2026-10-31",
  useAdvanceRange: () => ({ isPending: false, mutate: range }),
}));
vi.mock("@/application/hooks/simulation/useAdvanceDay", () => ({
  useAdvanceDay: () => ({ isPending: false, isError: false, mutate: day }),
}));
vi.mock("@/application/hooks/simulation/useCurrentTeamGame", () => ({
  useCurrentTeamGame: () => ({
    data: {
      homeTeamId: "opponent",
      awayTeamId: "team",
      status: "completed",
      homeScore: 102,
      awayScore: 114,
    },
    isPending: false,
    isError: false,
  }),
}));

function renderSidebar(date = "2026-10-29", open = true) {
  return render(
    <I18nProvider locale="en">
      <TooltipProvider>
        <SidebarProvider defaultOpen={open}>
          <DashboardSidebar
            gameId="game"
            selectedTeamId="team"
            simulationDate={new Date(`${date}T00:00:00Z`)}
            seasonYear={2026}
          />
        </SidebarProvider>
      </TooltipProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBatchSimulationStore.setState({
    isActive: false,
    stopRequested: false,
    mode: null,
    completedDays: 0,
    totalDays: null,
    error: null,
  });
});
afterEach(cleanup);

describe("dashboard simulation controls", () => {
  it("keeps daily advance visible and puts longer ranges in a keyboard-accessible menu", async () => {
    renderSidebar();
    expect(screen.queryByText("Simulate month")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Simulate day" }));
    expect(day).toHaveBeenCalledWith({
      gameId: "game",
      simulationDate: new Date("2026-10-29T00:00:00Z"),
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "More simulation options" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Simulate month" }));
    expect(range).toHaveBeenCalledWith({
      gameId: "game",
      simulationDate: new Date("2026-10-29T00:00:00Z"),
      mode: "month",
      seasonYear: 2026,
    });
  });

  it("shows next-game progress, disables overlapping actions, and pauses", () => {
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 5);
    useBatchSimulationStore.getState().updateProgress(2);
    renderSidebar();
    expect(screen.getByRole("status").textContent).toBe("2 days completed of 5");
    expect(
      (screen.getByRole("button", { name: "Simulate day" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "More simulation options" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(useBatchSimulationStore.getState().stopRequested).toBe(true);
    expect((screen.getByRole("button", { name: "Pausing…" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("does not show batch progress or pause for a single day", () => {
    useBatchSimulationStore.getState().startDay();
    renderSidebar();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause simulation" })).toBeNull();
    expect(screen.queryByText(/days completed/)).toBeNull();
  });

  it("keeps pause accessible in the collapsed rail", () => {
    useBatchSimulationStore.getState().startBatch(BATCH_SIMULATION_MODE.NEXT_GAME, 5);
    renderSidebar("2026-10-29", false);
    fireEvent.click(screen.getByRole("button", { name: "Pause simulation" }));
    expect(useBatchSimulationStore.getState().stopRequested).toBe(true);
  });

  it("renders a committed score from the selected team's perspective", () => {
    renderSidebar();
    expect(screen.getByText(/Final 114-102/)).toBeDefined();
  });

  it("disables all advance actions after the season endpoint", () => {
    renderSidebar("2027-04-15");
    expect(
      (screen.getByRole("button", { name: "Simulate day" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "More simulation options" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("shows errors without fabricating completed progress", () => {
    useBatchSimulationStore.getState().failBatch("temporary failure");
    renderSidebar();
    expect(screen.getByRole("alert").textContent).toBe("Unable to advance the simulation.");
    expect(screen.queryByText(/days completed/)).toBeNull();
  });
});
