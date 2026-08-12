import { describe, expect, it } from "vitest";

const FIXED_DATE = new Date("2026-01-02T03:04:00.000Z");

function formatDate(locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(FIXED_DATE);
}

function formatSalary(locale: string): string {
  return `${new Intl.NumberFormat(locale === "es" ? "es-AR" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(123_400_000 / 1_000_000)}M`;
}

function formatSimulationDate(locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(FIXED_DATE);
}

describe("internationalization formatter parity", () => {
  it.each([
    ["en", "Jan 2, 2026, 3:04 AM", "$123.4M"],
    ["es", "2 ene 2026, 3:04 a. m.", "US$ 123,4M"],
  ] as const)("formats calendar and roster values for %s", (locale, date, salary) => {
    expect(formatDate(locale)).toBe(date);
    expect(formatSalary(locale)).toBe(salary);
  });

  it.each([
    ["en", "Jan 2, 2026"],
    ["es", "2 de ene de 2026"],
  ] as const)("uses the fixed UTC date semantics for %s", (locale, date) => {
    expect(formatSimulationDate(locale)).toBe(date);
  });
});
