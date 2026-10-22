// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { RosterTable } from "@/components/roster/roster-table";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const players = [
  {
    player: { id: "observed", fullName: "Observed Player", position: "PG" },
    contract: { salaryY1: 1_250_000, endYear: 2028, isGuaranteed: null },
    gameContract: {
      resolutionStatus: "observed-standard",
      contractType: "standard",
      provenanceQuality: "observed",
      estimated: false,
    },
  },
  { player: { id: "unknown", fullName: "Unknown Player" }, contract: null, gameContract: null },
  {
    player: { id: "guaranteed", fullName: "Guaranteed Player" },
    contract: { salaryY1: 2_000_000, endYear: 2028, isGuaranteed: true },
    gameContract: null,
  },
  {
    player: { id: "non-guaranteed", fullName: "Non-Guaranteed Player" },
    contract: { salaryY1: 0, endYear: 2028, isGuaranteed: false },
    gameContract: null,
  },
] as unknown as RosterPlayer[];

it.each([
  {
    locale: "en" as const,
    headers: ["Player", "Pos", "Height", "Salary 26-27", "Duration", "Status"],
    guarantee: "Guarantee unknown",
    guaranteed: "Guaranteed",
    nonGuaranteed: "Non-guaranteed",
    zero: "$0",
    unavailable: "Contract unavailable",
    classification: "Observed standard NBA contract",
    unknown: "Unknown",
    salary: "$1.3M",
  },
  {
    locale: "es" as const,
    headers: ["Jugador", "Pos", "Altura", "Salario 26-27", "Duración", "Estado"],
    guarantee: "Garantía desconocida",
    guaranteed: "Garantizado",
    nonGuaranteed: "No garantizado",
    zero: "US$ 0",
    unavailable: "Contrato no disponible",
    classification: "Contrato NBA estándar observado",
    unknown: "Desconocido",
    salary: "US$ 1,3M",
  },
])("localizes the roster and preserves unknown data in $locale", (copy) => {
  render(
    <I18nProvider locale={copy.locale}>
      <RosterTable gameId="game" players={players} seasonYear={2026} />
    </I18nProvider>
  );
  for (const name of copy.headers) {
    expect(screen.getByRole("columnheader", { name })).toBeTruthy();
  }
  expect(screen.getByText(copy.guarantee)).toBeTruthy();
  expect(screen.getByText(copy.guaranteed)).toBeTruthy();
  expect(screen.getByText(copy.nonGuaranteed)).toBeTruthy();
  expect(screen.getByText(copy.unavailable)).toBeTruthy();
  expect(screen.getByTitle(copy.classification)).toBeTruthy();
  expect(screen.getAllByText(copy.unknown).length).toBeGreaterThan(0);
  expect(screen.getByText(copy.salary)).toBeTruthy();
  expect(screen.getByText(copy.zero)).toBeTruthy();
  const missingContract = screen.getByText("Unknown Player").closest("tr");
  expect(missingContract?.textContent).not.toContain("$0");
  const unknownGuarantee = screen.getByText("Observed Player").closest("tr");
  expect(unknownGuarantee?.textContent).not.toContain(copy.nonGuaranteed);
  expect(screen.queryByText("Sin Contrato")).toBeNull();
});
