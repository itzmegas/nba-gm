export function formatSeasonLabel(seasonYear: number): string {
  const startYear = seasonYear % 100;
  const endYear = (seasonYear + 1) % 100;

  return `${formatTwoDigitYear(startYear)}-${formatTwoDigitYear(endYear)}`;
}

export function getSalarySeasonYears(baseSeasonYear: number, count: number): number[] {
  if (count <= 0) return [];

  return Array.from({ length: count }, (_, index) => baseSeasonYear + index);
}

export function formatSalarySeasonLabel(seasonYear: number): string {
  return formatSeasonLabel(seasonYear);
}

export function isCurrentSalarySeason(baseSeasonYear: number, salarySeasonYear: number): boolean {
  return baseSeasonYear === salarySeasonYear;
}

export function getYearsRemaining(baseSeasonYear: number, targetSeasonYear: number): number {
  return Math.max(0, targetSeasonYear - baseSeasonYear + 1);
}

function formatTwoDigitYear(year: number): string {
  return String(year).padStart(2, "0");
}
