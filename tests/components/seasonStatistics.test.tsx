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
  expect(query).toHaveBeenCalledWith("career", 2026);
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
