// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { PostseasonStatus } from "@/components/postseason/PostseasonStatus";
import type { PlayoffSeries, PostseasonState } from "@/domain/entities/Postseason";
import {
  postseasonFixture,
  postseasonGameFixture,
  postseasonId,
  postseasonTeamsFixture,
} from "@/infrastructure/repositories/postseason.test-fixture";

afterEach(cleanup);
const selected = postseasonId(1);
const opponent = postseasonId(8);
const series: PlayoffSeries = {
  id: postseasonId(101),
  round: 1,
  conference: "East",
  bracketSlot: 1,
  homeTeamId: opponent,
  awayTeamId: selected,
  homeWins: 1,
  awayWins: 2,
  winnerTeamId: null,
};
function view(state: PostseasonState, locale: "en" | "es" = "en", summary = true) {
  return (
    <I18nProvider key={locale} locale={locale}>
      <PostseasonStatus
        summary={summary}
        state={state}
        selectedTeamId={selected}
        teams={postseasonTeamsFixture()}
      />
    </I18nProvider>
  );
}

it("keeps regular season honest and the default shared status unchanged", () => {
  const { rerender } = render(view(postseasonFixture({ phase: "regular_season" })));
  expect(screen.getByText(/Qualification is decided after/)).toBeTruthy();
  expect(screen.queryByText("Next scheduled game")).toBeNull();
  rerender(view(postseasonFixture(), "en", false));
  expect(screen.queryByText("Your team")).toBeNull();
});
it("orients the active series to our team and uses the earliest scheduled game only", () => {
  render(
    view(
      postseasonFixture({
        series: [series],
        games: [
          postseasonGameFixture(),
          postseasonGameFixture({ id: "later", status: "scheduled", gameDate: "2027-04-25" }),
          postseasonGameFixture({ id: "next", status: "scheduled", gameDate: "2027-04-23" }),
        ],
      })
    )
  );
  expect(screen.getByText("East Team 1 2–1")).toBeTruthy();
  expect(screen.getByText("2027-04-23")).toBeTruthy();
  expect(screen.queryByText("2027-04-25")).toBeNull();
});
it("shows play-in scheduling without inventing a series and localizes missing scheduling", () => {
  const { rerender } = render(
    view(
      postseasonFixture({
        phase: "play_in",
        games: [postseasonGameFixture({ stage: "seven_eight", status: "scheduled" })],
      })
    )
  );
  expect(screen.getByText("No active series")).toBeTruthy();
  expect(screen.getByText("2027-04-22")).toBeTruthy();
  rerender(view(postseasonFixture({ phase: "play_in" }), "es"));
  expect(screen.getByText("Sin serie en curso")).toBeTruthy();
  expect(screen.getByText("Todavía no hay un partido programado")).toBeTruthy();
});
it("does not offer an eliminated team a stale series or game", () => {
  render(
    view(
      postseasonFixture({
        series: [
          { ...series, winnerTeamId: opponent },
          { ...series, id: "stale" },
        ],
        games: [postseasonGameFixture({ status: "scheduled" })],
      })
    )
  );
  expect(screen.getByText(/Your team is eliminated/)).toBeTruthy();
  expect(screen.queryByText("Current series")).toBeNull();
  expect(screen.queryByText("Next scheduled game")).toBeNull();
});
it("features the champion with champion-first Finals score and a broken-logo fallback", () => {
  const state = postseasonFixture({
    phase: "complete",
    championTeamId: selected,
    runnerUpTeamId: opponent,
    series: [
      {
        ...series,
        conference: "Finals",
        round: 4,
        homeWins: 2,
        awayWins: 4,
        winnerTeamId: selected,
      },
    ],
  });
  const teams = postseasonTeamsFixture().map((team) => ({
    ...team,
    logoUrl: team.id === selected ? "/crest.png" : undefined,
  }));
  const { container } = render(
    <I18nProvider locale="en">
      <PostseasonStatus summary state={state} selectedTeamId={selected} teams={teams} />
    </I18nProvider>
  );
  expect(screen.getByText("4–2")).toBeTruthy();
  expect(screen.getByText(/Runner-up: East Team 8/)).toBeTruthy();
  const image = container.querySelector("img");
  if (!image) throw new Error("Missing champion crest");
  fireEvent.error(image);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("E1")).toBeTruthy();
  expect(screen.getByText(/Starting the next season is not available/)).toBeTruthy();
});
it("does not infer a champion or Finals result from incomplete data", () => {
  const { rerender } = render(view(postseasonFixture({ phase: "complete" })));
  expect(screen.queryByText(/Starting the next season/)).toBeNull();
  rerender(view(postseasonFixture({ phase: "complete", championTeamId: opponent }), "es"));
  expect(screen.getByText(/Resultado no disponible/)).toBeTruthy();
  expect(screen.queryByText("0–0")).toBeNull();
  expect(screen.getByText("Tu equipo está eliminado")).toBeTruthy();
});
