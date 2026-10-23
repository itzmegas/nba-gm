import { expect, it } from "vitest";
import { getPlayerAge } from "@/domain/entities/Player";

it.each([
  ["2026-03-13", 37],
  ["2026-03-14", 38],
  ["2026-03-15", 38],
  ["2027-03-14", 39],
])("calculates age at the simulation date %s", (date, age) => {
  expect(getPlayerAge({ birthDate: "1988-03-14", age: 99 }, new Date(`${date}T00:00:00Z`))).toBe(
    age
  );
});

it("uses the provider age only when birth date is missing", () => {
  expect(getPlayerAge({ age: 27 }, new Date("2026-10-01"))).toBe(27);
  expect(getPlayerAge({}, new Date("2026-10-01"))).toBeUndefined();
  expect(getPlayerAge({ birthDate: "invalid" }, new Date("2026-10-01"))).toBeUndefined();
  expect(getPlayerAge({ birthDate: "2027-01-01" }, new Date("2026-10-01"))).toBeUndefined();
});
