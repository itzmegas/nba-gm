// @vitest-environment happy-dom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GamePlayerDetailPage from "@/app/(protected)/games/[gameId]/dashboard/player/[id]/page";
import { useContractsByPlayer } from "@/application/hooks/contracts/useContracts";
import type { Contract } from "@/domain/entities/Contract";
import type { Player } from "@/domain/entities/Player";

vi.mock("@/app/ui-preview/fonts", () => ({
  body: { className: "barlow" },
  display: { className: "barlow-condensed" },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: game, isLoading: loading === "game" }),
}));
vi.mock("@/application/hooks/players/usePlayers", () => ({
  usePlayer: () => ({ data: player, isLoading: loading === "player" }),
}));
vi.mock("@/application/hooks/contracts/useContracts", () => ({
  useContractsByPlayer: vi.fn(() => ({ data: contract, isLoading: loading === "contract" })),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({ data: [{ id: "other-team" }], isLoading: loading === "teams" }),
}));

const playerFixture: Player = {
  id: "player",
  firstName: "Alex",
  lastName: "Morgan",
  fullName: "Alex Morgan",
  jerseyNumber: "0",
  position: "G",
  height: "6' 4\"",
  weight: "210",
  yearsOfExperience: 3,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const contractFixture: Contract = {
  id: "contract",
  gameId: "game",
  playerId: "player",
  teamId: "other-team",
  startYear: 2026,
  endYear: 2028,
  salaryY1: 10_000_000,
  salaryY2: 12_000_000,
  salaryY3: 14_000_000,
  salaryY4: 99_000_000,
  isGuaranteed: true,
  isPlayerOption: false,
  isTeamOption: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
let player: Player | null;
let contract: Contract | null;
let game: { seasonYear: number } | null;
let query: string;
let loading: string | null;

beforeEach(() => {
  player = { ...playerFixture };
  contract = { ...contractFixture };
  game = { seasonYear: 2027 };
  query = "";
  loading = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function showProfile() {
  await act(async () => {
    render(
      <Suspense fallback="Loading">
        <GamePlayerDetailPage params={Promise.resolve({ gameId: "game", id: "player" })} />
      </Suspense>
    );
  });
}

it("shows real identity, remaining contract years and salaries with the current season marked", async () => {
  await showProfile();
  const heading = screen.getByRole("heading", { level: 1, name: "Alex Morgan" });
  expect(heading.className).toContain("barlow-condensed");
  expect(screen.getByText("#0")).toBeTruthy();
  expect(screen.getByText("210 lbs")).toBeTruthy();
  expect(screen.getByText("2 años")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Alex Morgan" }).getAttribute("src")).toBe(
    "/player-silhouette.svg"
  );
  const table = screen.getByRole("table", { name: "Salarios por temporada" });
  expect(within(table).getAllByRole("row")).toHaveLength(4);
  expect(within(table).getByRole("cell", { name: "$10,000,000" })).toBeTruthy();
  const currentRow = within(table).getByText("Actual").closest("tr");
  expect(currentRow?.getAttribute("data-state")).toBe("selected");
  expect(currentRow?.textContent).toContain("27-28");
  expect(currentRow?.textContent).toContain("$12,000,000");
  expect(within(table).queryByText("$99,000,000")).toBeNull();
  expect(useContractsByPlayer).toHaveBeenCalledWith("game", "player");
  expect(document.querySelector("a button")).toBeNull();
  expect(document.documentElement.dataset.uiPreview).toBeUndefined();
});

it.each([
  ["", "Volver al roster", "/games/game/dashboard/roster"],
  [
    "leagueTeamId=other-team",
    "Volver a la franquicia",
    "/games/game/dashboard/league/teams/other-team",
  ],
  ["leagueTeamId=unknown", "Volver al roster", "/games/game/dashboard/roster"],
])("preserves return navigation for %s", async (search, label, href) => {
  query = search;
  await showProfile();
  expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
});

it("keeps zero salaries and unknown guarantees distinct from missing or negative values", async () => {
  contract = { ...contractFixture, salaryY1: 0, salaryY2: undefined, isGuaranteed: null };
  await showProfile();
  const table = screen.getByRole("table");
  expect(within(table).getByRole("cell", { name: "$0" })).toBeTruthy();
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("Garantizado").nextElementSibling?.textContent).toBe("Desconocido");
  expect(within(table).queryByText("Actual")).toBeNull();
});

it("returns to the validated franchise preserving filters, repeated values and its internal tab", async () => {
  const filters =
    "teamId=ignored&q=LA+%26+Boston&conference=West&division=Pacific&sort=record&tag=a&tag=b&franchiseTab=roster";
  query = new URLSearchParams({
    leagueTeamId: "other-team",
    leagueReturnQuery: filters,
  }).toString();
  await showProfile();
  const href = screen.getByRole("link", { name: "Volver a la franquicia" }).getAttribute("href");
  const target = new URL(href ?? "", "http://localhost");
  expect(target.pathname).toBe("/games/game/dashboard/league/teams/other-team");
  const expected = new URLSearchParams(filters);
  expected.delete("teamId");
  expect([...target.searchParams]).toEqual([...expected]);
});

it.each([
  undefined,
  "unknown",
  "https://evil.example/",
])("rejects return context without a valid league team: %s", async (leagueTeamId) => {
  const context = new URLSearchParams({
    leagueReturnQuery: "franchiseTab=finances&returnTo=https%3A%2F%2Fevil.example%2F",
    returnTo: "https://evil.example/",
  });
  if (leagueTeamId) context.set("leagueTeamId", leagueTeamId);
  query = context.toString();
  await showProfile();
  expect(screen.getByRole("link", { name: "Volver al roster" }).getAttribute("href")).toBe(
    "/games/game/dashboard/roster"
  );
});

it("treats a return path as query data, never as a navigation destination", async () => {
  query = new URLSearchParams({
    leagueTeamId: "other-team",
    leagueReturnQuery: "https://evil.example/",
  }).toString();
  await showProfile();
  const target = new URL(
    screen.getByRole("link", { name: "Volver a la franquicia" }).getAttribute("href") ?? "",
    "http://localhost"
  );
  expect(target.origin).toBe("http://localhost");
  expect(target.pathname).toBe("/games/game/dashboard/league/teams/other-team");
});

it.each([
  [true, false, false, "Sí", "Ninguna"],
  [false, true, false, "No", "Player"],
  [null, false, true, "Desconocido", "Team"],
])("retains guarantee and option information (%s / %s / %s)", async (guaranteed, playerOption, teamOption, guaranteeLabel, optionLabel) => {
  contract = {
    ...contractFixture,
    isGuaranteed: guaranteed,
    isPlayerOption: playerOption,
    isTeamOption: teamOption,
  };
  await showProfile();
  expect(screen.getByText("Garantizado").nextElementSibling?.textContent).toBe(guaranteeLabel);
  expect(screen.getByText("Opciones").nextElementSibling?.textContent).toBe(optionLabel);
});

it("retains inactive and unavailable identity states without fabricating statistics", async () => {
  player = {
    ...playerFixture,
    isActive: false,
    position: undefined,
    height: undefined,
    weight: undefined,
  };
  contract = null;
  await showProfile();
  expect(screen.getByText("Inactivo")).toBeTruthy();
  expect(screen.getByText("Sin posición")).toBeTruthy();
  expect(screen.getByText("Altura desc.")).toBeTruthy();
  expect(screen.getByText("Peso desc.")).toBeTruthy();
  expect(screen.getByText("El jugador actualmente no posee contrato.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByText("Las estadísticas y el scouting no están disponibles en esta vista.")
  ).toBeTruthy();
  expect(screen.queryByText(/El motor de simulación aún no generó/)).toBeNull();
});

it.each([
  "game",
  "player",
  "contract",
  "teams",
])("retains the loading state while %s is pending", async (pending) => {
  loading = pending;
  await showProfile();
  expect(screen.getByRole("status", { name: "Cargando perfil" })).toBeTruthy();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
});

it.each(["game", "player"])("keeps return navigation when %s is missing", async (missing) => {
  if (missing === "game") game = null;
  else player = null;
  query = "leagueTeamId=other-team";
  await showProfile();
  expect(screen.getByText("Jugador no encontrado")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Volver a la franquicia" }).getAttribute("href")).toBe(
    "/games/game/dashboard/league/teams/other-team"
  );
  expect(document.querySelector("a button")).toBeNull();
});
