export interface Team {
  id: string;
  nbaId: number;
  name: string;
  city: string;
  abbreviation: string;
  conference?: string;
  division?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
