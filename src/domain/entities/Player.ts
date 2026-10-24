export const POSITION = {
  G: "G",
  F: "F",
  C: "C",
  GF: "G-F",
  FC: "F-C",
} as const;

export type Position = (typeof POSITION)[keyof typeof POSITION];

export interface Player {
  id: string;
  nbaId?: number;
  espnId?: number;
  teamId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position?: Position;
  height?: string;
  weight?: string;
  jerseyNumber?: string;
  headshotUrl?: string;
  /** Age reported by the roster provider at import time. */
  age?: number;
  /** Calendar date in YYYY-MM-DD format. */
  birthDate?: string;
  yearsOfExperience: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function getPlayerAge(
  player: Pick<Player, "birthDate" | "age">,
  date: Date
): number | undefined {
  if (!player.birthDate) return player.age;
  const birthDate = new Date(`${player.birthDate}T00:00:00Z`);
  if (!Number.isFinite(birthDate.getTime()) || !Number.isFinite(date.getTime())) return undefined;
  const birthdayPending =
    date.getUTCMonth() < birthDate.getUTCMonth() ||
    (date.getUTCMonth() === birthDate.getUTCMonth() && date.getUTCDate() < birthDate.getUTCDate());
  const age = date.getUTCFullYear() - birthDate.getUTCFullYear() - Number(birthdayPending);
  return age >= 0 ? age : undefined;
}
