// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { GameStartSettings } from "@/components/games/GameStartSettings";
import { GAME_START_MODE } from "@/domain/entities/GameStartSettings";

afterEach(cleanup);

it.each([
  ["en", "Settings", "Today", "Season start"],
  ["es", "Configuración", "Hoy", "Inicio de temporada"],
] as const)("offers only the requested settings in %s", (locale, title, today, opening) => {
  const onChange = vi.fn();
  render(
    <I18nProvider locale={locale}>
      <GameStartSettings value={GAME_START_MODE.SEASON_START} onChange={onChange} />
    </I18nProvider>
  );
  expect(screen.getByRole("group", { name: title })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  expect((screen.getByRole("radio", { name: opening }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: today }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(GAME_START_MODE.TODAY);
});

it("keeps the selected mode controlled by its parent", () => {
  const onChange = vi.fn();
  const view = (value: typeof GAME_START_MODE.TODAY | typeof GAME_START_MODE.SEASON_START) => (
    <I18nProvider locale="en">
      <GameStartSettings value={value} onChange={onChange} />
    </I18nProvider>
  );
  const { rerender } = render(view(GAME_START_MODE.SEASON_START));
  rerender(view(GAME_START_MODE.TODAY));
  expect((screen.getByRole("radio", { name: "Today" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "Season start" }) as HTMLInputElement).checked).toBe(
    false
  );
});
