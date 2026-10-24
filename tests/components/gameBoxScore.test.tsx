// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { GameBoxScore } from "@/components/games/GameBoxScore";
import { boxScoreFixture } from "@/infrastructure/repositories/boxScore.test-fixture";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/application/hooks/schedule/useBoxScore", () => ({ useBoxScore: query }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderScore(locale: "en" | "es" = "en") {
  const view = render(
    <I18nProvider locale={locale}>
      <GameBoxScore gameId="career" fixtureId="fixture" homeLabel="Home" awayLabel="Away" />
    </I18nProvider>
  );
  const details = view.container.querySelector("details");
  if (!details) throw new Error("Missing box score disclosure");
  return {
    open: () => {
      details.open = true;
      fireEvent(details, new Event("toggle"));
    },
  };
}

it("loads only when opened and displays the saved individual shooting and exact minutes", () => {
  query.mockReturnValue({ data: boxScoreFixture(), isPending: false, isError: false });
  const view = renderScore();
  expect(query).not.toHaveBeenCalled();
  view.open();
  expect(query).toHaveBeenCalledWith("career", "fixture");
  expect(screen.getAllByRole("table")).toHaveLength(2);
  expect(screen.getByText("Home · 10")).toBeTruthy();
  expect(screen.getByText("Player 1")).toBeTruthy();
  expect(screen.getByText("5-8")).toBeTruthy();
  expect(screen.getAllByText("48:00")).toHaveLength(10);
});

it("explains unavailable historical statistics in Spanish without inventing values", () => {
  query.mockReturnValue({ data: null, isPending: false, isError: false });
  renderScore("es").open();
  expect(screen.getByText(/Se conserva el resultado original/)).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("shows loading and offers retry on a failed request", () => {
  const retry = vi.fn();
  query.mockReturnValue({ isPending: true, isError: false });
  const view = renderScore();
  view.open();
  expect(screen.getByRole("status").textContent).toContain("Loading");
  cleanup();
  query.mockReturnValue({ isPending: false, isError: true, refetch: retry });
  renderScore().open();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
