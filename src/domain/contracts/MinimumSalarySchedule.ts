export interface MinimumSalarySchedule {
  season: string;
  sourceUrl: string;
  sourceVersion: string;
  observedDate: string;
  salaryByYearsOfService: Readonly<Record<number, number>>;
}

export const MINIMUM_SALARY_SCHEDULES: Readonly<Record<string, MinimumSalarySchedule>> = {
  "2026-27": {
    season: "2026-27",
    sourceUrl: "https://www.hoopsrumors.com/2026/07/nba-minimum-salaries-for-2026-27.html",
    sourceVersion: "Hoops Rumors / RealGM table published 2026-07-01",
    observedDate: "2026-08-24",
    salaryByYearsOfService: {
      0: 1_357_763,
      1: 2_185_116,
      2: 2_449_421,
      3: 2_537_526,
      4: 2_625_627,
      5: 2_845_883,
      6: 3_066_143,
      7: 3_286_399,
      8: 3_506_659,
      9: 3_524_115,
      10: 3_876_529,
    },
  },
};

export function getMinimumSalary(
  season: string,
  yearsOfService: number
): { amount: number; schedule: MinimumSalarySchedule } | null {
  const schedule = MINIMUM_SALARY_SCHEDULES[season];
  if (!schedule || !Number.isInteger(yearsOfService) || yearsOfService < 0) return null;
  const amount = schedule.salaryByYearsOfService[Math.min(yearsOfService, 10)];
  return amount === undefined ? null : { amount, schedule };
}
