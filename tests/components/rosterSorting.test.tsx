// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { RosterTable } from "@/components/roster/roster-table";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const attributes = {
  closeShot: 80,
  midRangeShot: 80,
  threePointShot: 80,
  freeThrow: 80,
  drawFoul: 80,
  ballHandle: 80,
  passAccuracy: 80,
  interiorDefense: 80,
  perimeterDefense: 80,
  steal: 80,
  block: 80,
  offensiveRebound: 80,
  defensiveRebound: 80,
  stamina: 80,
};
const players = [
  {
    player: { id: "zulu", fullName: "Zulu", jerseyNumber: "10", height: "6' 10\"", position: "G" },
    contract: { salaryY1: 9_000 },
    ratings: { overall: 90, attributes },
    gameContract: null,
  },
  {
    player: { id: "alpha", fullName: "Alpha", jerseyNumber: "2", height: "6' 2\"", position: "C" },
    contract: { salaryY1: 1_000_000 },
    ratings: {
      overall: 99,
      attributes: Object.fromEntries(Object.keys(attributes).map((key) => [key, 9])),
    },
    gameContract: null,
  },
  {
    player: { id: "missing", fullName: "Missing" },
    contract: null,
    ratings: null,
    gameContract: null,
  },
] as unknown as RosterPlayer[];

function renderTable(rows = players, onSelectPlayer = vi.fn()) {
  render(
    <I18nProvider locale="en">
      <RosterTable
        gameId="game"
        players={rows}
        seasonYear={2026}
        onSelectPlayer={onSelectPlayer}
        selectedPlayerId="alpha"
      />
    </I18nProvider>
  );
}

function order() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) =>
        within(row).getByRole("button", { pressed: row.getAttribute("data-state") === "selected" })
          .textContent
    );
}

it("defaults to numeric salary descending and toggles with missing values last", () => {
  renderTable();
  expect(order()).toEqual(["Alpha", "Zulu", "Missing"]);
  const header = screen.getByRole("columnheader", { name: "Salary 26-27" });
  expect(header.getAttribute("aria-sort")).toBe("descending");
  fireEvent.click(within(header).getByRole("button"));
  expect(header.getAttribute("aria-sort")).toBe("ascending");
  expect(order()).toEqual(["Zulu", "Alpha", "Missing"]);
  fireEvent.click(within(header).getByRole("button"));
  expect(order()).toEqual(["Alpha", "Zulu", "Missing"]);
  expect(players.map(({ player }) => player.id)).toEqual(["zulu", "alpha", "missing"]);
});

it.each([
  "OVR",
  "CLOSE",
  "MID",
  "3PT",
  "FT",
  "FOUL",
  "HANDLE",
  "PASS",
  "INT D",
  "PER D",
  "STL",
  "BLK",
  "OREB",
  "DREB",
  "STA",
])("sorts %s numerically in both directions", (name) => {
  renderTable();
  const button = within(screen.getByRole("columnheader", { name })).getByRole("button");
  fireEvent.click(button);
  expect(order()).toEqual(
    name === "OVR" ? ["Alpha", "Zulu", "Missing"] : ["Zulu", "Alpha", "Missing"]
  );
  fireEvent.click(button);
  expect(order()).toEqual(
    name === "OVR" ? ["Zulu", "Alpha", "Missing"] : ["Alpha", "Zulu", "Missing"]
  );
});

it.each([
  "#",
  "Height",
  "Pos",
])("sorts %s ascending then descending with missing values last", (name) => {
  renderTable();
  fireEvent.click(screen.getByRole("button", { name }));
  expect(order()).toEqual(["Alpha", "Zulu", "Missing"]);
  fireEvent.click(screen.getByRole("button", { name }));
  expect(order()).toEqual(["Zulu", "Alpha", "Missing"]);
});

it("sorts player names, preserves selection and leaves actions unsortable", () => {
  const select = vi.fn();
  renderTable(players, select);
  fireEvent.click(screen.getByRole("button", { name: "Player" }));
  expect(order()).toEqual(["Alpha", "Missing", "Zulu"]);
  expect(screen.getByRole("button", { name: "Alpha", pressed: true })).toBeTruthy();
  expect(select).not.toHaveBeenCalled();
  expect(
    within(screen.getByRole("columnheader", { name: "Actions" })).queryByRole("button")
  ).toBeNull();
  expect(screen.getByRole("columnheader", { name: "Salary 26-27" }).getAttribute("aria-sort")).toBe(
    "none"
  );
});

it("treats zero as a value and preserves input order for ties", () => {
  const zero = {
    ...players[0],
    player: { ...players[0].player, id: "zero", fullName: "Zero" },
    contract: { ...players[0].contract, salaryY1: 0 },
  } as RosterPlayer;
  const tie = { ...players[0], player: { ...players[0].player, id: "tie", fullName: "Tie" } };
  renderTable([players[0], tie, zero, players[2]]);
  expect(order()).toEqual(["Zulu", "Tie", "Zero", "Missing"]);
  fireEvent.click(screen.getByRole("button", { name: "Salary 26-27" }));
  expect(order()).toEqual(["Zero", "Zulu", "Tie", "Missing"]);
});
