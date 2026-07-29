import { describe, expect, it } from "vitest";
import { getMonthCells } from "@/application/hooks/schedule/calendar";

describe("getMonthCells", () => {
  it("builds complete weeks with the correct empty cells for a leap month", () => {
    const cells = getMonthCells(2024, 1);

    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe("2024-02-01");
    expect(cells[32]).toBe("2024-02-29");
    expect(cells.slice(33)).toEqual([null, null]);
  });
});
