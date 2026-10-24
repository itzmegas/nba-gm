// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DailyGamesPage from "@/app/(protected)/games/[gameId]/dashboard/schedule/day/[date]/page";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { DailyGames } from "@/components/games/DailyGames";
import { boxScoreFixture } from "@/infrastructure/repositories/boxScore.test-fixture";

const { game, schedule, teams, score, push } = vi.hoisted(() => ({
  game: vi.fn(),
  schedule: vi.fn(),
  teams: vi.fn(),
  score: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: game }));
vi.mock("@/application/hooks/schedule/useSchedule", () => ({ useSchedule: schedule }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: teams }));
vi.mock("@/application/hooks/schedule/useBoxScore", () => ({ useBoxScore: score }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  game.mockReturnValue({ data: { selectedTeamId: "chi" }, isLoading: false, isError: false });
  teams.mockReturnValue({
    data: [
      { id: "chi", name: "Chicago Bulls", abbreviation: "CHI" },
      { id: "bos", name: "Boston Celtics", abbreviation: "BOS" },
      { id: "lal", name: "Los Angeles Lakers", abbreviation: "LAL" },
      { id: "nyk", name: "New York Knicks", abbreviation: "NYK" },
    ],
    isLoading: false,
    isError: false,
  });
  schedule.mockReturnValue({
    data: [
      {
        id: "other",
        date: "2026-10-16",
        homeTeamId: "nyk",
        awayTeamId: "lal",
        status: "scheduled",
      },
      {
        id: "own",
        date: "2026-10-16",
        homeTeamId: "chi",
        awayTeamId: "bos",
        status: "completed",
        homeScore: 114,
        awayScore: 102,
      },
      {
        id: "past",
        date: "2026-10-14",
        homeTeamId: "bos",
        awayTeamId: "chi",
        status: "completed",
        homeScore: 100,
        awayScore: 90,
      },
      {
        id: "future",
        date: "2026-10-20",
        homeTeamId: "chi",
        awayTeamId: "lal",
        status: "scheduled",
      },
    ],
    isLoading: false,
    isError: false,
  });
  score.mockReturnValue({ data: boxScoreFixture(), isPending: false, isError: false });
});
afterEach(cleanup);

function view(date = "2026-10-16", locale: "en" | "es" = "en") {
  return (
    <I18nProvider locale={locale}>
      <DailyGames gameId="career" date={date} />
    </I18nProvider>
  );
}

it("includes every game that day, highlights ours first and loads box scores only on demand", () => {
  render(view());
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(screen.getAllByRole("article")[0].getAttribute("aria-label")).toBe(
    "Boston Celtics @ Chicago Bulls"
  );
  expect(screen.getByText("Your game")).toBeTruthy();
  expect(screen.getByText("114")).toBeTruthy();
  expect(score).not.toHaveBeenCalled();
  const scheduled = screen.getByRole("article", { name: "Los Angeles Lakers @ New York Knicks" });
  expect(within(scheduled).queryByText("Box score")).toBeNull();
  const details = screen
    .getByRole("article", { name: "Boston Celtics @ Chicago Bulls" })
    .querySelector("details");
  if (!details) throw new Error("Missing box score");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(score).toHaveBeenCalledWith("career", "own");
  expect(screen.getAllByRole("table")).toHaveLength(2);
});

it("navigates to adjacent scheduled days and lets the date picker select a day", () => {
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Previous game day" }));
  expect(push).toHaveBeenLastCalledWith("/games/career/dashboard/schedule/day/2026-10-14");
  fireEvent.click(screen.getByRole("button", { name: "Next game day" }));
  expect(push).toHaveBeenLastCalledWith("/games/career/dashboard/schedule/day/2026-10-20");
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-18" } });
  expect(push).toHaveBeenLastCalledWith("/games/career/dashboard/schedule/day/2026-10-18");
  push.mockClear();
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Back to calendar" }).getAttribute("href")).toBe(
    "/games/career/dashboard/schedule"
  );
});

it("handles empty dates in Spanish and disables navigation at schedule boundaries", () => {
  const { rerender } = render(view("2026-10-18", "es"));
  expect(screen.getByText("No hay partidos programados para esta fecha.")).toBeTruthy();
  rerender(view("2026-10-14", "es"));
  expect(screen.getByRole("button", { name: "Jornada anterior" }).hasAttribute("disabled")).toBe(
    true
  );
  rerender(view("2026-10-20", "es"));
  expect(screen.getByRole("button", { name: "Jornada siguiente" }).hasAttribute("disabled")).toBe(
    true
  );
});

it("distinguishes loading and errors and retries failed reads", () => {
  schedule.mockReturnValue({ isLoading: true });
  const { rerender } = render(view());
  expect(screen.getByRole("status")).toBeTruthy();
  const retry = vi.fn();
  game.mockReturnValue({ data: { selectedTeamId: "chi" }, refetch: retry });
  teams.mockReturnValue({ refetch: retry });
  schedule.mockReturnValue({ isError: true, refetch: retry });
  rerender(view());
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(3);
});

it("preserves old scores and reports missing box scores without inventing statistics", () => {
  score.mockReturnValue({ data: null, isPending: false, isError: false });
  render(view("2026-10-14"));
  expect(screen.getByText("100")).toBeTruthy();
  const details = screen.getByRole("article").querySelector("details");
  if (!details) throw new Error("Missing historical game disclosure");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(screen.getByText(/Existing results are preserved/)).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it.each([
  "not-a-date",
  "2026-02-30",
  "2026-13-01",
])("rejects invalid route date %s", async (date) => {
  await expect(
    DailyGamesPage({ params: Promise.resolve({ gameId: "career", date }) })
  ).rejects.toThrow("NOT_FOUND");
});

it("passes a valid URL date and career through the route unchanged", async () => {
  const page = await DailyGamesPage({
    params: Promise.resolve({ gameId: "career", date: "2028-02-29" }),
  });
  expect(page.props).toEqual({ gameId: "career", date: "2028-02-29" });
});
