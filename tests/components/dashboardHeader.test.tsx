// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { DashboardHeader } from "@/components/dashboard/layout-components";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "courtside-font", variable: "courtside-variable" }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({ data: [{ id: "team", name: "Chicago Bulls", logoUrl: "/logo.png" }] }),
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

afterEach(cleanup);

describe("dashboard header", () => {
  it("shows franchise, season, simulation date and role while preserving shell controls", () => {
    const { container } = render(
      <I18nProvider locale="en">
        <SidebarProvider>
          <DashboardHeader
            gameId="game"
            gameName="Test save"
            selectedTeamId="team"
            seasonYear={2026}
            simulationDate={new Date("2026-10-01T00:00:00Z")}
          />
        </SidebarProvider>
      </I18nProvider>
    );
    expect(container.querySelector("header")?.classList.contains("min-h-[88px]")).toBe(true);
    expect(screen.getByRole("link", { name: /Chicago Bulls/ }).getAttribute("href")).toBe(
      "/games/game/dashboard"
    );
    expect(screen.getByText(/26-27/)).toBeTruthy();
    expect(screen.getByText("Oct 1, 2026")).toBeTruthy();
    expect(screen.getByText("General Manager")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Theme" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Game menu" }), {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    expect(screen.getByText("Test save")).toBeTruthy();
    expect(screen.getByRole("menuitem").getAttribute("href")).toBe("/");
  });
});
