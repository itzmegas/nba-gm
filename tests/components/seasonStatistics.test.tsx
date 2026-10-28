// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { SeasonStatistics } from "@/components/games/SeasonStatistics";
import { boxScoreFixture } from "@/infrastructure/repositories/boxScore.test-fixture";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/application/hooks/schedule/useSeasonStatistics", () => ({ useSeasonStatistics: query }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function show(locale: "en" | "es" = "en") {
  render(
    <I18nProvider locale={locale}>
      <SeasonStatistics gameId="career" seasonYear={2026} />
    </I18nProvider>
  );
}

it("switches totals and averages, sorts, and discloses missing coverage", () => {
  const players = boxScoreFixture()
    .players.slice(0, 2)
    .map((p) => ({ ...p, gamesPlayed: 2, totals: p }));
  query.mockReturnValue({
    data: { completedGames: 3, coveredGames: 2, players },
    isPending: false,
    isError: false,
  });
  show();
  expect(query).toHaveBeenCalledWith("career", 2026, "regular_season");
  expect(screen.getByText(/Partial coverage/)).toBeTruthy();
  const row = screen.getByRole("rowheader", { name: players[0].playerName }).closest("tr");
  if (!row) throw new Error("Missing player row");
  expect(within(row).getAllByRole("cell")[2].textContent).toBe((players[0].points / 2).toFixed(1));
  fireEvent.click(screen.getByRole("button", { name: "Totals" }));
  expect(within(row).getAllByRole("cell")[2].textContent).toBe(String(players[0].points));
  fireEvent.click(screen.getByRole("button", { name: /Player/ }));
  expect(screen.getAllByRole("columnheader")[0].getAttribute("aria-sort")).toBe("ascending");
  expect(screen.getAllByRole("rowheader").map((node) => node.textContent)).toEqual(
    players.map((p) => p.playerName).sort()
  );
});

it.each([false, true])("selects separate phases for the roster view: %s", async (roster) => {
  const player = boxScoreFixture().players[0];
  query.mockImplementation((_gameId, _seasonYear, phase) => ({
    data: {
      completedGames: phase === "regular_season" ? 82 : phase === "play_in" ? 2 : 0,
      coveredGames: phase === "regular_season" ? 82 : phase === "play_in" ? 2 : 0,
      players: phase === "playoffs" ? [] : [{ ...player, gamesPlayed: 2, totals: player }],
    },
    isPending: false,
    isError: false,
  }));
  render(
    <I18nProvider locale="en">
      <SeasonStatistics
        gameId="career"
        seasonYear={2026}
        players={roster ? [{ id: player.playerId, fullName: player.playerName }] : undefined}
      />
    </I18nProvider>
  );
  const selector = screen.getByRole("combobox", { name: "Competition phase" });
  expect(selector.textContent).toContain("Regular season");
  expect(screen.getByText(/82 \/ 82/)).toBeTruthy();
  fireEvent.keyDown(selector, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "Play-in" }));
  expect(query).toHaveBeenLastCalledWith("career", 2026, "play_in");
  expect(screen.getByText(/2 \/ 2/)).toBeTruthy();
  fireEvent.keyDown(selector, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "Playoffs" }));
  expect(query).toHaveBeenLastCalledWith("career", 2026, "playoffs");
  expect(screen.getByText(/0 \/ 0/)).toBeTruthy();
  expect(screen.queryByText(/Partial coverage/)).toBeNull();
  if (roster) {
    expect(screen.getByText(/No recorded appearances/)).toBeTruthy();
    expect(screen.getAllByRole("cell").every((cell) => cell.textContent === "—")).toBe(true);
  } else {
    expect(screen.getByText("No recorded appearances yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  }
  fireEvent.keyDown(selector, { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: "Regular season" }));
  expect(query).toHaveBeenLastCalledWith("career", 2026, "regular_season");
  expect(screen.getByText(/82 \/ 82/)).toBeTruthy();
});

it("shows an empty state in Spanish without fabricating rows", () => {
  query.mockReturnValue({
    data: { completedGames: 1, coveredGames: 0, players: [] },
    isPending: false,
    isError: false,
  });
  show("es");
  expect(screen.getByText(/Cobertura parcial/)).toBeTruthy();
  expect(screen.getByText(/Todavía no hay participaciones/)).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("distinguishes loading from errors and supports retry", () => {
  query.mockReturnValue({ isPending: true });
  show();
  expect(screen.getByRole("status")).toBeTruthy();
  cleanup();
  const refetch = vi.fn();
  query.mockReturnValue({ isPending: false, isError: true, refetch });
  show();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalledOnce();
});
