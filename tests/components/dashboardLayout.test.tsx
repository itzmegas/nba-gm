import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GameDashboardLayout from "@/app/(protected)/games/[gameId]/dashboard/layout";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "courtside-font", variable: "courtside-variable" }),
}));

vi.mock("@/application/hooks/games/useGame", () => ({
  useGame: () => ({ data: { selectedTeamId: "team", seasonYear: 2026 }, isLoading: false }),
}));
vi.mock("@/application/hooks/teams/useTeams", () => ({ useTeams: () => ({ data: [] }) }));
vi.mock("@/application/providers/I18nProvider", () => ({ useT: () => () => "Dashboard" }));
vi.mock("@/components/theme/team-theme-applier", () => ({ TeamThemeApplier: () => null }));
vi.mock("@/components/dashboard/layout-components", async () => {
  const { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } = await import(
    "@/components/ui/sidebar"
  );
  return {
    DashboardHeader: () => (
      <header className="flex min-h-[88px] shrink-0 items-center justify-between">
        <button type="button">Sidebar</button>
        <button type="button">Game menu</button>
      </header>
    ),
    DashboardSidebar: () => (
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader>Team</SidebarHeader>
        <SidebarContent>
          {Array.from({ length: 20 }, (_, index) => `Navigation ${index}`).map((label) => (
            <a href={`#${label}`} key={label}>
              {label}
            </a>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <button type="button">Simulate day</button>
        </SidebarFooter>
      </Sidebar>
    ),
  };
});

interface ProtocolReply {
  id?: number;
  result?: Record<string, unknown>;
  error?: { message: string };
}

// Use a private profile and Chrome's pipe: no app server, credentials, or shared ports.
function startBrowser(profile: string) {
  const browser = spawn(
    "/usr/bin/google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-pipe",
      `--user-data-dir=${profile}`,
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
  );
  const input = browser.stdio[3] as Writable;
  const output = browser.stdio[4] as Readable;
  const pending = new Map<
    number,
    { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }
  >();
  let nextId = 0;
  let buffer = "";
  output.on("data", (data: Buffer) => {
    buffer += data.toString();
    let separator = buffer.indexOf("\0");
    while (separator !== -1) {
      const message: ProtocolReply = JSON.parse(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 1);
      const request = message.id === undefined ? undefined : pending.get(message.id);
      if (request && message.id !== undefined) {
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result ?? {});
      }
      separator = buffer.indexOf("\0");
    }
  });
  function command(method: string, params = {}, sessionId?: string) {
    const id = ++nextId;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    });
  }
  return { browser, command };
}

