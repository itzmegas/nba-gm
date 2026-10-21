// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TradeAssetPanel } from "@/components/trades/trade-asset-panel";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";

vi.mock("@/components/players/player-headshot", () => ({ PlayerHeadshot: () => null }));

const player = {
  id: "player",
  firstName: "Test",
  lastName: "Player",
  fullName: "Test Player",
  yearsOfExperience: 3,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const pick = {
  id: "pick",
  gameId: "game",
  draftPickId: "draft",
  ownerTeamId: "team",
  isTransferable: true,
  pick: { id: "draft", draftYear: 2027, draftRound: 1, originalTeamId: "team" },
};
const props: ComponentProps<typeof TradeAssetPanel> = {
  teamName: "Test Team",
  roster: [
    {
      player,
      gameContract: null,
      contract: {
        id: "contract",
        gameId: "game",
        playerId: "player",
        teamId: "team",
        startYear: 2026,
        endYear: 2028,
        salaryY1: 20_000_000,
        isPlayerOption: false,
        isTeamOption: false,
        isGuaranteed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
  picks: [pick],
  playerStateByPlayerId: new Map(),
  selectedPlayerIds: [],
  selectedPickIds: [],
  onTogglePlayer: vi.fn(),
  onTogglePick: vi.fn(),
  seasonYear: 2026,
  payroll: 180_000_000,
  incomingAssets: [],
  pickById: new Map([[pick.id, pick]]),
};

describe("TradeAssetPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("switches asset views without losing selection and keeps selection callbacks", () => {
    render(
      <TradeAssetPanel {...props} selectedPlayerIds={[player.id]} selectedPickIds={[pick.id]} />
    );
    const playerButton = screen.getByRole("button", { name: /Test Player/ });
    expect(playerButton.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(playerButton);
    expect(props.onTogglePlayer).toHaveBeenCalledWith(player.id);
    fireEvent.click(screen.getByRole("button", { name: "Picks · 1" }));
    expect(screen.queryByRole("button", { name: /Test Player/ })).toBeNull();
    const pickButton = screen.getByRole("button", { name: "2027 R1" });
    expect(pickButton.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pickButton);
    expect(props.onTogglePick).toHaveBeenCalledWith(pick.id);
    fireEvent.click(screen.getByRole("button", { name: "Roster · 1" }));
    expect(screen.getByRole("button", { name: /Test Player/ }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("shows incoming players and picks and disables players without contracts", () => {
    render(
      <TradeAssetPanel
        {...props}
        roster={[{ player, contract: null, gameContract: null }]}
        incomingAssets={[
          { type: "player", player: { ...player, id: "incoming", fullName: "Incoming Player" } },
          { type: "pick", pickId: pick.id },
        ]}
      />
    );
    expect(screen.getByText("Incoming Player")).toBeTruthy();
    expect(screen.getByText("2027 R1")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Test Player/ }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("uses season thresholds and handles zero and loading payroll", () => {
    const cap = getSalaryCapThresholds(2026).salaryCap;
    const { rerender } = render(<TradeAssetPanel {...props} payroll={cap} />);
    expect(screen.getByText("Room $0")).toBeTruthy();
    rerender(<TradeAssetPanel {...props} payroll={0} />);
    expect(screen.getByText("$0")).toBeTruthy();
    rerender(<TradeAssetPanel {...props} payroll={null} />);
    expect(screen.getByText("Loading finances…")).toBeTruthy();
    expect(screen.queryByText("Over the cap")).toBeNull();
  });
});
