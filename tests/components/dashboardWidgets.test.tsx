// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameDashboardPage from "@/app/(protected)/games/[gameId]/dashboard/page";
import { selectConferenceStandings } from "@/application/dashboard/selectConferenceStandings";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import type { Locale } from "@/application/i18n/types";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import { AlertsWidget, getVerifiedContractEndYear } from "@/components/dashboard/alerts-widget";
import { CapSpaceWidget } from "@/components/dashboard/cap-space-widget";
import { FranchiseOverview } from "@/components/dashboard/franchise-overview";
import { NextGameWidget } from "@/components/dashboard/next-game-widget";
import { StandingsWidget } from "@/components/dashboard/standings-widget";
import { getSalaryCapThresholds } from "@/domain/constants/nba-rules";
import type { Contract } from "@/domain/entities/Contract";
import type { Game } from "@/domain/entities/Game";
import type { LeagueStanding } from "@/domain/entities/LeagueStanding";
import type { PostseasonState } from "@/domain/entities/Postseason";
import type { ScheduledGame } from "@/domain/entities/ScheduledGame";
import type { Team } from "@/domain/entities/Team";

vi.mock("@/app/ui-preview/fonts", () => ({
  body: { className: "barlow" },
  display: { className: "barlow-condensed" },
}));

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
const game = {
  id: "game",
  selectedTeamId: "chi",
  seasonYear: 2026,
  status: "active",
  simulationDate: new Date("2026-10-16T00:00:00Z"),
} as Game;
const baseTeams = [
  {
    id: "chi",
    name: "Chicago Bulls",
    city: "Chicago",
    division: "Central",
    abbreviation: "CHI",
    conference: "East",
    logoUrl: "/chi.png",
  },
  {
    id: "cha",
    name: "Charlotte Hornets",
    abbreviation: "CHA",
    conference: "East",
    logoUrl: "/cha.png",
  },
  { id: "dal", name: "Dallas Mavericks", abbreviation: "DAL", conference: "West" },
] as Team[];
let teams: Team[];
let next: { data: ScheduledGame | null; isPending: boolean; isError: boolean };
let roster: { data: RosterPlayer[]; isPending: boolean; isError: boolean };
let standings: { data: LeagueStanding[]; isPending: boolean; isError: boolean };
let releases: { data: number | undefined; isError: boolean };
let contracts: { data: Contract[]; isError: boolean };
let injuredIds: string[];
let gamePending = false;
let gameError = false;
let teamsPending = false;
let teamsError = false;
let advancePending = false;
let advanceError = false;
let postseason: { data: PostseasonState | undefined; isPending: boolean; isError: boolean };
vi.mock("@/application/hooks/postseason/usePostseason", () => ({
  usePostseason: () => postseason,
}));

vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: game, isPending: gamePending, isError: gameError }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({ data: teams, isPending: teamsPending, isError: teamsError }),
}));
vi.mock("@/application/hooks/simulation", () => ({
  useNextGame: () => next,
  useStandings: () => standings,
  useAdvanceRange: () => ({ isPending: advancePending, isError: advanceError, mutate }),
}));
vi.mock("@/application/hooks/roster/useRoster", () => ({ useRoster: () => roster }));
vi.mock("@/application/hooks/player-states/usePlayerStates", () => ({
  usePlayerStates: () => ({
    data: injuredIds.map((playerId) => ({ playerId, isInjured: true })),
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/application/hooks/contracts/useTeamContracts", () => ({
  useTeamContracts: () => contracts,
}));
vi.mock("@/application/hooks/roster/useReleasePlayer", () => ({
  useReleaseCapCharge: () => releases,
}));

function entry(id: string, endYear = 2026): RosterPlayer {
  return {
    player: { id, fullName: id, firstName: id, lastName: "Player" },
    contract: { endYear, salaryY1: 1_000_000 },
    gameContract: null,
  } as RosterPlayer;
}
function show(component: ReactElement, locale: Locale = "en") {
  return render(<I18nProvider locale={locale}>{component}</I18nProvider>);
}

beforeEach(() => {
  gamePending = false;
  gameError = false;
  teamsPending = false;
  teamsError = false;
  advancePending = false;
  advanceError = false;
  postseason = { data: undefined, isPending: false, isError: false };
  teams = [...baseTeams];
  mutate.mockReset();
  useBatchSimulationStore.setState({
    isActive: false,
    stopRequested: false,
    mode: null,
    completedDays: 0,
    totalDays: null,
    error: null,
  });
  next = {
    data: {
      id: "fixture",
      gameId: "game",
      date: "2026-10-19",
      homeTeamId: "cha",
      awayTeamId: "chi",
      status: "scheduled",
    },
    isPending: false,
    isError: false,
  };
  standings = {
    data: [
      { gameId: "game", teamId: "dal", wins: 10, losses: 0 },
      { gameId: "game", teamId: "cha", wins: 2, losses: 2 },
      { gameId: "game", teamId: "chi", wins: 1, losses: 0 },
    ],
    isPending: false,
    isError: false,
  };
  roster = { data: [], isPending: false, isError: false };
  contracts = { data: [{ salaryY1: 100_000_000 } as Contract], isError: false };
  releases = { data: 5_000_000, isError: false };
  injuredIds = [];
});
afterEach(cleanup);

function dashboard() {
  const params = Object.assign(Promise.resolve({ gameId: "game" }), {
    status: "fulfilled",
    value: { gameId: "game" },
  });
  return show(<GameDashboardPage params={params} />);
}

describe("dashboard composition", () => {
  it("renders the export's row-major panels below franchise identity and metrics", () => {
    const { container } = dashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Franchise dashboard" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Franchise overview" })).toBeDefined();
    const titles = [...container.querySelectorAll('[data-slot="card-title"]')].map(
      (node) => node.textContent
    );
    expect(titles).toEqual([
      "Next game",
      "Team finances",
      "Conference standings",
      "Front office priorities",
    ]);
    expect(screen.getByRole("link", { name: "View standings" }).getAttribute("href")).toBe(
      "/games/game/dashboard/league/standings"
    );
  });

  it.each([
    "game-loading",
    "game-error",
    "teams-loading",
    "teams-error",
  ])("keeps %s out of the ready dashboard", (state) => {
    gamePending = state === "game-loading";
    gameError = state === "game-error";
    teamsPending = state === "teams-loading";
    teamsError = state === "teams-error";
    dashboard();
    expect(screen.getByRole(state.endsWith("error") ? "alert" : "status")).toBeDefined();
    expect(screen.queryByRole("region", { name: "Franchise overview" })).toBeNull();
  });
});

