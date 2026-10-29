// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LeagueLayout from "@/app/(protected)/games/[gameId]/dashboard/league/layout";
import LeaguePage from "@/app/(protected)/games/[gameId]/dashboard/league/page";
import { createT } from "@/application/i18n/createT";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { LeagueShell } from "@/components/league/league-shell";

const { redirect, usePathname } = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect, usePathname }));
vi.mock("@/app/ui-preview/fonts", () => ({
  body: { className: "barlow" },
  display: { className: "barlow-condensed" },
}));

const teamsHref = "/games/game/dashboard/league/teams";

beforeEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue(teamsHref);
});
afterEach(cleanup);

it.each([
  "en",
  "es",
] as const)("renders six localized sections with Teams and Standings enabled (%s)", async (locale) => {
  const t = createT(locale);
  const layout = await LeagueLayout({
    params: Promise.resolve({ gameId: "game" }),
    children: <p>League content</p>,
  });
  render(<I18nProvider locale={locale}>{layout}</I18nProvider>);

  expect(screen.getByRole("heading", { level: 1, name: t("league", "title") }).className).toContain(
    "barlow-condensed"
  );
  expect(screen.getByText(t("league", "description"))).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: t("league", "navigation") });
  expect(within(nav).getAllByRole("listitem")).toHaveLength(6);
  expect(within(nav).getAllByRole("link")).toHaveLength(2);
  expect(
    within(nav)
      .getByRole("link", { name: t("league", "standings") })
      .getAttribute("href")
  ).toBe("/games/game/dashboard/league/standings");
  const teams = within(nav).getByRole("link", { name: t("league", "teams") });
  expect(teams.getAttribute("href")).toBe(teamsHref);
  expect(teams.getAttribute("aria-current")).toBe("page");

  for (const section of ["overview", "players", "leaders", "transactions"] as const) {
    const upcoming = within(nav).getByText(t("league", section)).closest("[aria-disabled]");
    expect(upcoming?.tagName).toBe("SPAN");
    expect(upcoming?.getAttribute("aria-disabled")).toBe("true");
    expect(upcoming?.hasAttribute("tabindex")).toBe(false);
    expect(upcoming?.closest("a")).toBeNull();
    expect(upcoming?.querySelector("a, button")).toBeNull();
    expect(upcoming?.textContent).toContain(t("league", "comingSoon"));
  }
  expect(nav.className).toContain("overflow-x-auto");
  expect(screen.getByText("League content").parentElement?.className).toContain("min-w-0");
  expect(document.querySelector('[data-slot="league-screen"]')?.className).toContain("barlow");
});

it.each([
  ["/games/game/dashboard/league", null],
  ["/games/game/dashboard/league/teams/player", "page"],
  ["/games/game/dashboard/league/teams-extra", null],
])("derives the active section from pathname %s", (pathname, current) => {
  usePathname.mockReturnValue(pathname);
  render(
    <I18nProvider locale="en">
      <LeagueShell gameId="game">League content</LeagueShell>
    </I18nProvider>
  );
  expect(screen.getByRole("link", { name: "Teams" }).getAttribute("aria-current")).toBe(current);
});

it("redirects the legacy entry preserving teamId, unrelated, repeated and empty values", async () => {
  const searchParams = {
    teamId: "other-team",
    filter: ["active", "", "A&B"],
    query: "two words",
    empty: "",
    omitted: undefined,
  };
  const snapshot = structuredClone(searchParams);
  await expect(
    LeaguePage({
      params: Promise.resolve({ gameId: "game" }),
      searchParams: Promise.resolve(searchParams),
    })
  ).rejects.toThrow("NEXT_REDIRECT:");

  expect(redirect).toHaveBeenCalledExactlyOnceWith(
    `${teamsHref}?teamId=other-team&filter=active&filter=&filter=A%26B&query=two+words&empty=`
  );
  const destination = new URL(redirect.mock.calls[0][0], "https://example.com");
  expect(destination.searchParams.getAll("filter")).toEqual(["active", "", "A&B"]);
  expect(destination.searchParams.get("empty")).toBe("");
  expect(destination.searchParams.has("omitted")).toBe(false);
  expect(searchParams).toEqual(snapshot);
});

it("redirects the legacy entry without adding a query delimiter when no params exist", async () => {
  await expect(
    LeaguePage({ params: Promise.resolve({ gameId: "game" }), searchParams: Promise.resolve({}) })
  ).rejects.toThrow(`NEXT_REDIRECT:${teamsHref}`);
  expect(redirect).toHaveBeenCalledExactlyOnceWith(teamsHref);
});
