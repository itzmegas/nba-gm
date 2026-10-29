// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StandingsPage from "@/app/(protected)/games/[gameId]/dashboard/league/standings/page";
import { selectLeagueStandings } from "@/application/dashboard/selectConferenceStandings";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { franchiseHref, teamsHref } from "@/components/league/navigation";
import type { Team } from "@/domain/entities/Team";

const mocks = vi.hoisted(() => ({
  game: vi.fn(),
  teams: vi.fn(),
  standings: vi.fn(),
  query: "",
  listeners: new Set<() => void>(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/games/career/dashboard/league/standings",
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () => mocks.query
      )
    ),
}));
vi.mock("@/app/ui-preview/fonts", () => ({ display: { className: "" } }));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: mocks.game }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: mocks.teams }));
vi.mock("@/application/hooks/simulation/useStandings", () => ({ useStandings: mocks.standings }));
const date = new Date();
const teams: Team[] = [
  {
    id: "bos",
    nbaId: 1,
    city: "Boston",
    name: "Boston Celtics",
    abbreviation: "BOS",
    conference: "East",
    division: "Atlantic",
    createdAt: date,
    updatedAt: date,
  },
  {
    id: "nyk",
    nbaId: 2,
    city: "New York",
    name: "New York Knicks",
    abbreviation: "NYK",
    conference: "East",
    division: "Atlantic",
    createdAt: date,
    updatedAt: date,
  },
  {
    id: "lal",
    nbaId: 3,
    city: "Los Angeles",
    name: "Los Angeles Lakers",
    abbreviation: "LAL",
    conference: "West",
    division: "Pacific",
    createdAt: date,
    updatedAt: date,
  },
];
const records = [
  { gameId: "career", teamId: "bos", wins: 4, losses: 2 },
  { gameId: "career", teamId: "nyk", wins: 2, losses: 4 },
  { gameId: "career", teamId: "lal", wins: 0, losses: 0 },
];
const state = <T,>(data: T) => ({
  data,
  isLoading: false,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
});
function page(locale: "en" | "es" = "en") {
  const params = Object.assign(Promise.resolve({ gameId: "career" }), {
    status: "fulfilled",
    value: { gameId: "career" },
  });
  return render(
    <I18nProvider locale={locale}>
      <StandingsPage params={params} />
    </I18nProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = "";
  mocks.game.mockReturnValue(state({ selectedTeamId: "bos", seasonYear: 2026 }));
  mocks.teams.mockReturnValue(state(teams));
  mocks.standings.mockReturnValue(state(records));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(window.history, "replaceState").mockImplementation((_data, _unused, url) => {
    mocks.query = new URL(String(url), "http://localhost").search.slice(1);
    for (const listener of mocks.listeners) listener();
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("changes filters interactively, preserving the conference when returning from overall", () => {
  page();
  fireEvent.click(screen.getByRole("combobox", { name: "Conference" }));
  fireEvent.click(screen.getByRole("option", { name: "West" }));
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Boston Celtics" })).toBeNull();
  fireEvent.click(screen.getByRole("combobox", { name: "Standings view" }));
  fireEvent.click(screen.getByRole("option", { name: "Overall league" }));
  expect(screen.getByRole("combobox", { name: "Conference" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Boston Celtics" })).toBeTruthy();
  fireEvent.click(screen.getByRole("combobox", { name: "Standings view" }));
  fireEvent.click(screen.getByRole("option", { name: "Conference" }));
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Boston Celtics" })).toBeNull();
  expect(mocks.query).toContain("stConference=West");
});

it.each([
  "Rank",
  "Franchise",
  "Wins",
  "Losses",
  "Win percentage",
  "Games behind",
])("exposes ascending and descending accessible sorting for %s", (name) => {
  page();
  const table = screen.getAllByRole("table")[0];
  const button = within(table).getByRole("button", { name });
  fireEvent.click(button);
  const first = button.closest("th")?.getAttribute("aria-sort");
  fireEvent.click(button);
  expect(button.closest("th")?.getAttribute("aria-sort")).toBe(
    first === "ascending" ? "descending" : "ascending"
  );
  expect(
    within(table).getByRole("button", { name: "Boston Celtics" }).closest("tr")?.firstElementChild
      ?.textContent
  ).toBe("1");
});

it.each([
  ["all records missing", []],
  ["some records missing", [records[1]]],
])("sorts franchise names alphabetically in both directions with %s", (_label, standings) => {
  mocks.query = "stView=overall";
  mocks.teams.mockReturnValue(
    state(teams.map((team, index) => ({ ...team, abbreviation: ["ZZZ", "AAA", "MMM"][index] })))
  );
  mocks.standings.mockReturnValue(state(standings));
  page();
  const table = screen.getByRole("table");
  const sort = within(table).getByRole("button", { name: "Franchise" });
  const names = () =>
    within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("button").textContent);
  fireEvent.click(sort);
  expect(names()).toEqual(["Boston Celtics", "Los Angeles Lakers", "New York Knicks"]);
  fireEvent.click(sort);
  expect(names()).toEqual(["New York Knicks", "Los Angeles Lakers", "Boston Celtics"]);
});

it("sorts real records, keeps rank and GB stable when sorting, and distinguishes selection from your team", () => {
  page();
  const east = screen.getAllByRole("table")[0];
  const row = within(east).getByRole("button", { name: "New York Knicks" }).closest("tr");
  expect(row?.textContent).toContain("33.3%");
  expect(row?.lastElementChild?.textContent).toBe("2");
  fireEvent.click(within(east).getByRole("button", { name: "New York Knicks" }));
  expect(screen.getByRole("heading", { name: "New York Knicks" })).toBeTruthy();
  expect(
    within(east).getByRole("button", { name: "Boston Celtics" }).closest("tr")?.textContent
  ).toContain("Your franchise");
  expect(row?.getAttribute("data-state")).toBe("selected");
  fireEvent.click(within(east).getByRole("button", { name: "Losses" }));
  expect(within(east).getAllByRole("row")[1].textContent).toContain("Boston Celtics");
  fireEvent.click(within(east).getByRole("button", { name: "Losses" }));
  expect(within(east).getAllByRole("row")[1].textContent).toContain("New York Knicks");
  expect(row?.lastElementChild?.textContent).toBe("2");
  const link = screen.getByRole("link", { name: "View Franchise" });
  expect(link.getAttribute("href")).toContain("standingsReturn=1");
  expect(link.getAttribute("href")).toContain("stSort=losses");
});

it("retains selection outside the conference filter and groups overall without the filter", () => {
  mocks.query = "stConference=West&teamId=bos";
  const view = page();
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getByText("Selection retained outside the current filter.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Boston Celtics" })).toBeNull();
  cleanup();
  mocks.query = "stConference=West&stView=overall";
  page();
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Boston Celtics" })).toBeTruthy();
  view.unmount();
});

it("groups divisions and represents zero games and missing records without inventing results", () => {
  mocks.query = "stView=division&teamId=nyk";
  mocks.standings.mockReturnValue(state([records[0], records[2]]));
  page();
  expect(screen.getByRole("heading", { name: "Atlantic" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Pacific" })).toBeTruthy();
  const missing = screen.getByRole("button", { name: "New York Knicks" }).closest("tr");
  expect(missing?.firstElementChild?.textContent).toBe("—");
  expect(missing?.textContent).not.toContain("0–0");
  const zero = screen.getByRole("button", { name: "Los Angeles Lakers" }).closest("tr");
  expect(zero?.children[4].textContent).toBe("—");
});

it("renders localized Spanish copy and percentages", () => {
  page("es");
  expect(screen.getByText("Franquicia seleccionada")).toBeTruthy();
  expect(screen.getAllByText(/66,7/).length).toBeGreaterThan(0);
});

it("handles loading, errors with retry, empty data, and empty records", () => {
  mocks.standings.mockReturnValue({ ...state(records), isPending: true });
  page();
  expect(screen.getByRole("status")).toBeTruthy();
  cleanup();
  const failed = { ...state(records), isError: true };
  mocks.standings.mockReturnValue(failed);
  page();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(failed.refetch).toHaveBeenCalledOnce();
  cleanup();
  mocks.standings.mockReturnValue(state([]));
  page();
  expect(screen.getByText(/Missing records are not ranked/)).toBeTruthy();
  cleanup();
  mocks.teams.mockReturnValue(state([]));
  page();
  expect(screen.queryByRole("table")).toBeNull();
});

it("preserves simplified PCT/wins/abbreviation order without mutating inputs", () => {
  const tied = [{ ...records[1], wins: 4, losses: 2 }, records[0], records[2]];
  const snapshot = structuredClone(tied);
  expect(selectLeagueStandings(tied, teams).map((row) => row.teamId)).toEqual([
    "bos",
    "nyk",
    "lal",
  ]);
  expect(tied).toEqual(snapshot);
});

it("returns from a franchise to standings while preserving existing Teams navigation", () => {
  const href = franchiseHref(
    "career",
    "nyk",
    "standingsReturn=1&stConference=West&stView=division&stSort=wins&stDirection=desc"
  );
  const query = href.split("?")[1];
  expect(teamsHref("career", "nyk", query)).toBe(
    "/games/career/dashboard/league/standings?stConference=West&stView=division&stSort=wins&stDirection=desc&teamId=nyk"
  );
  expect(teamsHref("career", "nyk", "q=Boston")).toBe(
    "/games/career/dashboard/league/teams?q=Boston&teamId=nyk"
  );
});
