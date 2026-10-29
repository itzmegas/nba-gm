// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ComponentProps, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamsPage from "@/app/(protected)/games/[gameId]/dashboard/league/teams/page";
import type { Locale } from "@/application/i18n/types";
import { I18nProvider } from "@/application/providers/I18nProvider";
import type { Game } from "@/domain/entities/Game";
import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { Team } from "@/domain/entities/Team";

const mocks = vi.hoisted(() => ({
  game: vi.fn(),
  teams: vi.fn(),
  standings: vi.fn(),
  roster: vi.fn(),
  replace: vi.fn(),
  listeners: new Set<() => void>(),
  query: "",
}));
const pathname = "/games/career/dashboard/league/teams";
function navigate(href: string) {
  mocks.query = new URL(href, "http://localhost").search.slice(1);
  for (const listener of mocks.listeners) listener();
}
const router = { replace: mocks.replace };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => {
    const query = useSyncExternalStore(
      (listener) => {
        mocks.listeners.add(listener);
        return () => mocks.listeners.delete(listener);
      },
      () => mocks.query
    );
    return new URLSearchParams(query);
  },
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    scroll: _scroll,
    ...props
  }: ComponentProps<"a"> & { scroll?: boolean }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const modified =
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        if (!event.defaultPrevented && !modified && href) navigate(href);
        event.preventDefault();
      }}
    />
  ),
}));
vi.mock("@/app/ui-preview/fonts", () => ({ display: { className: "" } }));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: mocks.game }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: mocks.teams }));
vi.mock("@/application/hooks/simulation/useStandings", () => ({ useStandings: mocks.standings }));
vi.mock("@/application/hooks/roster/useRoster", () => ({ useRoster: mocks.roster }));

