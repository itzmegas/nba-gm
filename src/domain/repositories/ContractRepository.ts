import type { Contract } from "../entities/Contract";

export interface ContractRepository {
  getAll(): Promise<Contract[]>;
  getById(id: string): Promise<Contract | null>;
  getByPlayerId(playerId: string): Promise<Contract | null>;
  getByTeamId(teamId: string): Promise<Contract[]>;
  getActiveContracts(): Promise<Contract[]>;
  getExpiringContracts(seasonYear: number): Promise<Contract[]>;
  create(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract>;
  update(id: string, contract: Partial<Contract>): Promise<Contract>;
  delete(id: string): Promise<void>;
}
