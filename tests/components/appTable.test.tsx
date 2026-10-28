// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  AppTable,
  AppTableCell,
  AppTableHead,
  AppTableHeader,
  AppTableRow,
} from "@/components/ui/app-table";

afterEach(cleanup);

it("applies the roster design by default and keeps native table semantics", () => {
  render(
    <AppTable aria-label="Players">
      <AppTableHeader>
        <AppTableRow>
          <AppTableHead>Name</AppTableHead>
        </AppTableRow>
      </AppTableHeader>
      <tbody>
        <AppTableRow data-state="selected">
          <AppTableCell>Player</AppTableCell>
        </AppTableRow>
      </tbody>
    </AppTable>
  );
  const table = screen.getByRole("table", { name: "Players" });
  expect(table.getAttribute("data-slot")).toBe("table");
  expect(table.parentElement?.getAttribute("data-slot")).toBe("table-container");
  expect(screen.getByRole("columnheader").getAttribute("data-slot")).toBe("table-head");
  expect(screen.getByRole("cell").getAttribute("data-slot")).toBe("table-cell");
  expect(table.className).toContain("text-sm");
  expect(table.parentElement?.className).toContain("overflow-x-auto");
  expect(table.parentElement?.className).toContain("border-border/50");
  expect(screen.getByRole("columnheader").className).toContain("py-3");
  expect(screen.getByRole("columnheader").className).toContain("text-muted-foreground");
  const row = screen.getByRole("cell").closest("tr");
  expect(row?.getAttribute("data-slot")).toBe("table-row");
  expect(row?.className).toContain("even:bg-muted/10");
  expect(row?.className).toContain("hover:bg-muted/40");
  expect(row?.className).toContain("data-[state=selected]:bg-primary/10");
});

it("allows cell overrides without retaining conflicting default classes", () => {
  render(
    <AppTable>
      <tbody>
        <AppTableRow>
          <AppTableHead scope="row" className="text-center font-semibold">
            Player
          </AppTableHead>
          <AppTableCell className="px-3 text-center">10</AppTableCell>
        </AppTableRow>
      </tbody>
    </AppTable>
  );
  expect(screen.getByRole("rowheader").getAttribute("scope")).toBe("row");
  expect(screen.getByRole("rowheader").className).not.toContain("text-left");
  expect(screen.getByRole("rowheader").className).not.toContain("font-medium");
  expect(screen.getByRole("cell").className).toContain("px-3");
  expect(screen.getByRole("cell").className).not.toContain("px-4");
});
