// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SchedulePage from "@/app/(protected)/games/[gameId]/dashboard/schedule/page";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { Calendar } from "@/components/games/Calendar";

const teams = [
  { id: "chi", name: "Chicago Bulls", abbreviation: "CHI", logoUrl: "/chi.png" },
  { id: "bos", name: "Boston Celtics", abbreviation: "BOS", logoUrl: "/bos.png" },
  { id: "lal", name: "Los Angeles Lakers", abbreviation: "LAL", logoUrl: "/lal.png" },
  { id: "unknown", name: "Unknown team", abbreviation: "ZZZ" },
];

vi.mock("@/application", () => ({
  useTeams: () => ({ data: teams, isLoading: false, isError: false }),
}));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({
    data: { selectedTeamId: "chi", simulationDate: new Date("2026-10-16T00:00:00Z") },
    isLoading: false,
    isError: false,
  }),
}));
const { schedule, boxScore } = vi.hoisted(() => ({ schedule: vi.fn(), boxScore: vi.fn() }));
vi.mock("@/application/hooks/schedule/useSchedule", () => ({ useSchedule: schedule }));
vi.mock("@/application/hooks/schedule/useBoxScore", () => ({ useBoxScore: boxScore }));

beforeEach(() => {
  boxScore.mockReset();
  boxScore.mockReturnValue({ data: null, isPending: false, isError: false });
  schedule.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [
      {
        id: "selected",
        date: "2026-10-16",
        homeTeamId: "chi",
        awayTeamId: "bos",
        status: "completed",
        homeScore: 114,
        awayScore: 102,
      },
      {
        id: "other",
        date: "2026-10-16",
        homeTeamId: "bos",
        awayTeamId: "lal",
        status: "scheduled",
      },
      {
        id: "fallback",
        date: "2026-10-17",
        homeTeamId: "unknown",
        awayTeamId: "chi",
        status: "scheduled",
      },
    ],
  });
});
afterEach(cleanup);

function calendar(date = "2026-10-16") {
  return (
    <I18nProvider locale="en">
      <Calendar gameId="game" selectedTeamId="chi" simulationDate={new Date(`${date}T00:00:00Z`)} />
    </I18nProvider>
  );
}

it("features the opponent logo and brand tint without hiding home/away, scores or results", () => {
  render(calendar());
  const game = screen.getByTitle("Boston Celtics @ Chicago Bulls");
  expect(game.querySelector("img")?.getAttribute("src")).toContain("bos.png");
  expect(
    game.closest<HTMLElement>("[data-calendar-date]")?.style.getPropertyValue("--opponent-color")
  ).toBe("#007A33");
  expect(within(game).getByText("Home · BOS")).toBeTruthy();
  expect(within(game).getByText("102-114")).toBeTruthy();
  expect(within(game).getByText("Victory")).toBeTruthy();
  expect(game.closest("[data-calendar-date]")?.classList.contains("min-h-40")).toBe(true);
});

it("keeps a neutral abbreviation fallback for missing logos and unknown brand colors", () => {
  render(calendar());
  const game = screen.getByTitle("Chicago Bulls @ Unknown team");
  expect(game.querySelector("img")).toBeNull();
  expect(
    game.closest<HTMLElement>("[data-calendar-date]")?.style.getPropertyValue("--opponent-color")
  ).toBe("var(--muted-foreground)");
  expect(within(game).getByText("ZZZ")).toBeTruthy();
  expect(within(game).getByText("Away · ZZZ")).toBeTruthy();
  expect(within(game).getByText("Scheduled")).toBeTruthy();
});

it("uses one tinted day surface, an unframed larger logo and a restrained current-day marker", () => {
  render(calendar());
  const game = screen.getByTitle("Boston Celtics @ Chicago Bulls");
  const day = game.closest("[data-calendar-date]");
  const logo = game.querySelector("img");
  expect(game.classList.contains("border")).toBe(false);
  expect(logo?.getAttribute("width")).toBe("64");
  expect(logo?.classList.contains("bg-white")).toBe(false);
  expect(day?.classList.contains("bg-primary/15")).toBe(false);
  expect(day?.classList.contains("ring-inset")).toBe(true);
});

it("opens only our game and loads its box score directly", async () => {
  render(calendar());
  expect(boxScore).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTitle("Boston Celtics @ Chicago Bulls"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByText(/Los Angeles Lakers/)).toBeNull();
  expect(within(dialog).getByText("114")).toBeTruthy();
  expect(within(dialog).getByText("102")).toBeTruthy();
  expect(boxScore).toHaveBeenCalledWith("game", "selected");
  expect(dialog.querySelector("details")).toBeNull();
  expect(within(dialog).getByText(/Existing results are preserved/)).toBeTruthy();
});

it("links remaining games to the full daily-results route, without opening a dialog", () => {
  render(calendar());
  const link = screen.getByRole("link", { name: "View games 2 games 2026-10-16" });
  expect(link.getAttribute("href")).toBe("/games/game/dashboard/schedule/day/2026-10-16");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(boxScore).not.toHaveBeenCalled();
});

it("shows only scheduled details for our future game without requesting statistics", async () => {
  render(calendar());
  fireEvent.click(screen.getByTitle("Chicago Bulls @ Unknown team"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Scheduled")).toBeTruthy();
  expect(boxScore).not.toHaveBeenCalled();
});

it("links to league games on a day when our team does not play", () => {
  schedule.mockReturnValue({
    isLoading: false,
    isError: false,
    data: [
      {
        id: "other",
        date: "2026-10-16",
        homeTeamId: "bos",
        awayTeamId: "lal",
        status: "scheduled",
      },
    ],
  });
  render(calendar());
  expect(
    screen.getByRole("link", { name: "View games 1 games 2026-10-16" }).getAttribute("href")
  ).toBe("/games/game/dashboard/schedule/day/2026-10-16");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("preserves the manually browsed month during a simulation update within the same month", () => {
  const view = render(calendar());
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy();
  view.rerender(calendar("2026-10-17"));
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy();
});

it("reclaims the page heading space while retaining an accessible calendar heading", async () => {
  const params = Promise.resolve({ gameId: "game" });
  await act(async () => {
    render(
      <I18nProvider locale="en">
        <Suspense fallback="Loading">
          <SchedulePage params={params} />
        </Suspense>
      </I18nProvider>
    );
  });
  expect(
    screen.getByRole("heading", { name: "Calendar", level: 1 }).classList.contains("sr-only")
  ).toBe(true);
  expect(screen.queryByText("Scheduled games for the season.")).toBeNull();
  expect(document.querySelector('[data-slot="schedule-screen"]')).toBeTruthy();
});
