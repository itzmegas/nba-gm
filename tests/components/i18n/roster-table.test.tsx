// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { getContractStatus, RosterTable } from "@/components/roster/roster-table";

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
    ratings: {
      estimated: false,
      overall: 94,
      attributes: {
        closeShot: 80,
        midRangeShot: 81,
        threePointShot: 99,
        freeThrow: 90,
        drawFoul: 70,
        ballHandle: 92,
        passAccuracy: 88,
        interiorDefense: 40,
        perimeterDefense: 75,
        steal: 65,
        block: 0,
        offensiveRebound: 35,
        defensiveRebound: 60,
        stamina: 95,
      },
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
    headers: ["Player", "Pos", "Height", "Salary 26-27", "3PT", "PASS", "STA"],
    attributeTitle: "Three-point shot",
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
    headers: ["Jugador", "Pos", "Altura", "Salario 26-27", "3PT", "PASS", "STA"],
    attributeTitle: "Tiro de tres puntos",
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
  expect(screen.getAllByRole("columnheader")).toHaveLength(21);
  const salaryHeader = screen.getByRole("columnheader", { name: copy.headers[3] });
  expect(salaryHeader.classList.contains("whitespace-nowrap")).toBe(true);
  expect(salaryHeader.nextElementSibling?.textContent).toBe("OVR");
  expect(salaryHeader.nextElementSibling?.classList.contains("bg-primary/10")).toBe(true);
  expect(screen.getByText("94").closest("td")?.classList.contains("bg-primary/10")).toBe(true);
  expect(screen.queryByText(copy.guarantee)).toBeNull();
  expect(screen.queryByText(copy.guaranteed)).toBeNull();
  expect(screen.queryByText(copy.nonGuaranteed)).toBeNull();
  expect(screen.queryByText(copy.unavailable)).toBeNull();
  expect(getContractStatus(players[0], 2026, copy.locale).label).toBe(copy.guarantee);
  expect(getContractStatus(players[2], 2026, copy.locale).label).toBe(copy.guaranteed);
  expect(getContractStatus(players[3], 2026, copy.locale).label).toBe(copy.nonGuaranteed);
  expect(getContractStatus(players[1], 2026, copy.locale).label).toBe(copy.unavailable);
  expect(screen.getByTitle(copy.attributeTitle)).toBeTruthy();
  expect(
    screen.queryByRole("columnheader", { name: /27-28|Duration|Duración|Status|Estado/ })
  ).toBeNull();
  expect(screen.getByTitle(copy.classification)).toBeTruthy();
  expect(screen.getAllByText(copy.unknown).length).toBeGreaterThan(0);
  expect(screen.getByText(copy.salary)).toBeTruthy();
  expect(screen.getByText(copy.zero)).toBeTruthy();
  const missingContract = screen.getByText("Unknown Player").closest("tr");
  expect(missingContract?.textContent).not.toContain("$0");
  const unknownGuarantee = screen.getByText("Observed Player").closest("tr");
  expect(within(unknownGuarantee as HTMLTableRowElement).getByText("99")).toBeTruthy();
  expect(within(unknownGuarantee as HTMLTableRowElement).getByText("0")).toBeTruthy();
  expect(within(missingContract as HTMLTableRowElement).getAllByText("—")).toHaveLength(18);
  expect(unknownGuarantee?.textContent).not.toContain(copy.nonGuaranteed);
  expect(screen.queryByText("Sin Contrato")).toBeNull();
});

it.each([
  ["en", "Estimated ratings"],
  ["es", "Atributos estimados"],
] as const)("distinguishes estimated attributes in %s", (locale, label) => {
  const observed = players[0];
  const estimated = {
    ...observed,
    ratings: observed.ratings ? { ...observed.ratings, estimated: true, overall: null } : null,
  };
  render(
    <I18nProvider locale={locale}>
      <RosterTable gameId="game" players={[estimated]} seasonYear={2026} />
    </I18nProvider>
  );
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("99")).toBeTruthy();
  expect(screen.getByText("99").closest("tr")?.children[5].textContent).toBe("—");
});
