// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlayersPage from "@/app/(protected)/games/[gameId]/dashboard/league/players/page";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import {
  directoryPlayerHref,
  parsePlayersFilters,
  playersHref,
} from "@/components/league/players-navigation";

const mocks = vi.hoisted(() => ({
  game: vi.fn(),
  players: vi.fn(),
  teams: vi.fn(),
  query: "",
  listeners: new Set<() => void>(),
  retry: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        (listener) => {
          mocks.listeners.add(listener);
          return () => mocks.listeners.delete(listener);
        },
        () => mocks.query
      )
    ),
}));
vi.mock("@/app/ui-preview/fonts", () => ({ display: { className: "" } }));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: mocks.game }));
vi.mock("@/application/hooks/players/useGamePlayers", () => ({ useGamePlayers: mocks.players }));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: mocks.teams }));
const teamId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const rows: RosterPlayer[] = Array.from({ length: 22 }, (_, index) => ({
  player: {
    id: index === 0 ? firstId : `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
    firstName: "Player",
    lastName: String(index),
    fullName: `Player ${String(index).padStart(2, "0")}`,
    position: "G",
    teamId: index === 1 ? undefined : teamId,
    isActive: index !== 2,
    yearsOfExperience: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  contract: null,
  gameContract: null,
  ratings: null,
}));

beforeEach(() => {
  mocks.query = "";
  mocks.retry.mockClear();
  const query = { isLoading: false, isError: false, refetch: mocks.retry };
  mocks.game.mockReturnValue({ ...query, data: { seasonYear: 2026, selectedTeamId: teamId } });
  mocks.players.mockReturnValue({ ...query, data: rows });
  mocks.teams.mockReturnValue({ ...query, data: [{ id: teamId, name: "Current team" }] });
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => {
    mocks.query = new URL(String(url), "http://localhost").search.slice(1);
    for (const listener of mocks.listeners) listener();
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function show(locale: "en" | "es" = "en") {
  await act(async () => {
    render(
      <I18nProvider locale={locale}>
        <PlayersPage params={Promise.resolve({ gameId: "game" })} />
      </I18nProvider>
    );
  });
}

it("renders current teams, inactive/free-agent state, own identity and safe profile context", async () => {
  await show();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(21);
  expect(within(table).getByText("No team")).toBeTruthy();
  expect(within(table).getByText("Inactive")).toBeTruthy();
  const link = screen.getByRole("link", { name: "View full profile" });
  const href = new URL(link.getAttribute("href") ?? "", "http://localhost");
  expect(href.pathname).toBe(`/games/game/dashboard/player/${firstId}`);
  expect(href.searchParams.get("playersReturn")).toBe("1");
  expect(href.searchParams.get("playersReturnQuery")).toContain(firstId);
  expect(screen.queryByText("Explore Trade")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Search players"), { target: { value: "Player 01" } });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Search players"), { target: { value: "not present" } });
  expect(screen.getByText("No players match these filters.")).toBeTruthy();
  expect(screen.queryByRole("complementary")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(within(table).getAllByRole("row")).toHaveLength(21);
});

it.each([
  "row",
  "portrait",
  "name",
])("selects another player through the %s and updates the inspector", async (target) => {
  await show();
  const first = screen.getByRole("button", { name: "Player 00", pressed: true });
  const next = screen.getByRole("button", { name: "Player 03", pressed: false });
  const row = next.closest("tr");
  if (!row) throw new Error("Missing player row");
  const clickTarget =
    target === "row"
      ? within(row).getAllByRole("cell")[1]
      : target === "portrait"
        ? within(row).getByRole("presentation")
        : next;
  fireEvent.click(clickTarget);
  expect(window.history.replaceState).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Player 03", pressed: true })).toBeTruthy();
  expect(first.getAttribute("aria-pressed")).toBe("false");
  const inspector = screen.getByRole("complementary");
  expect(within(inspector).getByRole("heading", { name: "Player 03" })).toBeTruthy();
  const href = new URL(
    within(inspector).getByRole("link", { name: "View full profile" }).getAttribute("href") ?? "",
    "http://localhost"
  );
  expect(href.pathname).toBe(`/games/game/dashboard/player/${rows[3].player.id}`);
  expect(
    new URLSearchParams(href.searchParams.get("playersReturnQuery") ?? "").get("selected")
  ).toBe(rows[3].player.id);
});

it.each([
  "teamId=free",
  "status=inactive",
  "position=C",
])("applies validated URL filters: %s", async (query) => {
  mocks.query = query;
  await show();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
    query === "position=C" ? 1 : 2
  );
});

it("localizes the directory and does not show stale partial data on errors", async () => {
  mocks.players.mockReturnValue({
    data: rows,
    isError: true,
    isLoading: false,
    refetch: mocks.retry,
  });
  await show("es");
  expect(screen.getByRole("alert").textContent).toContain("No se pudo cargar");
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(mocks.retry).toHaveBeenCalledTimes(3);
});

it("shows loading before rendering data", async () => {
  mocks.players.mockReturnValue({ isLoading: true, data: undefined });
  await show();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
});

it.each(["en", "es"] as const)("renders the localized working directory (%s)", async (locale) => {
  await show(locale);
  expect(
    screen.getByRole("heading", { name: locale === "en" ? "NBA Players" : "Jugadores NBA" })
  ).toBeTruthy();
  expect(
    screen.getByRole("link", {
      name: locale === "en" ? "View full profile" : "Ver perfil completo",
    })
  ).toBeTruthy();
});

it("sorts supplied OVR before missing values and preserves selection in profile context", async () => {
  mocks.query = "sort=overall";
  mocks.players.mockReturnValue({
    data: rows.map((row, index) =>
      index === 5 ? { ...row, ratings: { overall: 85, estimated: true } } : row
    ),
    isLoading: false,
    isError: false,
  });
  await show();
  const tableRows = within(screen.getByRole("table")).getAllByRole("row");
  expect(tableRows[1].textContent).toContain("Player 05");
  expect(tableRows[1].textContent).toContain("Estimated ratings");
  fireEvent.click(screen.getByRole("button", { name: "Player 03" }));
  const link = screen.getByRole("link", { name: "View full profile" });
  const href = new URL(link.getAttribute("href") ?? "", "http://localhost");
  expect(href.pathname).toContain(rows[3].player.id);
  expect(href.searchParams.get("playersReturnQuery")).toContain(`selected=${rows[3].player.id}`);
});

it("allowlists return filters and cannot navigate to an external URL", () => {
  expect(parsePlayersFilters(`page=-3&status=other&q=${"x".repeat(121)}`)).toMatchObject({
    page: 1,
    status: "all",
    q: "",
  });
  expect(
    playersHref("game", "returnTo=https://evil.example&teamId=invalid&selected=invalid&position=no")
  ).toBe("/games/game/dashboard/league/players");
  const context = `q=Player&teamId=${teamId}&selected=${firstId}&page=2`;
  const href = new URL(directoryPlayerHref("game", firstId, context), "http://localhost");
  expect(playersHref("game", href.searchParams.get("playersReturnQuery") ?? "")).toContain(
    "page=2"
  );
});

it.each([
  "invalid",
  "../players",
  "javascript:alert(1)",
  "https://evil.example",
  "33333333-3333-f333-0333-000000000003",
])("rejects invalid player and team IDs %j without broadening the return boundary", (id) => {
  const query = new URLSearchParams({ selected: id, teamId: id, returnTo: "https://evil.example" });
  expect(parsePlayersFilters(query.toString())).toMatchObject({ selected: "", teamId: "all" });
  expect(playersHref("game", query.toString())).toBe("/games/game/dashboard/league/players");
});
