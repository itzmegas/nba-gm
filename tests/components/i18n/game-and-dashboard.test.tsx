import { Writable } from "node:stream";
import type { ReactNode } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server.node";
import { describe, expect, it, vi } from "vitest";
import GameDashboardPage from "@/app/(protected)/games/[gameId]/dashboard/page";
import { en } from "@/application/i18n/catalogs/en";
import { es } from "@/application/i18n/catalogs/es";
import { createT } from "@/application/i18n/createT";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { Calendar } from "@/components/games/Calendar";
import { GameList } from "@/components/games/GameList";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/application/hooks/games/useDeleteGame", () => ({
  useDeleteGame: () => ({ isPending: false, mutate: () => undefined }),
}));

const teams = [
  { id: "team-1", city: "Los Angeles", name: "Lakers", abbreviation: "LAL" },
  { id: "team-2", city: "Boston", name: "Celtics", abbreviation: "BOS" },
];

vi.mock("@/application", () => ({
  useTeams: () => ({ data: teams, isLoading: false, isError: false }),
}));

vi.mock("@/application/hooks/teams/useTeams", () => ({
  useTeams: () => ({ data: teams, isLoading: false, isError: false }),
}));

vi.mock("@/application/hooks/schedule/useSchedule", () => ({
  useSchedule: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({
    data: {
      id: "game-1",
      selectedTeamId: "team-1",
      seasonYear: 2026,
      simulationDate: new Date("2026-01-15T00:00:00.000Z"),
    },
    isLoading: false,
  }),
}));

vi.mock("@/application/hooks/simulation", () => ({
  useNextGame: () => ({ data: undefined }),
  useStandings: () => ({ data: [] }),
}));

vi.mock("@/components/dashboard/alerts-widget", () => ({
  AlertsWidget: () => <div>Alerts</div>,
}));

vi.mock("@/components/dashboard/cap-space-widget", () => ({
  CapSpaceWidget: () => <div>Cap space</div>,
}));

describe("game and dashboard internationalization", () => {
  it("keeps every game and dashboard message available in both catalogs", () => {
    for (const namespace of ["games", "dashboard"] as const) {
      for (const key of Object.keys(en[namespace])) {
        expect(es[namespace][key as keyof (typeof es)[typeof namespace]]).toBeDefined();
      }
    }
  });

  it("selects locale-driven messages for migrated surfaces", () => {
    expect(createT("en")("games", "newGame")).toBe("New Game");
    expect(createT("es")("games", "newGame")).toBe("Nueva partida");
    expect(createT("en")("dashboard", "calendar")).toBe("Calendar");
    expect(createT("es")("dashboard", "calendar")).toBe("Calendario");
  });

  it("renders GameList copy from the active catalog", () => {
    const game = {
      id: "game-1",
      name: "Test season",
      selectedTeamId: "team-1",
      seasonYear: 2026,
      status: "active",
      updatedAt: new Date("2026-01-02T03:04:00.000Z"),
    } as Parameters<typeof GameList>[0]["games"][number];
    const team = {
      id: "team-1",
      city: "Los Angeles",
      name: "Lakers",
    } as Parameters<typeof GameList>[0]["teams"][number];

    const renderGame = (locale: "en" | "es") =>
      renderToStaticMarkup(
        <I18nProvider locale={locale}>
          <GameList games={[game]} teams={[team]} />
        </I18nProvider>
      );

    expect(renderGame("en")).toContain("Franchise");
    expect(renderGame("es")).toContain("Franquicia");
    expect(renderGame("es")).not.toContain("Franchise");
  });

  it("renders Calendar copy from the active catalog", () => {
    const renderCalendar = (locale: "en" | "es") =>
      renderToStaticMarkup(
        <I18nProvider locale={locale}>
          <Calendar
            gameId="game-1"
            selectedTeamId="team-1"
            simulationDate={new Date("2026-01-15T00:00:00.000Z")}
          />
        </I18nProvider>
      );

    expect(renderCalendar("en")).toContain("No games are scheduled this month.");
    expect(renderCalendar("es")).toContain("No hay partidos programados en este mes.");
    expect(renderCalendar("es")).not.toContain("No games are scheduled this month.");
  });

  it("renders dashboard fallback and matchup copy from the active catalog", async () => {
    const renderDashboard = (locale: "en" | "es") =>
      new Promise<string>((resolve, reject) => {
        const stream = renderToPipeableStream(
          <I18nProvider locale={locale}>
            <GameDashboardPage params={Promise.resolve({ gameId: "game-1" })} />
          </I18nProvider>,
          {
            onAllReady() {
              let html = "";
              const output = new Writable({
                write(chunk: Buffer, _encoding, callback) {
                  html += chunk.toString();
                  callback();
                },
                final(callback) {
                  resolve(html);
                  callback();
                },
              });
              stream.pipe(output);
            },
            onError: reject,
          }
        );
      });

    expect(await renderDashboard("en")).toContain("Lakers");
    expect(await renderDashboard("en")).toContain("VS");
    expect(await renderDashboard("es")).toContain("Lakers");
    expect(await renderDashboard("es")).toContain("VS");
    expect(await renderDashboard("es")).toContain("Este es el estado actual de tu franquicia.");
    expect(await renderDashboard("es")).not.toContain(
      "This is the current state of your franchise."
    );
  });
});
