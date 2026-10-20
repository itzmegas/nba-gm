// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import GameRosterPage from "@/app/(protected)/games/[gameId]/dashboard/roster/page";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";

const rosterPlayers = Array.from({ length: 17 }, (_, index) => ({
  contract: null,
  gameContract: { capTreatment: index < 15 ? "standard-cap-and-matching" : "excluded-two-way" },
}));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: { selectedTeamId: "bucks", seasonYear: 2026 }, isLoading: false }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeam: () => ({ data: { city: "Milwaukee", name: "Bucks" } }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({
  useRoster: () => ({ data: rosterPlayers, isLoading: false }),
}));
vi.mock("@/application/hooks/contracts/useTeamContracts", () => ({
  useTeamContracts: () => ({ data: [{ salaryY1: 160_247_370 }] }),
}));
vi.mock("@/components/roster/roster-table", () => ({
  RosterTable: ({ players }: { players: RosterPlayer[] }) => <p>{players.length} roster entries</p>,
}));
afterEach(cleanup);

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
  expect(screen.getByText("15")).toBeTruthy();
  expect(screen.getByText("2 two-way players (separate roster slots)")).toBeTruthy();
  expect(screen.getByText("17 roster entries")).toBeTruthy();
  expect(screen.getByText("Cap: $170.1M")).toBeTruthy();
  expect(screen.getByText("$9.9M")).toBeTruthy();
  expect(screen.queryByText("OVER CAP")).toBeNull();
});
