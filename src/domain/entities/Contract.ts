export interface Contract {
  id: string;
  playerId: string;
  teamId: string;
  startYear: number;
  endYear: number;
  salaryY1: number;
  salaryY2?: number;
  salaryY3?: number;
  salaryY4?: number;
  salaryY5?: number;
  isPlayerOption: boolean;
  isTeamOption: boolean;
  isGuaranteed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