describe("franchise overview", () => {
  it("uses real conference records, rank and played games, never prototype metrics", () => {
    standings.data = [
      { gameId: "game", teamId: "chi", wins: 12, losses: 8 },
      { gameId: "game", teamId: "cha", wins: 15, losses: 5 },
      { gameId: "game", teamId: "dal", wins: 30, losses: 0 },
    ];
    show(<FranchiseOverview game={game} teams={teams} />);
    expect(screen.getByRole("heading", { name: "Chicago Bulls" })).toBeDefined();
    expect(screen.getByText("Central")).toBeDefined();
    const strip = screen.getByRole("region", { name: "Season at a glance" });
    expect(within(strip).getByText("12–8")).toBeDefined();
    expect(within(strip).getByText("60%")).toBeDefined();
    expect(within(strip).getByText("2")).toBeDefined();
    expect(within(strip).getByText("20")).toBeDefined();
    expect(screen.queryByText(/Last 5|arena|draft|eliminated/i)).toBeNull();
  });

  it.each([
    "loading",
    "error",
    "missing",
    "unplayed",
  ])("handles %s records without invented numbers", (state) => {
    standings.isPending = state === "loading";
    standings.isError = state === "error";
    if (state === "missing") standings.data = [];
    if (state === "unplayed")
      standings.data = [{ gameId: "game", teamId: "chi", wins: 0, losses: 0 }];
    show(<FranchiseOverview game={game} teams={teams} />);
    const strip = screen.getByRole("region", { name: "Season at a glance" });
    expect(within(strip).queryByText("100%")).toBeNull();
    if (state === "loading") expect(within(strip).getByRole("status")).toBeDefined();
    if (state === "error") expect(within(strip).getByRole("alert")).toBeDefined();
    if (state === "missing") expect(within(strip).getByText(/not available yet/)).toBeDefined();
    if (state === "unplayed") {
      expect(within(strip).getByText("0–0")).toBeDefined();
      expect(within(strip).getByText("—")).toBeDefined();
    }
  });

  it("localizes real metrics and falls back when team identity is missing", () => {
    show(<FranchiseOverview game={game} teams={[]} />, "es");
    expect(screen.getByRole("region", { name: "Temporada de un vistazo" })).toBeDefined();
    expect(screen.getByText("Porcentaje de victorias")).toBeDefined();
    expect(screen.queryByText("Chicago Bulls")).toBeNull();
  });
});

