// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamsPage from "@/app/(protected)/games/[gameId]/dashboard/league/teams/page";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { useGameStore } from "@/application/stores/useGameStore";
import { useTeamStore } from "@/application/stores/useTeamStore";
import { CreateGameForm } from "@/components/games/CreateGameForm";
import { TeamSelector } from "@/components/team-selector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/games/game/dashboard/league/teams",
  useSearchParams: () => new URLSearchParams("teamId=atl"),
}));
vi.mock("@/app/ui-preview/fonts", () => ({ display: { className: "barlow-condensed" } }));
vi.mock("@/application/hooks/simulation/useStandings", () => ({
  useStandings: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: { selectedTeamId: "atl", seasonYear: 2026 }, isLoading: false }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({
  useRoster: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/application/hooks/schedule/useSeasonStatistics", () => ({
  useSeasonStatistics: () => ({
    data: { completedGames: 0, coveredGames: 0, players: [] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/application/hooks/games/useCreateGame", () => ({
  useCreateGame: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({
    data: [
      { id: "atl", name: "Atlanta Hawks", city: "Atlanta", abbreviation: "ATL" },
      { id: "lac", name: "LA Clippers", city: "Los Angeles", abbreviation: "LAC" },
      { id: "por", name: "Portland Trail Blazers", city: "Portland", abbreviation: "POR" },
    ],
    isLoading: false,
    error: null,
  }),
}));

beforeEach(() => {
  useTeamStore.setState({ selectedTeamId: "atl", searchQuery: "", conferenceFilter: "all" });
  useGameStore.getState().resetCreateFlow();
  useGameStore.getState().setPendingSelectedTeamId("atl");
});

afterEach(() => {
  cleanup();
  useTeamStore.setState({ selectedTeamId: null, searchQuery: "", conferenceFilter: "all" });
  useGameStore.getState().resetCreateFlow();
});

it.each([
  { label: "team selection", Selector: TeamSelector },
  { label: "game creation", Selector: CreateGameForm },
])("uses canonical franchise names in $label", ({ Selector }) => {
  render(
    <I18nProvider locale="en">
      <Selector />
    </I18nProvider>
  );
  expect(screen.getAllByText("Atlanta Hawks")).toHaveLength(2);
  expect(screen.getByText("LA Clippers")).toBeTruthy();
  expect(screen.getByText("Portland Trail Blazers")).toBeTruthy();
  for (const city of ["Atlanta", "Los Angeles", "Portland"]) {
    expect(screen.queryByText(city, { exact: true })).toBeNull();
  }
  expect(screen.queryByText("Atlanta Atlanta Hawks")).toBeNull();
});

it("uses canonical team names in the directory and franchise links", async () => {
  await act(async () => {
    render(
      <I18nProvider locale="en">
        <Suspense fallback="Loading">
          <TeamsPage params={Promise.resolve({ gameId: "game" })} />
        </Suspense>
      </I18nProvider>
    );
  });
  expect(screen.queryByRole("heading", { name: "Atlanta Hawks" })).toBeNull();
  for (const name of ["Atlanta Hawks", "LA Clippers", "Portland Trail Blazers"]) {
    expect(screen.getByRole("link", { name: `View Franchise · ${name}` })).toBeTruthy();
  }
  expect(
    screen.getByRole("link", { name: "View Franchise · Atlanta Hawks" }).getAttribute("href")
  ).toBe("/games/game/dashboard/league/teams/atl");
  expect(screen.queryByText("Atlanta Atlanta Hawks")).toBeNull();
});
