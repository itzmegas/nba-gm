import type { Contract } from "@/domain/entities";

export interface ContractRepository {
  getAll(gameId: string): Promise<Contract[]>;
  getById(gameId: string, id: string): Promise<Contract | null>;
  getByPlayerId(gameId: string, playerId: string): Promise<Contract | null>;
  getByTeamId(gameId: string, teamId: string): Promise<Contract[]>;
  getActiveContracts(gameId: string): Promise<Contract[]>;
  getExpiringContracts(gameId: string, seasonYear: number): Promise<Contract[]>;
  create(contract: Omit<Contract, "id" | "createdAt" | "updatedAt">): Promise<Contract>;
  update(gameId: string, id: string, contract: Partial<Contract>): Promise<Contract>;
  delete(gameId: string, id: string): Promise<void>;
}
