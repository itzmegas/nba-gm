// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradesPage from "@/app/(protected)/games/[gameId]/dashboard/trades/page";

const mocks = vi.hoisted(() => ({
  loaded: true,
  releaseChargesLoaded: true,
  simulate: vi.fn(() => ({ data: undefined })),
  execute: vi.fn(async () => ({ success: false, error: "Trade unavailable" })),
  panelLogo: vi.fn<(logoUrl?: string) => void>(),
  summaryLogos: vi.fn<(teamA?: string, teamB?: string) => void>(),
}));

const TEAM_A_LOGO = "https://cdn.nba.com/logos/nba/1610612755/global/L/logo.svg";
const TEAM_B_LOGO = "https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-image-src={src} />
  ),
}));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: { selectedTeamId: "A", seasonYear: 2026 }, isLoading: false }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({
    data: [
      { id: "A", city: "Philadelphia", name: "76ers", logoUrl: TEAM_A_LOGO },
      { id: "B", city: "Los Angeles", name: "Lakers", logoUrl: TEAM_B_LOGO },
    ],
  }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({
  useRoster: (_gameId: string, teamId: string | null) => ({
    data:
      mocks.loaded && teamId
        ? Array.from({ length: teamId === "A" ? 14 : 12 }, (_, index) => ({
            player: { id: `${teamId}-${index}` },
            contract: null,
          }))
        : undefined,
  }),
}));
vi.mock("@/application/hooks/contracts/useTeamContracts", () => ({
  useTeamContracts: () => ({ data: mocks.loaded ? [] : undefined }),
}));
vi.mock("@/application/hooks/roster/useReleasePlayer", () => ({
  useReleaseCapCharge: (_gameId: string, teamId: string | null) => ({
    data:
      mocks.releaseChargesLoaded && teamId ? (teamId === "A" ? 2_500_000 : 1_000_000) : undefined,
  }),
}));
vi.mock("@/application/hooks/player-states/usePlayerStates", () => ({
  usePlayerStates: () => ({ data: [] }),
}));
vi.mock("@/application/hooks/trades/useDraftPickInventory", () => ({
  useDraftPickInventory: () => ({ data: [] }),
}));
vi.mock("@/application/hooks/trades/useTradeHistory", () => ({
  useTradeHistory: () => ({
    data: [
      {
        id: "trade-1",
        teamAId: "A",
        teamBId: "B",
        assets: [],
        executedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ],
  }),
}));
vi.mock("@/application/hooks/trades/useTrades", () => ({
  useSimulateTrade: mocks.simulate,
  useExecuteTrade: () => ({ mutateAsync: mocks.execute, isPending: false }),
}));
vi.mock("@/components/trades/trade-asset-panel", () => ({
  TradeAssetPanel: ({
    teamLogoUrl,
    onTogglePick,
  }: {
    teamLogoUrl?: string;
    onTogglePick: (id: string) => void;
  }) => {
    mocks.panelLogo(teamLogoUrl);
    return (
      <button type="button" onClick={() => onTogglePick("pick")}>
        Select pick
      </button>
    );
  },
}));
vi.mock("@/components/trades/trade-summary", () => ({
  TradeSummary: ({
    onExecute,
    teamALogoUrl,
    teamBLogoUrl,
  }: {
    onExecute: () => Promise<void>;
    teamALogoUrl?: string;
    teamBLogoUrl?: string;
  }) => {
    mocks.summaryLogos(teamALogoUrl, teamBLogoUrl);
    return (
      <button type="button" onClick={onExecute}>
        Execute trade
      </button>
    );
  },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange }: { onValueChange: (value: string) => void }) => (
    <button type="button" onClick={() => onValueChange("B")}>
      Select opponent
    </button>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

describe("TradesPage", () => {
  beforeEach(() => {
    mocks.loaded = true;
    mocks.releaseChargesLoaded = true;
    mocks.simulate.mockClear();
    mocks.execute.mockClear();
    mocks.panelLogo.mockClear();
    mocks.summaryLogos.mockClear();
  });
  afterEach(cleanup);

  async function selectOpponent() {
    await act(async () => {
      render(<TradesPage params={Promise.resolve({ gameId: "game" })} />);
    });
    fireEvent.click(screen.getByRole("button", { name: "Select opponent" }));
  }

  it("passes visible roster counts, released cap charges and game season to simulation and execution", async () => {
    await selectOpponent();
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      { contracts: [], rosterSize: 14, releaseCapCharge: 2_500_000 },
      { contracts: [], rosterSize: 12, releaseCapCharge: 1_000_000 },
      expect.objectContaining({ teamId: "A" }),
      expect.objectContaining({ teamId: "B" }),
      2026
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Execute trade" })));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: "game",
        teamA: { contracts: [], rosterSize: 14, releaseCapCharge: 2_500_000 },
        teamB: { contracts: [], rosterSize: 12, releaseCapCharge: 1_000_000 },
        seasonYear: 2026,
      })
    );
  });

  it("does not submit before roster and contract data are loaded", async () => {
    mocks.loaded = false;
    await selectOpponent();
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      null,
      null,
      expect.objectContaining({ teamId: "A" }),
      expect.objectContaining({ teamId: "B" }),
      2026
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Execute trade" })));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("does not submit before released cap charges are loaded", async () => {
    mocks.releaseChargesLoaded = false;
    await selectOpponent();
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      null,
      null,
      expect.objectContaining({ teamId: "A" }),
      expect.objectContaining({ teamId: "B" }),
      2026
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Execute trade" })));
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("passes team logos to the trade panels and summary and renders history logos", async () => {
    await selectOpponent();

    expect(mocks.panelLogo).toHaveBeenCalledWith(TEAM_A_LOGO);
    expect(mocks.panelLogo).toHaveBeenCalledWith(TEAM_B_LOGO);
    expect(mocks.summaryLogos).toHaveBeenCalledWith(TEAM_A_LOGO, TEAM_B_LOGO);
    expect(screen.getByRole("img", { name: "76ers logo" }).getAttribute("data-image-src")).toBe(
      TEAM_A_LOGO
    );
    expect(screen.getByRole("img", { name: "Lakers logo" }).getAttribute("data-image-src")).toBe(
      TEAM_B_LOGO
    );
  });

  it("resets both packages while keeping the trade partner", async () => {
    await selectOpponent();
    for (const button of screen.getAllByRole("button", { name: "Select pick" })) {
      fireEvent.click(button);
    }
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ outgoingAssets: [{ type: "pick", pickId: "pick" }] }),
      expect.objectContaining({ outgoingAssets: [{ type: "pick", pickId: "pick" }] }),
      2026
    );
    expect(screen.getByRole("status").textContent).toBe("Checking trade…");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ teamId: "A", outgoingAssets: [] }),
      expect.objectContaining({ teamId: "B", outgoingAssets: [] }),
      2026
    );
    expect(screen.getByRole("status").textContent).toBe("Waiting for your next move");
  });
});
