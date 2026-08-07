import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/dashboard/layout-components";

interface BatchRenderState {
  isActive: boolean;
  stopRequested: boolean;
  mode: "month" | "season" | null;
  completedDays: number;
  totalDays: number | null;
  error: string | null;
}

let batchState: BatchRenderState = {
  isActive: true,
  stopRequested: false,
  mode: "month",
  completedDays: 2,
  totalDays: 5,
  error: null,
};

const noop = () => undefined;

vi.mock("lucide-react", () => {
  const Icon = () => <span />;
  return {
    ArrowLeftRight: Icon,
    Bell: Icon,
    Calendar: Icon,
    DollarSign: Icon,
    Globe: Icon,
    LayoutDashboard: Icon,
    LogOut: Icon,
    Settings: Icon,
    Users: Icon,
  };
});
vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children?: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/games/game/dashboard" }));
vi.mock("@/application/hooks/simulation", () => ({
  getMonthEnd: () => "2026-10-31",
  useAdvanceRange: () => ({ isPending: false, mutate: noop }),
}));
vi.mock("@/application/hooks/simulation/useAdvanceDay", () => ({
  useAdvanceDay: () => ({ isPending: false, isError: false, mutate: noop }),
}));
vi.mock("@/application/hooks/simulation/useCurrentTeamGame", () => ({
  useCurrentTeamGame: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: () => ({ data: [] }) }));
vi.mock("@/application/stores/useBatchSimulationStore", () => ({
  BATCH_SIMULATION_MODE: { MONTH: "month", SEASON: "season" },
  useBatchSimulationStore: (selector: (state: BatchRenderState) => unknown) => selector(batchState),
  getState: () => ({ startBatch: () => true }),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  SidebarContent: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarFooter: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarHeader: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarMenu: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  SidebarMenuButton: ({
    children,
    asChild: _asChild,
    isActive: _isActive,
    ...props
  }: ComponentProps<"div"> & {
    asChild?: boolean;
    isActive?: boolean;
  }) => <div {...props}>{children}</div>,
  SidebarMenuItem: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  SidebarRail: () => <button type="button" aria-label="Toggle Sidebar" />,
  SidebarSeparator: () => <hr />,
  SidebarTrigger: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
}));
vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BreadcrumbItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BreadcrumbLink: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BreadcrumbList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BreadcrumbPage: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  BreadcrumbSeparator: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));

const renderSidebar = () =>
  renderToStaticMarkup(
    <DashboardSidebar
      gameId="game"
      selectedTeamId="team"
      simulationDate={new Date("2026-10-29T00:00:00.000Z")}
      seasonYear={2026}
    />
  );

describe("DashboardSidebar simulation feedback", () => {
  beforeEach(() => {
    batchState = {
      isActive: true,
      stopRequested: false,
      mode: "month",
      completedDays: 2,
      totalDays: 5,
      error: null,
    };
  });

  it("renders committed progress, disables simulation actions, and offers pause", () => {
    const markup = renderSidebar();

    expect(markup).toContain("2 días completados de 5");
    expect(markup).toContain("Pausar simulación");
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(3);
  });

  it("disables pause after it is requested", () => {
    batchState.stopRequested = true;

    const markup = renderSidebar();

    expect(markup).toContain("Pausando…");
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(4);
  });

  it("renders batch errors without changing committed progress", () => {
    batchState.error = "temporary failure";

    const markup = renderSidebar();

    expect(markup).toContain("No se pudo avanzar la simulación.");
    expect(markup).toContain("2 días completados de 5");
  });

  it("keeps navigation ordinary and does not create a persistent batch boundary", () => {
    const markup = renderSidebar();

    expect(markup).toContain('href="/games/game/dashboard/schedule"');
    expect(markup).not.toContain("localStorage");
    expect(markup).not.toContain("background");
  });
});
