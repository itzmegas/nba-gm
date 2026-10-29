// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { RosterTableViews } from "@/components/roster/roster-table-views";
import { boxScoreFixture } from "@/infrastructure/repositories/boxScore.test-fixture";

const { query, push } = vi.hoisted(() => ({ query: vi.fn(), push: vi.fn() }));
vi.mock("@/application/hooks/schedule/useSeasonStatistics", () => ({ useSeasonStatistics: query }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const scores = boxScoreFixture().players;
const players = [
  {
    player: { id: scores[0].playerId, fullName: "Roster Player" },
    contract: null,
    gameContract: null,
  },
  { player: { id: "missing", fullName: "No Appearances" }, contract: null, gameContract: null },
  {
    player: { id: scores[1].playerId, fullName: "Excluded" },
    contract: null,
    gameContract: { resolutionStatus: "inactive-excluded" },
  },
] as unknown as RosterPlayer[];

function loadStatistics() {
  query.mockReturnValue({
    data: {
      completedGames: 2,
      coveredGames: 1,
      players: scores.map((p) => ({ ...p, gamesPlayed: 1, totals: p })),
    },
    isPending: false,
    isError: false,
  });
}

it("loads statistics only on demand, keeps the roster players, and preserves selection", () => {
  loadStatistics();
  const select = vi.fn();
  render(
    <I18nProvider locale="en">
      <RosterTableViews
        gameId="career"
        seasonYear={2026}
        players={players}
        onSelectPlayer={select}
        selectedPlayerId={scores[0].playerId}
      />
    </I18nProvider>
  );
  expect(query).not.toHaveBeenCalled();
  expect(screen.getByRole("columnheader", { name: "OVR" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).queryByText(scores[1].playerName)).toBeNull();
  expect(within(table).queryByText("Excluded")).toBeNull();
  const missing = within(table).getByRole("button", { name: "No Appearances" }).closest("tr");
  if (!missing) throw new Error("Missing roster row");
  expect(
    within(missing)
      .getAllByRole("cell")
      .every((cell) => cell.textContent === "—")
  ).toBe(true);
  const player = within(table).getByRole("button", { name: "Roster Player", pressed: true });
  fireEvent.click(player);
  expect(select).toHaveBeenCalledWith(scores[0].playerId);
  fireEvent.click(screen.getByRole("button", { name: "Roster & ratings" }));
  expect(screen.getByRole("columnheader", { name: "OVR" })).toBeTruthy();
});

it("updates the statistics list with roster filters and retains league navigation", () => {
  loadStatistics();
  const returnQuery = "q=Boston&tag=a&tag=b&franchiseTab=roster";
  const view = (roster: RosterPlayer[]) => (
    <I18nProvider locale="en">
      <RosterTableViews
        gameId="career"
        seasonYear={2026}
        players={roster}
        leagueTeamId="team"
        leagueReturnQuery={returnQuery}
      />
    </I18nProvider>
  );
  const { rerender } = render(view(players));
  fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
  expect(screen.getByRole("link", { name: "Roster Player" }).getAttribute("href")).toBe(
    `/games/career/dashboard/player/${scores[0].playerId}?${new URLSearchParams({ leagueTeamId: "team", leagueReturnQuery: returnQuery })}`
  );
  rerender(view([players[1]]));
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).queryByRole("link", { name: "Roster Player" })).toBeNull();
  expect(within(table).getByRole("link", { name: "No Appearances" })).toBeTruthy();
});

it("offers both views in Spanish and shows the roster even without any recorded appearances", () => {
  query.mockReturnValue({
    data: { completedGames: 1, coveredGames: 0, players: [] },
    isPending: false,
    isError: false,
  });
  render(
    <I18nProvider locale="es">
      <RosterTableViews gameId="career" seasonYear={2026} players={[players[0]]} />
    </I18nProvider>
  );
  expect(screen.getByRole("button", { name: "Plantilla y atributos", pressed: true })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Estadísticas" }));
  expect(screen.getByRole("link", { name: "Roster Player" })).toBeTruthy();
  expect(
    within(screen.getByRole("table"))
      .getAllByRole("cell")
      .every((cell) => cell.textContent === "—")
  ).toBe(true);
});

it.each([
  "row",
  "name",
  "menu",
])("preserves franchise context through the roster %s action", (action) => {
  const returnQuery = "q=Boston&tag=a&tag=b&franchiseTab=roster";
  render(
    <I18nProvider locale="en">
      <RosterTableViews
        gameId="career"
        seasonYear={2026}
        players={[players[0]]}
        leagueTeamId="team"
        leagueReturnQuery={returnQuery}
      />
    </I18nProvider>
  );
  const name = screen.getByRole("button", { name: "Roster Player" });
  if (action === "menu") {
    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions — Roster Player" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "View player" }));
  } else if (action === "name") {
    fireEvent.click(name);
  } else {
    const row = name.closest("tr");
    if (!row) throw new Error("Missing roster row");
    fireEvent.click(row);
  }
  expect(push).toHaveBeenCalledExactlyOnceWith(
    `/games/career/dashboard/player/${scores[0].playerId}?${new URLSearchParams({ leagueTeamId: "team", leagueReturnQuery: returnQuery })}`
  );
});
