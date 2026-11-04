// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type ComponentProps, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FranchisePage from "@/app/(protected)/games/[gameId]/dashboard/league/teams/[teamId]/page";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import type { Locale } from "@/application/i18n/types";
import { I18nProvider } from "@/application/providers/I18nProvider";
import type { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import type { RosterTableViews } from "@/components/roster/roster-table-views";
import type { Game } from "@/domain/entities/Game";
import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { Team } from "@/domain/entities/Team";

const mocks = vi.hoisted(() => ({
  game: vi.fn(),
  teams: vi.fn(),
  standings: vi.fn(),
  roster: vi.fn(),
  finances: vi.fn(),
  table: vi.fn(),
  query: "",
  listeners: new Set<() => void>(),
}));
const pathname = "/games/career/dashboard/league/teams/lal";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
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
vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/app/ui-preview/fonts", () => ({ display: { className: "" } }));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: mocks.game }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: mocks.teams }));
vi.mock("@/application/hooks/simulation/useStandings", () => ({ useStandings: mocks.standings }));
vi.mock("@/application/hooks/roster/useRoster", () => ({ useRoster: mocks.roster }));
vi.mock("@/components/dashboard/cap-space-widget", () => ({
  CapSpaceWidget: (props: ComponentProps<typeof CapSpaceWidget>) => {
    mocks.finances(props);
    return <a href={props.rosterHref}>Financial roster link</a>;
  },
}));
vi.mock("@/components/roster/roster-table-views", () => ({
  RosterTableViews: (props: ComponentProps<typeof RosterTableViews>) => {
    mocks.table(props);
    return (
      <div data-testid="roster-table">
        {props.players.map(({ player }) => player.fullName).join(", ")}
      </div>
    );
  },
}));

const date = new Date("2031-10-15T00:00:00Z");
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
const teams: Team[] = [
  {
    id: "lal",
    nbaId: 1,
    name: "Los Angeles Lakers",
    city: "Los Angeles",
    abbreviation: "LAL",
    conference: "West",
    division: "Pacific",
    createdAt: date,
    updatedAt: date,
  },
  {
    id: "bos",
    nbaId: 2,
    name: "Boston Celtics",
    city: "Boston",
    abbreviation: "BOS",
    conference: "East",
    division: "Atlantic",
    createdAt: date,
    updatedAt: date,
  },
];
function player(
  id: string,
  age: number | undefined,
  overall: number | null,
  estimated = false
): RosterPlayer {
  return {
    player: {
      id,
      firstName: id,
      lastName: "Player",
      fullName: `${id} Player`,
      position: "G",
      age,
      yearsOfExperience: 3,
      isActive: true,
      createdAt: date,
      updatedAt: date,
    },
    contract: null,
    gameContract: null,
    ratings: {
      overall,
      estimated,
      attributes: {
        closeShot: 50,
        midRangeShot: 50,
        threePointShot: 50,
        freeThrow: 50,
        drawFoul: 50,
        ballHandle: 50,
        passAccuracy: 50,
        interiorDefense: 50,
        perimeterDefense: 50,
        steal: 50,
        block: 50,
        offensiveRebound: 50,
        defensiveRebound: 50,
        stamina: 50,
      },
    },
  };
}
const roster = [player("Alex", 20, 70), player("Blake", 30, 90, true)];
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
function page(teamId = "lal", locale: Locale = "en") {
  const value = { gameId: game.id, teamId };
  const params = Object.assign(Promise.resolve(value), { status: "fulfilled", value });
  return (
    <I18nProvider locale={locale}>
      <FranchisePage params={params} />
    </I18nProvider>
  );
}
function view(query = "", teamId = "lal", locale: Locale = "en") {
  mocks.query = query;
  return render(page(teamId, locale));
}
function metric(label: string) {
  return screen.getByText(label, { selector: "dt" }).parentElement?.querySelector("dd")
    ?.textContent;
}
function tab(name: string) {
  const trigger = screen.getByRole("tab", { name });
  fireEvent.mouseDown(trigger, { button: 0, ctrlKey: false });
  expect(trigger.getAttribute("aria-selected")).toBe("true");
}
function linkQuery(name: string) {
  return new URL(screen.getByRole("link", { name }).getAttribute("href") ?? "", "http://localhost");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = "";
  vi.spyOn(window.history, "replaceState").mockImplementation((_data, _unused, url) => {
    mocks.query = new URL(String(url), "http://localhost").search.slice(1);
    for (const listener of mocks.listeners) listener();
  });
  mocks.game.mockReturnValue(state(game));
  mocks.teams.mockReturnValue(state(teams));
  mocks.standings.mockReturnValue(
    state<LeagueStanding[]>([
      { gameId: game.id, teamId: "lal", wins: 12, losses: 8 },
      { gameId: game.id, teamId: "bos", wins: 1, losses: 9 },
    ])
  );
  mocks.roster.mockReturnValue(state(roster));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("franchise profile", () => {
  it("composes the export hero, four-part snapshot and explicitly unscored scouting", () => {
    view("q=Los&tag=one&tag=two&franchiseTab=overview");
    const hero = screen.getByRole("region", { name: "Franchise scouting" });
    expect(within(hero).getByText("12–8")).toBeTruthy();
    expect(within(hero).getByText("80")).toBeTruthy();
    expect(within(hero).getByText("Competitive direction · Not evaluated")).toBeTruthy();
    expect(metric("Season record")).toBe("12–8");
    expect(metric("Current roster")).toBe("2");
    for (const area of [
      "Offensive talent",
      "Defensive talent",
      "Shooting",
      "Playmaking",
      "Interior presence",
      "Roster depth",
    ]) {
      expect(screen.getByText(area).parentElement?.textContent).toContain("Not evaluated");
    }
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.queryByText("POT")).toBeNull();
    const href = linkQuery("View roster →");
    expect(href.pathname).toBe(pathname);
    expect(href.searchParams.get("franchiseTab")).toBe("roster");
    expect(href.searchParams.getAll("tag")).toEqual(["one", "two"]);
    expect(href.searchParams.get("q")).toBe("Los");
  });

  it("loads the route franchise, not the managed team or a teamId query override", () => {
    view("teamId=bos");
    expect(screen.getByRole("heading", { name: "Los Angeles Lakers" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Boston Celtics" })).toBeNull();
    expect(screen.getAllByText("12–8")).toHaveLength(2);
    expect(screen.queryByText("1–9")).toBeNull();
    expect(mocks.roster).toHaveBeenLastCalledWith("career", "lal", 2031);
    expect(mocks.game).toHaveBeenCalledWith("career");
    expect(mocks.standings).toHaveBeenCalledWith("career");
  });

  it("uses complete source coverage and the simulation date, marking estimated ratings", () => {
    const datedPlayer = player("Alex", 99, 70);
    datedPlayer.player.birthDate = "2011-10-16";
    mocks.roster.mockReturnValue(state([datedPlayer, roster[1]]));
    view();
    expect(metric("Current roster")).toBe("2");
    expect(metric("Average age")).toBe("24.5");
    expect(metric("Mean team OVR")).toBe("80");
    expect(screen.getAllByText("Estimated ratings")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Highest-rated available player" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Blake Player" })).toBeTruthy();
    expect(screen.getByText(/not a strategic designation/)).toBeTruthy();
    expect(screen.getByText(/No scouting scores are inferred/)).toBeTruthy();
    expect(screen.getByText(/Competitive direction.*not available/)).toBeTruthy();
    expect(screen.queryByText(/conference rank|championship contender|rebuilding/i)).toBeNull();
  });

  it("does not average only the known subset of ages or ratings", () => {
    mocks.roster.mockReturnValue(state([roster[0], player("Unknown", undefined, null)]));
    view();
    expect(metric("Current roster")).toBe("2");
    expect(metric("Average age")).toBe("—");
    expect(metric("Mean team OVR")).toBe("—");
    expect(screen.getByRole("link", { name: "Alex Player" })).toBeTruthy();
    expect(screen.queryByText("Estimated ratings")).toBeNull();
  });

  it("treats zero age, rating and record as known values", () => {
    mocks.roster.mockReturnValue(state([player("Zero", 0, 0)]));
    mocks.standings.mockReturnValue(
      state([{ gameId: game.id, teamId: "lal", wins: 0, losses: 0 }])
    );
    view();
    expect(metric("Average age")).toBe("0");
    expect(metric("Mean team OVR")).toBe("0");
    expect(screen.getAllByText("0–0")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Zero Player" })).toBeTruthy();
  });

  it("shows an empty roster without fabricated averages or a cornerstone", () => {
    mocks.roster.mockReturnValue(state([]));
    view();
    expect(metric("Current roster")).toBe("0");
    expect(metric("Average age")).toBe("—");
    expect(metric("Mean team OVR")).toBe("—");
    expect(screen.getByText("No player ratings are available for this roster.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Player$/ })).toBeNull();
  });

  it("does not nominate an unrated player", () => {
    mocks.roster.mockReturnValue(state([{ ...roster[0], ratings: null }]));
    view();
    expect(screen.getByText("No player ratings are available for this roster.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Alex Player" })).toBeNull();
    expect(metric("Average age")).toBe("20");
    expect(metric("Mean team OVR")).toBe("—");
  });

  it("falls back to Overview for an unknown tab", () => {
    view("franchiseTab=not-a-tab");
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeTruthy();
    expect(mocks.finances).not.toHaveBeenCalled();
    expect(mocks.table).not.toHaveBeenCalled();
  });

  it("changes real tabs through native history and mounts selected-team finances only on demand", () => {
    view("q=Los+Angeles&tag=one&tag=two");
    expect(mocks.finances).not.toHaveBeenCalled();
    tab("Team finances");
    expect(screen.getByRole("tabpanel", { name: "Team finances" })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: "Overview" })).toBeNull();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(new URLSearchParams(mocks.query).get("franchiseTab")).toBe("finances");
    expect(mocks.finances).toHaveBeenLastCalledWith(
      expect.objectContaining({ gameId: "career", teamId: "lal" })
    );
    const href = linkQuery("Financial roster link");
    expect(href.pathname).toBe(pathname);
    expect(href.searchParams.get("franchiseTab")).toBe("roster");
    expect(href.searchParams.getAll("tag")).toEqual(["one", "two"]);
    expect(href.searchParams.get("q")).toBe("Los Angeles");
    tab("Roster");
    expect(screen.queryByRole("link", { name: "Financial roster link" })).toBeNull();
  });

  it("forwards read-only opponent roster context and searches without editing players", () => {
    const query = "franchiseTab=roster&q=Los&tag=one&tag=two";
    view(query);
    expect(mocks.table).toHaveBeenLastCalledWith(
      expect.objectContaining({
        gameId: "career",
        players: roster,
        seasonYear: 2031,
        leagueTeamId: "lal",
        leagueReturnQuery: query,
        canRelease: false,
      })
    );
    expect(screen.queryByRole("button", { name: /release|trade|edit|sign/i })).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  blAKE " } });
    expect(mocks.table).toHaveBeenLastCalledWith(
      expect.objectContaining({ players: [roster[1]], canRelease: false })
    );
    expect(screen.getByTestId("roster-table").textContent).toBe("Blake Player");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nobody" } });
    expect(screen.queryByTestId("roster-table")).toBeNull();
    expect(roster.map(({ player }) => player.fullName)).toEqual(["Alex Player", "Blake Player"]);
  });

  it("returns to the directory preserving filters and repeated params, selecting the viewed team", () => {
    view(
      "q=Los+Angeles&conference=West&division=Pacific&sort=record&tag=one&tag=two&teamId=bos&franchiseTab=roster"
    );
    const back = linkQuery("Back to Teams");
    expect(back.pathname).toBe("/games/career/dashboard/league/teams");
    expect(back.searchParams.get("teamId")).toBe("lal");
    expect(back.searchParams.has("franchiseTab")).toBe(false);
    expect(back.searchParams.getAll("tag")).toEqual(["one", "two"]);
    expect(Object.fromEntries(back.searchParams)).toMatchObject({
      q: "Los Angeles",
      conference: "West",
      division: "Pacific",
      sort: "record",
    });
  });

  it("encodes the full franchise return query in the highest-rated player link", () => {
    const query =
      "q=A%26B&conference=West&division=Pacific&sort=record&tag=one&tag=two&franchiseTab=overview";
    view(query);
    const href = linkQuery("Blake Player");
    expect(href.pathname).toBe("/games/career/dashboard/player/Blake");
    expect(href.searchParams.get("leagueTeamId")).toBe("lal");
    expect(href.searchParams.get("leagueReturnQuery")).toBe(query);
    const restored = new URLSearchParams(href.searchParams.get("leagueReturnQuery") ?? "");
    expect(restored.get("q")).toBe("A&B");
    expect(restored.getAll("tag")).toEqual(["one", "two"]);
  });

  it.each([
    "missing",
    "",
  ])("rejects unrecognized route team %j without loading or falling back", (teamId) => {
    view("teamId=bos", teamId);
    expect(screen.getByText("Franchise not found in this save.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Lakers|Celtics/ })).toBeNull();
    expect(mocks.roster).toHaveBeenCalled();
    expect(mocks.roster.mock.calls.every(([, id]) => id === null)).toBe(true);
    expect(mocks.table).not.toHaveBeenCalled();
    expect(mocks.finances).not.toHaveBeenCalled();
  });

  it("suppresses stale profile data while team membership is loading", () => {
    mocks.teams.mockReturnValue(state(teams, { isLoading: true, isPending: true }));
    view();
    expect(screen.getByRole("status").textContent).toBe("Loading...");
    expect(screen.queryByText("Average age")).toBeNull();
    expect(screen.queryByText("Blake Player")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("suppresses stale profile data on parent query failure and retries both dependencies", () => {
    const failedGame = state(game, { isError: true });
    const teamState = state(teams);
    mocks.game.mockReturnValue(failedGame);
    mocks.teams.mockReturnValue(teamState);
    view("franchiseTab=roster");
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the franchise");
    expect(screen.queryByText("Blake Player")).toBeNull();
    expect(mocks.table).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(failedGame.refetch).toHaveBeenCalledOnce();
    expect(teamState.refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Back to Teams" })).toBeTruthy();
  });

  it("suppresses stale roster summaries and players while a roster is loading", () => {
    mocks.roster.mockReturnValue(state(roster, { isLoading: true, isPending: true }));
    view();
    expect(metric("Average age")).toBe("—");
    expect(metric("Mean team OVR")).toBe("—");
    expect(screen.queryByRole("link", { name: "Blake Player" })).toBeNull();
    tab("Roster");
    expect(mocks.table).not.toHaveBeenCalled();
    expect(within(screen.getByRole("tabpanel")).getByRole("status")).toBeTruthy();
  });

  it("suppresses a failed stale roster and offers a meaningful retry", () => {
    const failedRoster = state(roster, { isError: true });
    mocks.roster.mockReturnValue(failedRoster);
    view();
    expect(metric("Average age")).toBe("—");
    expect(metric("Mean team OVR")).toBe("—");
    expect(screen.queryByRole("link", { name: "Blake Player" })).toBeNull();
    tab("Roster");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mocks.table).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(failedRoster.refetch).toHaveBeenCalledOnce();
  });

  it("hides stale standings on error but keeps valid roster information and standings retry", () => {
    const failedStandings = state([{ gameId: game.id, teamId: "lal", wins: 99, losses: 1 }], {
      isError: true,
    });
    mocks.standings.mockReturnValue(failedStandings);
    view();
    expect(screen.queryByText("99–1")).toBeNull();
    expect(metric("Average age")).toBe("25");
    expect(screen.getByRole("link", { name: "Blake Player" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    expect(failedStandings.refetch).toHaveBeenCalledOnce();
  });

  it("keeps front-office identity honest for opponents and the managed franchise", () => {
    const { rerender } = view("franchiseTab=frontOffice");
    expect(screen.getByRole("tabpanel", { name: "Front Office" })).toBeTruthy();
    expect(
      screen.getByText("Management identity and strategy are not available for this franchise.")
    ).toBeTruthy();
    expect(screen.getByText(/No events have been generated/)).toBeTruthy();
    expect(screen.queryByText("This is the franchise you manage in this save.")).toBeNull();
    rerender(page("bos"));
    expect(screen.getByText("This is the franchise you manage in this save.")).toBeTruthy();
    expect(
      screen.queryByText("Management identity and strategy are not available for this franchise.")
    ).toBeNull();
  });

  it("localizes navigation, honest labels and unavailable information in Spanish", () => {
    view("", "lal", "es");
    expect(screen.getByRole("tablist", { name: "Secciones de la franquicia" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver a Equipos" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Jugador mejor valorado disponible" })).toBeTruthy();
    expect(screen.getByText(/no en una designación estratégica/)).toBeTruthy();
    expect(metric("Edad media")).toBe("25");
    tab("Dirección deportiva");
    expect(screen.getByText(/La identidad y la estrategia.*no están disponibles/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Front Office" })).toBeNull();
  });
});
