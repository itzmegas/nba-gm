// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameDashboardLayout from "@/app/(protected)/games/[gameId]/dashboard/layout";
import { body, display } from "@/app/ui-preview/fonts";

vi.mock("next/font/local", () => ({
  default: ({ variable }: { variable: string }) => ({
    className: `${variable.slice(2)}-font`,
    variable: `${variable.slice(2)}-variable`,
  }),
}));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({
    data: {
      selectedTeamId: "team",
      seasonYear: 2026,
      name: "Test save",
      simulationDate: new Date("2026-10-01T00:00:00Z"),
    },
    isLoading: false,
  }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: () => ({ data: [] }) }));
vi.mock("@/application/providers/I18nProvider", () => ({ useT: () => () => "Dashboard" }));
vi.mock("@/components/theme/team-theme-applier", () => ({ TeamThemeApplier: () => null }));
vi.mock("@/components/dashboard/layout-components", () => ({
  DashboardHeader: () => <header>Header</header>,
  DashboardSidebar: () => <aside>Sidebar</aside>,
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const originalClasses = document.documentElement.className;
afterEach(() => {
  cleanup();
  document.documentElement.className = originalClasses;
});

describe("dashboard shell font lifecycle", () => {
  it.each([
    false,
    true,
  ])("cleans up only added font variables with preexisting body font=%s", (preexisting) => {
    const root = document.documentElement;
    root.classList.add("existing-shell", "dark", "system");
    if (preexisting) root.classList.add(body.variable);
    const before = [...root.classList].sort();
    const params = Object.assign(Promise.resolve({ gameId: "game" }), {
      status: "fulfilled",
      value: { gameId: "game" },
    });
    const { unmount } = render(
      <GameDashboardLayout params={params}>
        <p>Game content</p>
      </GameDashboardLayout>
    );
    expect(screen.getByText("Game content")).toBeTruthy();
    expect(root.classList.contains(body.variable)).toBe(true);
    expect(root.classList.contains(display.variable)).toBe(true);
    for (const name of before) expect(root.classList.contains(name)).toBe(true);
    unmount();
    expect([...root.classList].sort()).toEqual(before);
    expect(root.classList.contains(display.variable)).toBe(false);
    expect(root.classList.contains(body.variable)).toBe(preexisting);
  });
});