const date = new Date("2026-10-15T00:00:00Z");
const game: Game = {
  id: "career",
  userId: "gm",
  name: "Career",
  selectedTeamId: "bos",
  seasonYear: 2031,
  seasonEraId: "modern",
  simulationDate: date,
  status: "active",
  createdAt: date,
  updatedAt: date,
};
function team(
  id: string,
  name: string,
  city: string,
  abbreviation: string,
  conference: string,
  division: string
): Team {
  return {
    id,
    nbaId: id.length,
    name,
    city,
    abbreviation,
    conference,
    division,
    createdAt: date,
    updatedAt: date,
  };
}
const teams: Team[] = [
  team("lal", "Los Angeles Lakers", "Los Angeles", "LAL", "West", "Pacific"),
  team("mia", "Miami Heat", "Miami", "MIA", "East", "Southeast"),
  team("bos", "Boston Celtics", "Boston", "BOS", "East", "Atlantic"),
  team("nyk", "New York Knicks", "New York", "NYK", "East", "Atlantic"),
  team("dal", "Dallas Mavericks", "Dallas", "DAL", "West", "Southwest"),
];
function record(teamId: string, wins: number, losses: number): LeagueStanding {
  return { gameId: game.id, teamId, wins, losses };
}
interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  isPending: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
}
function state<T>(data: T | undefined, overrides: Partial<QueryState<T>> = {}): QueryState<T> {
  return {
    data,
    isLoading: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}
function page(locale: Locale = "en") {
  const params = Object.assign(Promise.resolve({ gameId: game.id }), {
    status: "fulfilled",
    value: { gameId: game.id },
  });
  return (
    <I18nProvider locale={locale}>
      <TeamsPage params={params} />
    </I18nProvider>
  );
}
function view(query = "teamId=bos", locale: Locale = "en") {
  mocks.query = query;
  return render(page(locale));
}
function directory() {
  return screen.getByRole("table", { name: "Franchise directory" });
}
function row(name: string) {
  return within(directory()).getByText(name).closest("tr") as HTMLTableRowElement;
}
function names() {
  return within(directory())
    .queryAllByRole("link")
    .map((link) => link.getAttribute("aria-label")?.split(" · ")[1]);
}
function select(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = "";
  mocks.replace.mockImplementation(navigate);
  vi.spyOn(window.history, "replaceState").mockImplementation((_data, _unused, url) => {
    if (url) navigate(String(url));
  });
  mocks.game.mockReturnValue(state(game));
  mocks.teams.mockReturnValue(state(teams));
  mocks.standings.mockReturnValue(
    state([record("bos", 8, 2), record("lal", 12, 8), record("mia", 0, 0)])
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Teams directory", () => {
  it("uses real metadata and W–L, leaving missing records unavailable rather than 0–0", () => {
    view();
    expect(mocks.game).toHaveBeenCalledWith("career");
    expect(mocks.standings).toHaveBeenCalledWith("career");
    expect(row("Boston Celtics").textContent).toContain("EastAtlantic8–2");
    expect(row("Los Angeles Lakers").textContent).toContain("WestPacific12–8");
    expect(row("New York Knicks").textContent).toContain("—");
    expect(row("New York Knicks").textContent).not.toContain("0–0");
    expect(row("Miami Heat").textContent).toContain("0–0");
    expect(screen.getByText(/Missing results are not counted as zero/)).toBeTruthy();
    expect(names()).toEqual([
      "Boston Celtics",
      "Dallas Mavericks",
      "Los Angeles Lakers",
      "Miami Heat",
      "New York Knicks",
    ]);
  });

  it("suppresses stale standings on failure, retries only standings, and retains franchise access", () => {
    const standings = state([record("lal", 99, 1)], { isError: true });
    mocks.standings.mockReturnValue(standings);
    view("teamId=bos&sort=record");
    expect(screen.getByRole("alert").textContent).toContain("Unable to load standings.");
    expect(directory().textContent).not.toContain("99–1");
    expect(names()).toEqual([
      "Boston Celtics",
      "Dallas Mavericks",
      "Los Angeles Lakers",
      "Miami Heat",
      "New York Knicks",
    ]);
    expect(row("Boston Celtics").textContent).toContain("—");
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    expect(standings.refetch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "View Franchise · Los Angeles Lakers" }).getAttribute("href")
    ).toBe(`${pathname}/lal?sort=record`);
  });

  it("shows records loading without inventing zero records or an unavailable warning", () => {
    mocks.standings.mockReturnValue(state(undefined, { isPending: true, isLoading: true }));
    view();
    expect(within(directory()).getAllByText("Loading...")).toHaveLength(teams.length);
    expect(directory().textContent).not.toContain("0–0");
    expect(screen.queryByText(/Missing results/)).toBeNull();
  });

  it.each([
    ["  loS aNGeles  ", ["LA Clippers", "Los Angeles Lakers"]],
    ["celtics", ["Boston Celtics"]],
    ["nYk", ["New York Knicks"]],
    ["all", ["Dallas Mavericks"]],
  ] as const)("searches city/name/abbreviation: %s", (query, matches) => {
    mocks.teams.mockReturnValue(
      state([...teams, team("lac", "LA Clippers", "Los Angeles", "LAC", "West", "Pacific")])
    );
    view();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
    expect(names()).toEqual(matches);
    expect(new URLSearchParams(mocks.query).get("q")).toBe(query);
  });

  it("combines conference, division and search, then resets division when conference changes", () => {
    view();
    select("Conference", "East");
    expect(names()).toEqual(["Boston Celtics", "Miami Heat", "New York Knicks"]);
    select("Division", "Atlantic");
    expect(names()).toEqual(["Boston Celtics", "New York Knicks"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "BOS" } });
    expect(names()).toEqual(["Boston Celtics"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    select("Conference", "West");
    expect(names()).toEqual(["Dallas Mavericks", "Los Angeles Lakers"]);
    expect(new URLSearchParams(mocks.query).has("division")).toBe(false);
    expect(screen.getByRole("combobox", { name: "Division" }).textContent).toContain(
      "All divisions"
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Division" }));
    expect(screen.queryByRole("option", { name: "Atlantic" })).toBeNull();
    expect(screen.getByRole("option", { name: "Pacific" })).toBeTruthy();
  });

  it("clears directory filters but preserves selection and unrelated/repeated parameters", () => {
    view("teamId=lal&q=BOS&conference=East&division=Atlantic&sort=record&tab=notes&tag=a&tag=b");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    const query = new URLSearchParams(mocks.query);
    expect([...query.entries()]).toEqual([
      ["teamId", "lal"],
      ["tab", "notes"],
      ["tag", "a"],
      ["tag", "b"],
    ]);
    expect(names()).toHaveLength(5);
    expect(row("Los Angeles Lakers").textContent).toContain("Selected team");
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", expect.any(String));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("sorts by win percentage before raw wins, with deterministic ties, zero games and missing records", () => {
    mocks.teams.mockReturnValue(
      state([
        ...teams,
        team("atl", "Atlanta Hawks", "Atlanta", "ATL", "East", "Southeast"),
        team("chi", "Chicago Bulls", "Chicago", "CHI", "East", "Central"),
      ])
    );
    mocks.standings.mockReturnValue(
      state([
        record("bos", 8, 2),
        record("lal", 12, 8),
        record("dal", 6, 4),
        record("mia", 0, 0),
        record("chi", 6, 4),
      ])
    );
    view();
    select("Sort by", "Record (win percentage)");
    expect(names()).toEqual([
      "Boston Celtics",
      "Los Angeles Lakers",
      "Chicago Bulls",
      "Dallas Mavericks",
      "Miami Heat",
      "Atlanta Hawks",
      "New York Knicks",
    ]);
    select("Sort by", "Franchise name");
    expect(names()).toEqual([
      "Atlanta Hawks",
      "Boston Celtics",
      "Chicago Bulls",
      "Dallas Mavericks",
      "Los Angeles Lakers",
      "Miami Heat",
      "New York Knicks",
    ]);
  });

  it("distinguishes a search with no matches from an empty team directory", () => {
    const rendered = view("teamId=bos&q=not-a-team");
    expect(screen.getByText("No teams match.")).toBeTruthy();
    mocks.teams.mockReturnValue(state([]));
    rendered.rerender(page());
    expect(screen.getByText("No teams are available in this save.")).toBeTruthy();
    expect(screen.queryByTestId("roster")).toBeNull();
  });

  it.each([
    "game",
    "teams",
  ] as const)("hides stale content when %s fails and offers a retry", (query) => {
    const gameState = state(game, { isError: query === "game" });
    const teamsState = state(teams, { isError: query === "teams" });
    mocks.game.mockReturnValue(gameState);
    mocks.teams.mockReturnValue(teamsState);
    view();
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the league.");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByTestId("roster")).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(gameState.refetch).toHaveBeenCalledOnce();
    expect(teamsState.refetch).toHaveBeenCalledOnce();
  });
});

describe("directory navigation", () => {
  it.each([
    "",
    "teamId=invalid&tab=notes",
  ])("never normalizes absent or invalid selection: %s", (query) => {
    mocks.game.mockReturnValue(state<Game>(undefined, { isPending: true, isLoading: true }));
    const rendered = view(query);
    mocks.game.mockReturnValue(state(game));
    rendered.rerender(page());
    expect(mocks.query).toBe(query);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(screen.queryByText("Selected team")).toBeNull();
    expect(row("Boston Celtics").textContent).toContain("Your franchise");
    expect(mocks.roster).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Search player" })).toBeNull();
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("keeps explicit selection distinct from the own franchise without loading a roster", () => {
    view("teamId=lal");
    expect(row("Boston Celtics").textContent).toContain("Your franchise");
    expect(row("Boston Celtics").textContent).not.toContain("Selected team");
    expect(row("Los Angeles Lakers").textContent).toContain("Selected team");
    expect(row("Los Angeles Lakers").textContent).not.toContain("Your franchise");
    expect(mocks.roster).not.toHaveBeenCalled();
    expect(game.selectedTeamId).toBe("bos");
  });

  it("links to a separate franchise with filters and repeated/unrelated parameters safely preserved", () => {
    const query =
      "teamId=bos&teamId=invalid&q=Boston&conference=East&division=Atlantic&sort=record&tab=notes&tag=a&tag=b&returnTo=https%3A%2F%2Fevil.example%2F";
    view(query);
    const href = screen
      .getByRole("link", { name: "View Franchise · Boston Celtics" })
      .getAttribute("href");
    const target = new URL(href ?? "", "http://localhost");
    expect(target.pathname).toBe(`${pathname}/bos`);
    expect(target.origin).toBe("http://localhost");
    const expected = new URLSearchParams(query);
    expected.delete("teamId");
    expect([...target.searchParams]).toEqual([...expected]);
    expect(mocks.query).toBe(query);
  });

  it("renders Spanish directory controls, missing-record guidance and franchise links", () => {
    view("teamId=bos", "es");
    expect(screen.getByRole("heading", { name: "Equipos" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Directorio de franquicias" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Conferencia" })).toBeTruthy();
    expect(screen.getByText(/Los resultados faltantes no se cuentan como cero/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver franquicia · Boston Celtics" })).toBeTruthy();
  });
});