describe.skipIf(!existsSync("/usr/bin/google-chrome"))("dashboard browser geometry", () => {
  it("contains tall/wide content without moving the header or losing keyboard access", async () => {
    const profile = mkdtempSync("/tmp/opencode/dashboard-scroll-");
    const { browser, command } = startBrowser(profile);
    try {
      const target = await command("Target.createTarget", { url: "about:blank" });
      const attached = await command("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      });
      const session = String(attached.sessionId);
      await command("Page.bringToFront", {}, session);
      await command("Emulation.setFocusEmulationEnabled", { enabled: true }, session);
      const evaluate = async (expression: string) => {
        const reply = await command(
          "Runtime.evaluate",
          { expression, returnByValue: true, awaitPromise: true },
          session
        );
        if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
        return (reply.result as { value: unknown }).value;
      };
      const source = path.resolve("src/app/globals.css");
      const { css } = await postcss([tailwind()]).process(readFileSync(source, "utf8"), {
        from: source,
      });
      const params = Object.assign(Promise.resolve({ gameId: "game" }), {
        status: "fulfilled",
        value: { gameId: "game" },
      });
      const markup = renderToStaticMarkup(
        <GameDashboardLayout params={params}>
          <section data-slot="league-screen">
            <h1>League</h1>
            <section
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Exercise keyboard scrolling on the table region.
              tabIndex={0}
              aria-label="League table"
              data-table-scroll
              className="overflow-x-auto"
            >
              <table style={{ minWidth: 2400 }}>
                <tbody>
                  <tr>
                    <td>Team</td>
                    <td style={{ textAlign: "right" }}>Final column</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <div style={{ height: 1600 }}>Long league content</div>
            <button type="button" id="last-control">
              Last action
            </button>
          </section>
        </GameDashboardLayout>
      );
      await evaluate(
        `document.open(); document.write(${JSON.stringify(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\n* { transition: none !important; }</style></head><body>${markup}</body></html>`)}); document.close();`
      );
      // The 720x450 @2x case models the CSS viewport of 1440x900 at 200% zoom.
      for (const width of [360, 768, 1024, 1440, 1920, 720]) {
        for (const height of width === 720 ? [450] : [900, 320]) {
          for (const collapsed of [false, true]) {
            await command(
              "Emulation.setDeviceMetricsOverride",
              { width, height, deviceScaleFactor: width === 720 ? 2 : 1, mobile: false },
              session
            );
            const measurements = await evaluate(`(() => {
              const sidebar = document.querySelector('[data-slot="sidebar"]');
              sidebar.dataset.state = ${JSON.stringify(collapsed ? "collapsed" : "expanded")};
              sidebar.dataset.collapsible = ${JSON.stringify(collapsed ? "icon" : "")};
              const main = document.querySelector('main');
              const scroll = main.lastElementChild;
              const table = document.querySelector('[data-table-scroll]');
              const header = document.querySelector('header');
              const before = header.getBoundingClientRect().top;
              scroll.scrollTop = 0;
              table.scrollLeft = 100;
              scroll.focus();
              const keyboardFocusable = document.activeElement === scroll;
              scroll.scrollTop = 100;
              const mainScrolls = scroll.scrollTop === 100;
              document.querySelector('#last-control').focus();
              const last = document.querySelector('#last-control').getBoundingClientRect();
              const bounds = scroll.getBoundingClientRect();
              return {
                width: innerWidth, height: innerHeight,
                documentWidth: document.documentElement.scrollWidth,
                documentHeight: document.documentElement.scrollHeight,
                mainScrolls, keyboardFocusable,
                tableScrolls: table.scrollLeft === 100,
                noMainHorizontalScroll: scroll.scrollWidth === scroll.clientWidth,
                headerStationary: header.getBoundingClientRect().top === before,
                headerHeight: header.getBoundingClientRect().height,
                sidebarWidth: ${width < 768} ? 0 : document.querySelector('[data-slot="sidebar-container"]').getBoundingClientRect().width,
                flushInset: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRadius'].every(property => parseFloat(getComputedStyle(main)[property]) === 0),
                skipTarget: document.querySelector('a[href="#game-content"]') !== null && scroll.id === 'game-content',
                sidebarVisible: ${width < 768} || (() => {
                  const bounds = document.querySelector('[data-slot="sidebar-container"]').getBoundingClientRect();
                  return bounds.top === 0 && bounds.bottom <= innerHeight;
                })(),
                lastControlVisible: last.top >= bounds.top && last.bottom <= bounds.bottom,
                footerVisible: ${width < 768} || (() => {
                  const bounds = document.querySelector('[data-slot="sidebar-footer"]').getBoundingClientRect();
                  return bounds.top >= 0 && bounds.bottom <= innerHeight;
                })()
              };
            })()`);
            expect(measurements, `${width}x${height}, collapsed=${collapsed}`).toEqual({
              width,
              height,
              documentWidth: width,
              documentHeight: height,
              mainScrolls: true,
              keyboardFocusable: true,
              tableScrolls: true,
              noMainHorizontalScroll: true,
              headerStationary: true,
              headerHeight: 88,
              sidebarWidth: width < 768 ? 0 : collapsed ? 56 : 216,
              flushInset: true,
              skipTarget: true,
              sidebarVisible: true,
              lastControlVisible: true,
              footerVisible: true,
            });
            await evaluate(`document.querySelector('main').lastElementChild.scrollTop = 0;
              document.querySelector('main').lastElementChild.focus()`);
            await command(
              "Input.dispatchKeyEvent",
              { type: "keyDown", key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 },
              session
            );
            await command(
              "Input.dispatchKeyEvent",
              { type: "keyUp", key: "PageDown", code: "PageDown", windowsVirtualKeyCode: 34 },
              session
            );
            const keyboard = await evaluate(`new Promise(resolve => setTimeout(() => resolve({
              scrolled: document.querySelector('main').lastElementChild.scrollTop > 0,
              documentTop: scrollY
            }), 150))`);
            expect(keyboard, `${width}x${height}, collapsed=${collapsed}`).toEqual({
              scrolled: true,
              documentTop: 0,
            });
            await evaluate(`(() => {
              const table = document.querySelector('[data-table-scroll]');
              table.scrollLeft = 0; table.focus();
            })()`);
            await command(
              "Input.dispatchKeyEvent",
              { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
              session
            );
            await command(
              "Input.dispatchKeyEvent",
              { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
              session
            );
            expect(
              await evaluate(`new Promise(resolve => setTimeout(() => resolve(
                document.querySelector('[data-table-scroll]').scrollLeft > 0 && scrollX === 0
              ), 150))`)
            ).toBe(true);
          }
        }
      }
      // Prove this harness reproduces the original unbounded-flex failure, not just clipping.
      expect(
        await evaluate(`(() => {
          document.querySelector('[data-slot="sidebar-wrapper"]').classList.remove('h-dvh', 'min-h-0');
          document.querySelector('main').classList.remove('min-h-0', 'min-w-0');
          const scroll = document.querySelector('main').lastElementChild;
          scroll.classList.remove('min-h-0', 'min-w-0');
          scroll.firstElementChild.classList.remove('min-w-0', 'shrink-0');
          return document.documentElement.scrollHeight > innerHeight &&
            scroll.scrollHeight === scroll.clientHeight;
        })()`)
      ).toBe(true);
    } finally {
      const closed = new Promise<void>((resolve) => browser.once("close", () => resolve()));
      browser.kill();
      await closed;
      rmSync(profile, { recursive: true, force: true });
    }
  }, 30_000);
});
