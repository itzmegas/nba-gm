import type { Team } from "../entities/Team";

export interface TeamRepository {
  getAll(): Promise<Team[]>;
  getById(id: string): Promise<Team | null>;
  getByNbaId(nbaId: number): Promise<Team | null>;
}
