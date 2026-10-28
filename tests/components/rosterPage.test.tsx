// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ComponentProps, Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import GameRosterPage from "@/app/(protected)/games/[gameId]/dashboard/roster/page";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";

vi.mock("@/app/ui-preview/fonts", () => ({
  body: { className: "barlow" },
  display: { className: "barlow-condensed" },
}));

const game = {
  selectedTeamId: "bucks",
  seasonYear: 2026,
  seasonEraId: "modern",
  status: "active",
  simulationDate: new Date("2026-10-01"),
};
const rosterPlayers = Array.from({ length: 17 }, (_, index) => ({
  contract: null,
  player: {
    id: `player-${index}`,
    fullName: `Player ${index}`,
    birthDate: "1988-03-14",
    position: "G",
  },
  gameContract: { capTreatment: index < 15 ? "standard-cap-and-matching" : "excluded-two-way" },
})) as unknown as RosterPlayer[];
let players = rosterPlayers;
let rosterLoading = false;
let rosterError = false;
let releaseCharge = 0;
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({
    data: game,
    isLoading: false,
  }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeam: () => ({ data: { city: "Milwaukee", name: "Milwaukee Bucks" } }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({
  useRoster: () => ({ data: players, isLoading: rosterLoading, isError: rosterError }),
}));
vi.mock("@/application/hooks/contracts/useTeamContracts", () => ({
  useTeamContracts: () => ({ data: [{ salaryY1: 160_247_370 }] }),
}));
vi.mock("@/application/hooks/roster/useReleasePlayer", () => ({
  useReleaseCapCharge: () => ({ data: releaseCharge }),
}));
vi.mock("@/components/roster/roster-table", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/roster/roster-table")>()),
  RosterTable: ({
    players,
    onSelectPlayer,
    selectedPlayerId,
    canRelease,
  }: ComponentProps<typeof import("@/components/roster/roster-table").RosterTable>) => (
    <div data-testid="roster-table" data-can-release={canRelease}>
      <p>{players.length} roster entries</p>
      {players.map(({ player }) => (
        <button
          key={player.id}
          type="button"
          aria-pressed={selectedPlayerId === player.id}
          onClick={() => onSelectPlayer?.(player.id)}
        >
          {player.fullName}
        </button>
      ))}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  rosterPlayers[0].contract = null;
  players = rosterPlayers;
  rosterLoading = false;
  rosterError = false;
  releaseCharge = 0;
  game.status = "active";
  game.seasonEraId = "modern";
  game.seasonYear = 2026;
});

async function showRoster() {
  await act(async () => {
    render(
      <I18nProvider locale="en">
        <Suspense fallback="Loading">
          <GameRosterPage params={Promise.resolve({ gameId: "game" })} />
        </Suspense>
      </I18nProvider>
    );
  });
}

it("shows 15 standard slots plus two-way players separately and uses the market's season cap", async () => {
  await act(async () => {
    render(
      <I18nProvider locale="en">
        <Suspense fallback="Loading">
          <GameRosterPage params={Promise.resolve({ gameId: "game" })} />
        </Suspense>
      </I18nProvider>
    );
  });
  await screen.findByText("Standard roster");
  expect(screen.getByText(/^Milwaukee Bucks —/)).toBeTruthy();
  expect(screen.getByText("15")).toBeTruthy();
  expect(screen.getByText("2 two-way players (separate roster slots)")).toBeTruthy();
  expect(screen.getByText("17 roster entries")).toBeTruthy();
  expect(screen.getByText("Cap: $170.1M")).toBeTruthy();
  expect(screen.getByText("$9.9M")).toBeTruthy();
  expect(screen.queryByText("OVER CAP")).toBeNull();
  expect(screen.getByText("Age: 38")).toBeTruthy();
  expect(screen.getByText("Contract unavailable")).toBeTruthy();
});

it("shows the selected player's salary, duration, end season and status", async () => {
  rosterPlayers[0].contract = {
    id: "contract",
    gameId: "game",
    playerId: "player-0",
    teamId: "bucks",
    salaryY1: 10_000_000,
    startYear: 2026,
    endYear: 2028,
    isGuaranteed: null,
    isPlayerOption: false,
    isTeamOption: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await act(async () => {
    render(
      <I18nProvider locale="en">
        <Suspense fallback="Loading">
          <GameRosterPage params={Promise.resolve({ gameId: "game" })} />
        </Suspense>
      </I18nProvider>
    );
  });
  expect(screen.getByText("$10.0M")).toBeTruthy();
  expect(screen.getByText("3y")).toBeTruthy();
  expect(screen.getByText("28-29")).toBeTruthy();
  expect(screen.getByText("Guarantee unknown")).toBeTruthy();
});

it("updates the inspector and profile link when a player is selected", async () => {
  await showRoster();
  const inspector = screen.getByRole("region", { name: "Player" });
  expect(inspector.className).toContain("xl:sticky");
  expect(within(inspector).getByRole("heading", { name: "Player 0" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Player 1" }));
  expect(within(inspector).getByRole("heading", { name: "Player 1" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Player 1", pressed: true })).toBeTruthy();
  expect(within(inspector).getByRole("link", { name: "View player" }).getAttribute("href")).toBe(
    "/games/game/dashboard/player/player-1"
  );
  expect(within(inspector).getByText("Overall rating").nextElementSibling?.textContent).toBe("—");
  expect(document.querySelector('[data-slot="roster-screen"]')?.className).toContain("barlow");
  expect(document.documentElement.dataset.uiPreview).toBeUndefined();
});

it("keeps release charges in the compact financial summary", async () => {
  releaseCharge = 4_000_000;
  await showRoster();
  expect(screen.getByText("$164.2M")).toBeTruthy();
  expect(screen.getByText("$5.9M")).toBeTruthy();
  expect(screen.getByText("Released player cap charges: $4.0M")).toBeTruthy();
});

it("shows the selected player's rating with its estimated status", async () => {
  players = [
    {
      ...rosterPlayers[0],
      ratings: {
        overall: 87,
        estimated: true,
        attributes: {
          closeShot: 80,
          midRangeShot: 80,
          threePointShot: 80,
          freeThrow: 80,
          drawFoul: 80,
          ballHandle: 80,
          passAccuracy: 80,
          interiorDefense: 80,
          perimeterDefense: 80,
          steal: 80,
          block: 80,
          offensiveRebound: 80,
          defensiveRebound: 80,
          stamina: 80,
        },
      },
    },
  ];
  await showRoster();
  const inspector = within(screen.getByRole("region", { name: "Player" }));
  expect(inspector.getByText("Overall rating").nextElementSibling?.textContent).toBe("87");
  expect(inspector.getByText("Estimated ratings")).toBeTruthy();
});

it.each([
  ["active", "modern", 2026, "true"],
  ["completed", "modern", 2026, "false"],
  ["active", "jordan", 2026, "false"],
  ["active", "modern", 2027, "false"],
])("preserves release permissions for %s / %s / %i", async (status, era, year, allowed) => {
  game.status = status;
  game.seasonEraId = era;
  game.seasonYear = year;
  await showRoster();
  expect(screen.getByTestId("roster-table").getAttribute("data-can-release")).toBe(allowed);
});

it("retains loading, error and empty roster states", async () => {
  rosterLoading = true;
  await showRoster();
  expect(screen.queryByRole("heading", { name: "Roster" })).toBeNull();
  cleanup();
  rosterLoading = false;
  rosterError = true;
  players = [];
  await showRoster();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByTestId("roster-table")).toBeNull();
  cleanup();
  rosterError = false;
  await showRoster();
  expect(screen.getByText("No players on the roster.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Player" })).toBeNull();
});
