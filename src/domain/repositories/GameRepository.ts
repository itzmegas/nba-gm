import type { Game } from "@/domain/entities";

export interface GameRepository {
  getById(id: string): Promise<Game | null>;
  getByUserId(userId: string): Promise<Game[]>;
  create(game: Omit<Game, "id" | "createdAt" | "updatedAt">): Promise<Game>;
  update(id: string, game: Partial<Game>): Promise<Game>;
  softDelete(id: string): Promise<void>;
}
