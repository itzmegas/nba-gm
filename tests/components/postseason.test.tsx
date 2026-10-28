// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { PostseasonView } from "@/components/postseason/PostseasonView";
import {
  hasPostseasonChampion,
  isTeamEliminated,
  type PostseasonState,
} from "@/domain/entities/Postseason";
import {
  postseasonFixture,
  postseasonGameFixture,
  postseasonId,
  postseasonTeamsFixture,
} from "@/infrastructure/repositories/postseason.test-fixture";

const { query, teams, boxScore } = vi.hoisted(() => ({
  query: vi.fn(),
  teams: vi.fn(),
  boxScore: vi.fn(),
}));
vi.mock("@/application/hooks/postseason/usePostseason", () => ({ usePostseason: query }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: teams }));
vi.mock("@/application/hooks/schedule/useBoxScore", () => ({ useBoxScore: boxScore }));
vi.mock("@/components/offseason/OffseasonPanel", () => ({
  OffseasonPanel: () => <div>Offseason planning panel</div>,
}));
beforeEach(() => {
  teams.mockReturnValue({
    data: postseasonTeamsFixture(),
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  });
  boxScore.mockReturnValue({ data: null, isPending: false, isError: false });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(state: PostseasonState, selectedTeam = 13, locale: "en" | "es" = "en") {
  query.mockReturnValue({ data: state, isPending: false, isError: false });
  return render(
    <I18nProvider locale={locale}>
      <PostseasonView gameId={postseasonId(100)} selectedTeamId={postseasonId(selectedTeam)} />
    </I18nProvider>
  );
}

describe("postseason phases and fixed visual bracket", () => {
  it("groups saved play-in stages in bracket order with qualification seeds and compact rows", () => {
    const data = postseasonTeamsFixture();
    data[6].logoUrl = "/play-in-logo.svg";
    teams.mockReturnValue({ data, isPending: false, isError: false });
    const first = postseasonGameFixture({
      seriesId: null,
      stage: "seven_eight",
      homeTeamId: postseasonId(7),
      winnerTeamId: null,
    });
    const final = postseasonGameFixture({
      id: postseasonId(103),
      seriesId: null,
      stage: "eighth_seed",
      homeTeamId: postseasonId(8),
      awayTeamId: postseasonId(9),
      status: "scheduled",
      winnerTeamId: postseasonId(9),
    });
    const middle = postseasonGameFixture({
      id: postseasonId(104),
      seriesId: null,
      stage: "nine_ten",
      homeTeamId: postseasonId(9),
      awayTeamId: postseasonId(10),
    });
    const { container } = show(
      postseasonFixture({
        phase: "play_in",
        games: [final, middle, first],
        playoffSeeds: [{ teamId: postseasonId(7), conference: "East", seed: 8 }],
      })
    );
    const west = screen.getByRole("region", { name: "Play-in results · Western Conference" });
    const east = screen.getByRole("region", { name: "Play-in results · Eastern Conference" });
    expect(west.parentElement?.firstElementChild).toBe(west);
    expect(west.querySelectorAll("[data-play-in-game]")).toHaveLength(0);
    expect(
      Array.from(east.querySelectorAll("[data-play-in-game]"), (card) =>
        card.getAttribute("data-play-in-game")
      )
    ).toEqual([first.id, middle.id, final.id]);
    expect(east.querySelector(".grid")?.className).toContain("@min-[32rem]:grid-cols-2");
    expect(east.parentElement?.className).toContain("@min-[64rem]:grid-cols-2");
    const card = container.querySelector(`[data-play-in-game="${first.id}"]`);
    const scheduled = container.querySelector(`[data-play-in-game="${final.id}"]`);
    if (!(card instanceof HTMLElement) || !(scheduled instanceof HTMLElement))
      throw new Error("Missing saved game");
    expect(within(card).getByText("#7")).toBeTruthy();
    expect(within(card).getByText("100")).toBeTruthy();
    expect(within(card).getByText("Winner").closest(".flex")?.textContent).toContain("East Team 7");
    const logo = card.querySelector("img");
    if (!logo) throw new Error("Missing logo");
    fireEvent.error(logo);
    expect(card.querySelector("img")).toBeNull();
    expect(within(card).getAllByText("E7")).toHaveLength(2);
    expect(within(scheduled).queryByRole("button")).toBeNull();
    expect(within(scheduled).queryByText("Winner")).toBeNull();
    expect(within(scheduled).queryByText("100")).toBeNull();
    expect(within(scheduled).getAllByText("—")).toHaveLength(2);
    fireEvent.click(within(card).getByRole("button"));
    expect(boxScore).toHaveBeenCalledWith(postseasonId(100), first.id);
  });

  it("explains the regular season without inventing a draw", () => {
    const { container } = show(
      postseasonFixture({ phase: "regular_season", qualification: [], playoffSeeds: [] })
    );
    expect(screen.getByText("Regular season in progress")).toBeTruthy();
    expect(screen.getByText(/Six teams per conference/)).toBeTruthy();
    expect(container.querySelector("[data-bracket-slot]")).toBeNull();
    expect(screen.queryByText(/Your team is eliminated/)).toBeNull();
    expect(screen.queryByText("Offseason planning panel")).toBeNull();
  });

  it("shows all 15 slots and the fixed first-round order before series preparation", () => {
    const { container } = show(postseasonFixture());
    expect(screen.getByText("Playoff field ready")).toBeTruthy();
    expect(screen.queryByText("Offseason planning panel")).toBeNull();
    expect(screen.getByText(/Advance the simulation to prepare/)).toBeTruthy();
    expect(screen.getByText(/Your team is eliminated/)).toBeTruthy();
    expect(screen.getByText(/#13/)).toBeTruthy();
    expect(container.querySelectorAll("[data-bracket-slot]")).toHaveLength(15);
    expect(container.querySelector("[data-bracket-slot]")?.getAttribute("data-bracket-slot")).toBe(
      "West-1-1"
    );
    expect(
      screen.getByRole("button", { name: "Playoff bracket" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.queryByRole("button", { name: "Offseason" })).toBeNull();
    for (const [slot, pair] of [
      [1, [1, 8]],
      [2, [4, 5]],
      [3, [2, 7]],
      [4, [3, 6]],
    ] as const) {
      const card = container.querySelector(`[data-bracket-slot="East-1-${slot}"]`);
      expect(card?.textContent).toContain(`East Team ${pair[0]}`);
      expect(card?.textContent).toContain(`East Team ${pair[1]}`);
      expect(card?.textContent?.indexOf(`East Team ${pair[0]}`)).toBeLessThan(
        card?.textContent?.indexOf(`East Team ${pair[1]}`) ?? -1
      );
    }
    expect(screen.getAllByText("To be decided").length).toBeGreaterThan(0);
  });

  it("shows play-in results in Spanish and opens only completed saved box scores", () => {
    show(
      postseasonFixture({
        phase: "play_in",
        playoffSeeds: [],
        games: [
          postseasonGameFixture({ seriesId: null, stage: "seven_eight", gameNumber: null }),
          postseasonGameFixture({
            id: postseasonId(103),
            seriesId: null,
            stage: "eighth_seed",
            gameNumber: null,
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            winnerTeamId: null,
          }),
        ],
      }),
      8,
      "es"
    );
    expect(screen.getByText("Play-in en curso")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Resultados del play-in" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getAllByText(/7 vs 8 · El ganador obtiene el puesto 7/)).toHaveLength(2);
    expect(screen.getByText("Programado")).toBeTruthy();
    expect(screen.queryByText(/Tu equipo está eliminado/)).toBeNull();
    expect(boxScore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Abrir estadísticas/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(boxScore).toHaveBeenCalledWith(postseasonId(100), postseasonId(102));
    expect(screen.getByText(/Se conserva el resultado original/)).toBeTruthy();
  });

  it("preserves home-court team wins, shows winners in adjacent future slots, and opens series games", () => {
    const state = postseasonFixture({
      series: [
        {
          id: postseasonId(101),
          round: 1,
          conference: "East",
          bracketSlot: 2,
          homeTeamId: postseasonId(4),
          awayTeamId: postseasonId(5),
          homeWins: 2,
          awayWins: 4,
          winnerTeamId: postseasonId(5),
        },
      ],
      games: [postseasonGameFixture()],
    });
    const { container } = show(state, 4);
    expect(screen.getByText("Playoffs in progress")).toBeTruthy();
    const slot = container.querySelector('[data-bracket-slot="East-1-2"]');
    if (!(slot instanceof HTMLElement)) throw new Error("Missing series slot");
    expect(within(slot).getByText("2")).toBeTruthy();
    expect(within(slot).getByText("4")).toBeTruthy();
    expect(within(slot).getByText("Winner")).toBeTruthy();
    expect(container.querySelector('[data-bracket-slot="East-2-1"]')?.textContent).toContain(
      "East Team 5"
    );
    expect(container.querySelector('[data-bracket-slot="East-2-2"]')?.textContent).not.toContain(
      "East Team 5"
    );
    expect(slot.querySelector("details")).toBeNull();
    fireEvent.click(within(slot).getByRole("button", { name: "Series games" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Game 1/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Open box score/ }));
    expect(boxScore).toHaveBeenCalledWith(postseasonId(100), postseasonId(102));
  });

  it("uses uniform slots and aligns later rounds to the midpoint of their feeder pairs", () => {
    const { container } = show(postseasonFixture());
    for (const conference of ["East", "West"]) {
      for (const [round, slots] of [
        [1, 4],
        [2, 2],
        [3, 1],
      ]) {
        for (let slot = 1; slot <= slots; slot++) {
          const card = container.querySelector(
            `[data-bracket-slot="${conference}-${round}-${slot}"]`
          );
          expect(card?.classList.contains("h-28")).toBe(true);
          expect(card?.parentElement?.style.gridRow).toBe(
            `${(slot - 1) * 2 ** round + 1} / span ${2 ** round}`
          );
        }
      }
    }
    const finals = container.querySelector('[data-bracket-slot="Finals-4-1"]');
    expect(finals?.classList.contains("h-28")).toBe(true);
    expect(finals?.parentElement?.className).toContain("@min-[72rem]:h-[32rem]");
  });

  it("shows team logos with an abbreviation fallback and accessible full names", () => {
    const data = postseasonTeamsFixture();
    const team = data[0];
    team.logoUrl = "/team-logo.svg";
    teams.mockReturnValue({ data, isPending: false, isError: false });
    const { container } = show(postseasonFixture());
    const card = container.querySelector('[data-bracket-slot="East-1-1"]');
    if (!(card instanceof HTMLElement)) throw new Error("Missing series slot");
    expect(within(card).getByText(team.name)).toBeTruthy();
    const logo = card.querySelector("img");
    expect(logo?.getAttribute("alt")).toBe("");
    if (!logo) throw new Error("Missing team logo");
    fireEvent.error(logo);
    expect(card.querySelector("img")).toBeNull();
    expect(within(card).getAllByText(team.abbreviation).length).toBeGreaterThan(0);
  });

  it("announces champion and runner-up with no season rollover", () => {
    show(
      postseasonFixture({
        phase: "complete",
        championTeamId: postseasonId(1),
        runnerUpTeamId: postseasonId(16),
      }),
      1
    );
    expect(screen.getByRole("heading", { name: "East Team 1" })).toBeTruthy();
    expect(screen.getByText("Offseason planning panel")).toBeTruthy();
    const planning = screen.getByText("Offseason planning panel");
    expect(planning.closest("[hidden]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Offseason" }));
    expect(planning.closest("[hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: "Offseason" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Playoff bracket" }));
    fireEvent.click(screen.getByRole("button", { name: "Offseason" }));
    expect(screen.getByText("Offseason planning panel")).toBe(planning);
    expect(screen.getByText(/Runner-up: West Team 1/)).toBeTruthy();
    expect(screen.getByText(/Starting the next season is not available/)).toBeTruthy();
    expect(screen.queryByText(/Your team is eliminated/)).toBeNull();
  });

  it("does not promise more advancement to an eliminated team after the champion is crowned", () => {
    show(
      postseasonFixture({
        phase: "complete",
        championTeamId: postseasonId(1),
        runnerUpTeamId: postseasonId(16),
      }),
      16
    );
    expect(screen.getByText("Your team is eliminated")).toBeTruthy();
    expect(screen.queryByText(/You can still advance/)).toBeNull();
  });

  it("offers retry instead of an empty bracket on errors", () => {
    const refetch = vi.fn();
    query.mockReturnValue({ isError: true, isPending: false, refetch });
    render(
      <I18nProvider locale="en">
        <PostseasonView gameId={postseasonId(100)} selectedTeamId={postseasonId(1)} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(refetch).toHaveBeenCalledOnce();
  });
});

it("does not consider a first play-in loss elimination or a ready field a champion", () => {
  const game = postseasonGameFixture({ seriesId: null, stage: "seven_eight", gameNumber: null });
  const state = postseasonFixture({ phase: "play_in", games: [game] });
  expect(isTeamEliminated(state, postseasonId(8))).toBe(false);
  expect(
    isTeamEliminated({ ...state, games: [{ ...game, stage: "eighth_seed" }] }, postseasonId(8))
  ).toBe(true);
  expect(hasPostseasonChampion(postseasonFixture())).toBe(false);
  expect(hasPostseasonChampion(postseasonFixture({ phase: "complete" }))).toBe(false);
});
