// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { OffseasonPanel } from "@/components/offseason/OffseasonPanel";

const { game, entry, enter, roster, outlook, mutate, retryEntry, retryRoster } = vi.hoisted(() => ({
  game: vi.fn(),
  entry: vi.fn(),
  enter: vi.fn(),
  roster: vi.fn(),
  outlook: vi.fn(),
  mutate: vi.fn(),
  retryEntry: vi.fn(),
  retryRoster: vi.fn(),
}));
vi.mock("@/application/hooks/games/useGame", () => ({ useGame: game }));
vi.mock("@/components/offseason/OffseasonContractLedger", () => ({
  OffseasonContractLedger: () => null,
}));
vi.mock("@/application/hooks/offseason/useOffseason", () => ({ useOffseason: entry }));
vi.mock("@/application/hooks/offseason/useEnterOffseason", () => ({ useEnterOffseason: enter }));
vi.mock("@/application/hooks/roster/useRoster", () => ({ useRoster: roster }));
vi.mock("@/domain/services/OffseasonContractOutlook", () => ({
  getOffseasonContractOutlook: outlook,
}));

const persistedEntry = { seasonYear: 2026, enteredAt: "2027-06-10T00:00:00Z" };

function playerRow(name: string): RosterPlayer {
  return {
    player: {
      id: name,
      firstName: name,
      lastName: "Player",
      fullName: `${name} Player`,
      yearsOfExperience: 3,
      isActive: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    contract: null,
    gameContract: null,
  };
}

function show(locale: "en" | "es" = "en") {
  return render(
    <I18nProvider locale={locale}>
      <OffseasonPanel gameId="career" selectedTeamId="toronto" />
    </I18nProvider>
  );
}

beforeEach(() => {
  game.mockReturnValue({ data: { seasonYear: 2026 }, isPending: false, isError: false });
  entry.mockReturnValue({ data: null, isPending: false, isError: false, refetch: retryEntry });
  enter.mockReturnValue({ mutate, isPending: false, isError: false });
  roster.mockReturnValue({ data: [], isPending: false, isError: false, refetch: retryRoster });
  outlook.mockReturnValue({ status: "unknown", nextSalary: null, estimated: false });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("read-only offseason entry", () => {
  it.each([
    "en",
    "es",
  ] as const)("labels planning and separates the read-only outlook (%s)", (locale) => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    show(locale);
    expect(
      screen.getByText(
        locale === "en"
          ? "PLANNING · No contract execution"
          : "PLANIFICACIÓN · Sin ejecutar contratos"
      )
    ).toBeTruthy();
    const region = screen.getByRole("region", {
      name:
        locale === "en"
          ? "Selected team · Next-season contract outlook"
          : "Equipo seleccionado · Perspectiva contractual para la siguiente temporada",
    });
    expect(within(region).getByRole("heading", { level: 3 })).toBeTruthy();
    expect(region.textContent).toContain(
      locale === "en" ? "no options are exercised" : "no ejerce opciones"
    );
    expect(
      screen.getByText(
        locale === "en"
          ? /next season is not playable yet/
          : /siguiente temporada todavía no se puede jugar/
      )
    ).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });
  it("explains preservation, waits for entry before reading the roster, and submits the current career/year once", () => {
    show();
    expect(entry).toHaveBeenCalledWith("career", 2026);
    expect(roster).toHaveBeenCalledWith(null, "toronto");
    expect(
      screen.getByText(/without changing the current season, simulation date, roster, or history/)
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: "Enter offseason planning" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledOnce();
    expect(mutate).toHaveBeenCalledWith(
      { gameId: "career", seasonYear: 2026 },
      expect.objectContaining({ onSettled: expect.any(Function) })
    );
  });

  it("disables the action while entry is pending", () => {
    enter.mockReturnValue({ mutate, isPending: true, isError: false });
    show();
    const button = screen.getByRole("button", { name: "Opening offseason…" });
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows entry failure and permits retry after the mutation settles", () => {
    enter.mockReturnValue({ mutate, isPending: false, isError: true });
    mutate.mockImplementation((_variables, options) => options.onSettled());
    show();
    expect(screen.getByRole("alert").textContent).toContain("the season remains unchanged");
    const button = screen.getByRole("button", { name: "Enter offseason planning" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it("does not offer entry while its persisted status is loading", () => {
    entry.mockReturnValue({ data: undefined, isPending: true, isError: false });
    show();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(roster).toHaveBeenCalledWith(null, "toronto");
  });

  it("does not treat an entry-read error as an unentered offseason", () => {
    entry.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: retryEntry,
    });
    show();
    expect(screen.queryByRole("button", { name: "Enter offseason planning" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Unable to confirm offseason entry");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryEntry).toHaveBeenCalledOnce();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows persisted planning, every outlook category and explicit unknown salary without decisions", () => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    roster.mockReturnValue({
      data: ["Expiring", "PlayerOption", "TeamOption", "Continuing", "Unknown"].map(playerRow),
      isPending: false,
      isError: false,
    });
    for (const value of [
      { status: "expiring", nextSalary: null, estimated: false },
      { status: "player_option", nextSalary: 12_000_000, estimated: false },
      { status: "team_option", nextSalary: 8_000_000, estimated: false },
      { status: "continuing", nextSalary: 2_000_000, estimated: true },
      { status: "unknown", nextSalary: null, estimated: false },
    ])
      outlook.mockReturnValueOnce(value);
    show();
    expect(roster).toHaveBeenCalledWith("career", "toronto");
    expect(screen.getByRole("status").textContent).toBe("Offseason planning open");
    expect(screen.getByText(/contract outlook · 27-28/)).toBeTruthy();
    const table = screen.getByRole("table");
    for (const label of [
      "Expiring contract",
      "Player option",
      "Team option",
      "Known next-season coverage",
      "Unknown contract outlook",
      "Estimated",
      "$12,000,000",
    ]) {
      expect(within(table).getByText(label)).toBeTruthy();
    }
    for (const label of ["Unknown contract outlook", "Known next-season coverage", "Estimated"]) {
      const badge = within(table).getByText(label);
      expect(badge.getAttribute("data-slot")).toBe("badge");
      expect(badge.classList.contains("whitespace-normal")).toBe(true);
    }
    const salaryHeader = within(table).getAllByRole("columnheader")[2];
    expect(salaryHeader.classList.contains("text-right")).toBe(true);
    const salaryCell = within(table).getByText("$12,000,000");
    expect(salaryCell.classList.contains("text-right")).toBe(true);
    expect(salaryCell.classList.contains("tabular-nums")).toBe(true);
    const unknown = screen.getByRole("row", { name: /Unknown Player/ });
    expect(within(unknown).getByText("Unknown salary")).toBeTruthy();
    expect(unknown.textContent).not.toContain("$0");
    expect(outlook).toHaveBeenCalledWith(null, null, 2026);
    expect(screen.getByText(/no options are exercised/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("pairs the visible identity with house headshots and a missing/broken-photo fallback", () => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    const known = playerRow("Known");
    known.player.headshotUrl = "https://cdn.nba.com/headshots/nba/latest/260x190/1630567.png";
    roster.mockReturnValue({
      data: [known, playerRow("Missing")],
      isPending: false,
      isError: false,
    });
    show();
    const knownRow = screen.getByRole("row", { name: /Known Player/ });
    const missingRow = screen.getByRole("row", { name: /Missing Player/ });
    const portrait = knownRow.querySelector("img");
    expect(portrait?.getAttribute("src")).toBe(known.player.headshotUrl);
    expect(portrait?.getAttribute("alt")).toBe("");
    expect(missingRow.querySelector("img")?.getAttribute("src")).toBe("/player-silhouette.svg");
    if (!portrait) throw new Error("Missing player portrait");
    fireEvent.error(portrait);
    expect(portrait.getAttribute("src")).toBe("/player-silhouette.svg");
    expect(within(knownRow).getByText("Known Player")).toBeTruthy();
  });

  it("keeps persisted status visible while the roster is loading", () => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    roster.mockReturnValue({ isPending: true, isError: false });
    show();
    expect(screen.getByText("Offseason planning open")).toBeTruthy();
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("offers roster retry without offering entry again", () => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    roster.mockReturnValue({ isPending: false, isError: true, refetch: retryRoster });
    show();
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the contract outlook");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryRoster).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Enter offseason planning" })).toBeNull();
  });

  it("shows an empty roster in Spanish without inventing contracts", () => {
    entry.mockReturnValue({ data: persistedEntry, isPending: false, isError: false });
    show("es");
    expect(screen.getByRole("heading", { name: "Entretemporada" })).toBeTruthy();
    expect(
      screen.getByText("No hay jugadores elegibles en la plantilla del equipo seleccionado.")
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(outlook).not.toHaveBeenCalled();
  });

  it("does not guess a season while the career is loading or unavailable", () => {
    const refetch = vi.fn();
    game.mockReturnValue({ isPending: false, isError: true, refetch });
    show();
    expect(entry).not.toHaveBeenCalled();
    expect(roster).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
