import type { Game } from "@/domain/entities";
import type { SeasonEraId } from "@/domain/entities/SeasonEra";

export type CreateGameInput = Omit<Game, "id" | "createdAt" | "updatedAt" | "seasonEraId"> & {
  seasonEraId?: SeasonEraId;
};

export interface GameRepository {
  getById(id: string): Promise<Game | null>;
  getByUserId(userId: string): Promise<Game[]>;
  create(game: CreateGameInput): Promise<Game>;
  update(id: string, game: Partial<Game>): Promise<Game>;
  softDelete(id: string): Promise<void>;
}
