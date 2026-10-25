import type { OffseasonPlayerOption } from "@/domain/entities/OffseasonPlayerOption";

export interface OffseasonPlayerOptionRepository {
  get(gameId: string, seasonYear: number): Promise<OffseasonPlayerOption[]>;
  resolve(gameId: string, seasonYear: number): Promise<OffseasonPlayerOption[]>;
}
