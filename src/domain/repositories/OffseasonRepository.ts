import type { OffseasonEntry } from "@/domain/entities/Offseason";

export interface OffseasonRepository {
  getEntry(gameId: string, seasonYear: number): Promise<OffseasonEntry | null>;
  enter(gameId: string, seasonYear: number): Promise<OffseasonEntry>;
}
