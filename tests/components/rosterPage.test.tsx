// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import GameRosterPage from "@/app/(protected)/games/[gameId]/dashboard/roster/page";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";

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
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({
    data: { selectedTeamId: "bucks", seasonYear: 2026, simulationDate: new Date("2026-10-01") },
    isLoading: false,
  }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeam: () => ({ data: { city: "Milwaukee", name: "Milwaukee Bucks" } }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({
  useRoster: () => ({ data: rosterPlayers, isLoading: false }),
}));
vi.mock("@/application/hooks/contracts/useTeamContracts", () => ({
  useTeamContracts: () => ({ data: [{ salaryY1: 160_247_370 }] }),
}));
vi.mock("@/application/hooks/roster/useReleasePlayer", () => ({
  useReleaseCapCharge: () => ({ data: 0 }),
}));
vi.mock("@/components/roster/roster-table", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/roster/roster-table")>()),
  RosterTable: ({ players }: { players: RosterPlayer[] }) => <p>{players.length} roster entries</p>,
}));
afterEach(() => {
  cleanup();
  rosterPlayers[0].contract = null;
});

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