describe("next game", () => {
  it("does not start simulation after a confirmed champion even if a stale fixture remains", () => {
    postseason.data = { phase: "complete", championTeamId: "chi" } as PostseasonState;
    show(<NextGameWidget game={game} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Simulate next game" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
  it("keeps pending simulation locked and allows retry after an advance error", () => {
    advancePending = true;
    const view = show(<NextGameWidget game={game} />);
    expect(
      (screen.getByRole("button", { name: "Simulate next game" }) as HTMLButtonElement).disabled
    ).toBe(true);
    advancePending = false;
    advanceError = true;
    view.rerender(
      <I18nProvider locale="en">
        <NextGameWidget game={game} />
      </I18nProvider>
    );
    expect(screen.getByRole("alert")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
    expect(mutate).toHaveBeenCalledOnce();
  });
  it.each([
    ["regular_season", null, false, false],
    ["play_in", null, true, false],
    ["playoffs", null, true, false],
    ["complete", null, true, false],
    ["complete", "chi", true, true],
  ] as const)("links only to existing postseason states: %s / %s", (phase, championTeamId, visible, offseason) => {
    next.data = null;
    postseason.data = {
      phase,
      championTeamId,
      runnerUpTeamId: null,
      qualification: [],
      playoffSeeds: [],
      series: [],
      games: [],
    };
    show(<NextGameWidget game={game} />);
    const links = screen.getAllByRole("link");
    const link = links.find((item) => item.getAttribute("href")?.endsWith("/postseason"));
    expect(Boolean(link)).toBe(visible);
    if (link) expect(link.textContent?.includes("Offseason")).toBe(offseason);
    expect(screen.getByRole("link", { name: "Calendar" }).getAttribute("href")).toBe(
      "/games/game/dashboard/schedule"
    );
    expect(screen.queryByRole("button", { name: "Simulate next game" })).toBeNull();
  });

  it.each(["pending", "error"])("does not promote stale postseason data during %s", (state) => {
    next.data = null;
    postseason = {
      data: { phase: "complete", championTeamId: "chi" } as PostseasonState,
      isPending: state === "pending",
      isError: state === "error",
    };
    show(<NextGameWidget game={game} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows full logos and home/away order, and starts a bounded league simulation", () => {
    const { container } = show(<NextGameWidget game={game} />);
    expect(
      [...container.querySelectorAll("img")].map((image) =>
        image.classList.contains("object-contain")
      )
    ).toEqual([true, true]);
    expect(container.textContent?.indexOf("Chicago Bulls")).toBeLessThan(
      container.textContent?.indexOf("Charlotte Hornets") ?? 0
    );
    fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
    expect(mutate).toHaveBeenCalledWith({
      gameId: "game",
      simulationDate: game.simulationDate,
      seasonYear: 2026,
      mode: "next-game",
      targetDate: "2026-10-19",
    });
    expect(useBatchSimulationStore.getState().totalDays).toBe(3);
    expect(
      (screen.getByRole("button", { name: "Simulating to next game…" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("cannot start while another simulation owns the lock", () => {
    useBatchSimulationStore.getState().startDay();
    show(<NextGameWidget game={game} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cannot simulate an archived save", () => {
    show(<NextGameWidget game={{ ...game, status: "archived" }} />);
    expect(
      (screen.getByRole("button", { name: "Simulate next game" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it.each([
    "loading",
    "error",
    "empty",
  ])("distinguishes %s fixtures without offering simulation", (state) => {
    next = { data: null, isPending: state === "loading", isError: state === "error" };
    show(<NextGameWidget game={game} />);
    expect(screen.queryByRole("button", { name: "Simulate next game" })).toBeNull();
    if (state === "loading") expect(screen.getByRole("status")).toBeDefined();
    if (state === "error") expect(screen.getByRole("alert")).toBeDefined();
    if (state === "empty") expect(screen.getByText("No next game")).toBeDefined();
  });

  it("localizes the primary action and simulation scope in Spanish", () => {
    show(<NextGameWidget game={game} />, "es");
    expect(screen.getByRole("button", { name: "Simular próximo partido" })).toBeDefined();
    expect(screen.getByText(/Avanza toda la liga/)).toBeDefined();
  });
});

describe("conference standings", () => {
  it("filters by conference and ranks by percentage, not raw win totals", () => {
    show(<StandingsWidget gameId="game" teamId="chi" />);
    expect(screen.getByText("East")).toBeDefined();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1]?.textContent)).toEqual([
      "Chicago Bulls",
      "Charlotte Hornets",
    ]);
    expect(screen.queryByText("DAL")).toBeNull();
    expect(rows[0]?.textContent).toContain("100%");
  });

  it("keeps a low-ranked selected team visible with its actual rank", () => {
    const extraTeams = Array.from(
      { length: 7 },
      (_, i) => ({ ...teams[0], id: `east-${i}`, abbreviation: `E${i}` }) as Team
    );
    teams = [...teams, ...extraTeams];
    standings.data = [
      ...extraTeams.map((team, i) => ({ gameId: "game", teamId: team.id, wins: 8 - i, losses: 0 })),
      { gameId: "game", teamId: "chi", wins: 0, losses: 8 },
    ];
    show(<StandingsWidget gameId="game" teamId="chi" />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(
      within(rows[4] as HTMLElement)
        .getAllByRole("cell")
        .slice(0, 2)
        .map((cell) => cell.textContent)
    ).toEqual(["8", "Chicago Bulls"]);
  });

  it("uses stable alphabetical ties and does not fabricate a percentage before play", () => {
    standings.data = [
      { gameId: "game", teamId: "chi", wins: 0, losses: 0 },
      { gameId: "game", teamId: "cha", wins: 0, losses: 0 },
    ];
    show(<StandingsWidget gameId="game" teamId="chi" />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]?.textContent).toContain("Charlotte Hornets");
    expect(rows[0]?.textContent).toContain("—");
    expect(screen.getByText(/NBA tiebreakers are not modeled/)).toBeDefined();
  });

  it("does not fall back to the whole league for a missing conference", () => {
    expect(selectConferenceStandings(standings.data, teams, "unknown-team")).toEqual([]);
  });
});

describe("roster evidence", () => {
  it("does not invent an expiration from an observed salary coverage boundary", () => {
    const player = entry("Unknown boundary");
    if (player.contract) player.contract.compatibilityProjection = "observed-season-coverage";
    roster.data = [player];
    show(<AlertsWidget gameId="game" teamId="chi" seasonYear={2026} />);
    expect(screen.queryByText("Expiring this season")).toBeNull();
    expect(screen.getByText(/Players with unverified contract end dates: 1/)).toBeDefined();
  });

  it("accepts an explicit canonical end label but not an estimated agreement", () => {
    const player = entry("Verified boundary");
    if (player.contract) player.contract.compatibilityProjection = "observed-season-coverage";
    player.gameContract = {
      estimated: false,
      agreement: {
        endSeasonLabel: "2026-27",
        seasons: [{ seasonLabel: "2026-27", startYear: 2026 }],
      },
    } as unknown as RosterPlayer["gameContract"];
    expect(getVerifiedContractEndYear(player)).toBe(2026);
    if (player.gameContract) player.gameContract.estimated = true;
    expect(getVerifiedContractEndYear(player)).toBeNull();
  });

  it("shows simulated expirations and only injured players still on the roster", () => {
    const player = entry("Simulated Player");
    if (player.contract) player.contract.origin = "simulated-agreement";
    roster.data = [player, entry("Healthy Player", 2028)];
    injuredIds = [player.player.id, "released-player"];
    show(<AlertsWidget gameId="game" teamId="chi" seasonYear={2026} />);
    expect(screen.getByText("Expiring this season")).toBeDefined();
    expect(screen.getByText("Injured players")).toBeDefined();
    expect(screen.getAllByRole("link", { name: /Simulated Player/ })).toHaveLength(2);
    expect(screen.queryByText("released-player")).toBeNull();
  });

  it("does not claim a healthy roster when loading failed", () => {
    roster.isError = true;
    show(<AlertsWidget gameId="game" teamId="chi" seasonYear={2026} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("No verified roster alerts.")).toBeNull();
  });
});

describe("financial truth", () => {
  it("keeps an opponent's financial roster link inside its franchise profile", () => {
    const href = "/games/game/dashboard/league/teams/cha?conference=East&franchiseTab=roster";
    show(<CapSpaceWidget gameId="game" teamId="cha" rosterHref={href} />);
    expect(screen.getByRole("link", { name: "Roster" }).getAttribute("href")).toBe(href);
    expect(screen.queryByRole("link", { name: "Roster" })?.getAttribute("href")).not.toBe(
      "/games/game/dashboard/roster"
    );
  });

  it("retains all thresholds and the computed bar including release charges", () => {
    const { container } = show(<CapSpaceWidget gameId="game" teamId="chi" />);
    const thresholds = getSalaryCapThresholds(game.seasonYear);
    for (const value of [
      thresholds.salaryCap,
      thresholds.luxuryTax,
      thresholds.firstApron,
      thresholds.secondApron,
    ]) {
      expect(
        screen.getByText(
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(value)
        )
      ).toBeDefined();
    }
    const bar = container.querySelector<HTMLElement>('[aria-hidden="true"] > div');
    expect(Number.parseFloat(bar?.style.width ?? "0")).toBeCloseTo(
      (105_000_000 / thresholds.secondApron) * 100
    );
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Roster" }).getAttribute("href")).toBe(
      "/games/game/dashboard/roster"
    );
  });
  it("includes released cap charges and uses the game's season thresholds", () => {
    show(<CapSpaceWidget gameId="game" teamId="chi" />);
    expect(screen.getByText("$105,000,000")).toBeDefined();
    expect(screen.getByText(/Released player cap charges: \$5,000,000/)).toBeDefined();
    expect(
      screen.getByText(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(getSalaryCapThresholds(2026).salaryCap)
      )
    ).toBeDefined();
  });

  it.each([
    "contracts",
    "releases",
  ])("hides financial totals rather than spinning forever on %s failure", (source) => {
    if (source === "contracts") contracts.isError = true;
    else {
      releases.isError = true;
      releases.data = undefined;
    }
    show(<CapSpaceWidget gameId="game" teamId="chi" />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("$105,000,000")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
