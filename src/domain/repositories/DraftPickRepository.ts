import type { PickInventory } from "@/domain/entities";

export interface DraftPickRepository {
  getByGameId(gameId: string): Promise<PickInventory[]>;
  getById(gameId: string, id: string): Promise<PickInventory | null>;
}
