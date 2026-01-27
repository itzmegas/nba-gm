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
  nbaId: number;
  teamId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position?: Position;
  height?: string;
  weight?: string;
  jerseyNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
