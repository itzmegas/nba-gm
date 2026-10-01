// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradesPage from "@/app/(protected)/games/[gameId]/dashboard/trades/page";

const mocks = vi.hoisted(() => ({
  loaded: true,
  simulate: vi.fn(() => ({ data: undefined })),
  execute: vi.fn(async () => ({ success: false, error: "Trade unavailable" })),
}));

vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: { selectedTeamId: "A", seasonYear: 2026 }, isLoading: false }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({
    data: [
      { id: "A", city: "Philadelphia", name: "76ers", abbreviation: "PHI" },
      { id: "B", city: "Los Angeles", name: "Lakers", abbreviation: "LAL" },
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
vi.mock("@/application/hooks/player-states/usePlayerStates", () => ({
  usePlayerStates: () => ({ data: [] }),
}));
vi.mock("@/application/hooks/trades/useDraftPickInventory", () => ({
  useDraftPickInventory: () => ({ data: [] }),
}));
vi.mock("@/application/hooks/trades/useTradeHistory", () => ({
  useTradeHistory: () => ({ data: [] }),
}));
vi.mock("@/application/hooks/trades/useTrades", () => ({
  useSimulateTrade: mocks.simulate,
  useExecuteTrade: () => ({ mutateAsync: mocks.execute, isPending: false }),
}));
vi.mock("@/components/trades/trade-asset-panel", () => ({ TradeAssetPanel: () => null }));
vi.mock("@/components/trades/trade-summary", () => ({
  TradeSummary: ({ onExecute }: { onExecute: () => Promise<void> }) => (
    <button type="button" onClick={onExecute}>
      Execute trade
    </button>
  ),
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
    mocks.simulate.mockClear();
    mocks.execute.mockClear();
  });
  afterEach(cleanup);

  async function selectOpponent() {
    await act(async () => {
      render(<TradesPage params={Promise.resolve({ gameId: "game" })} />);
    });
    fireEvent.click(screen.getByRole("button", { name: "Select opponent" }));
  }

  it("passes visible roster counts and game season to simulation and execution", async () => {
    await selectOpponent();
    expect(mocks.simulate).toHaveBeenLastCalledWith(
      "game",
      { contracts: [], rosterSize: 14 },
      { contracts: [], rosterSize: 12 },
      expect.objectContaining({ teamId: "A" }),
      expect.objectContaining({ teamId: "B" }),
      2026
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Execute trade" })));
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: "game",
        teamA: { contracts: [], rosterSize: 14 },
        teamB: { contracts: [], rosterSize: 12 },
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
});
