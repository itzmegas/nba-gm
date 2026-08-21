import type { SupabaseClient } from "@supabase/supabase-js";
import { type PickInventory, pickInventorySchema } from "@/domain/entities";
import type { DraftPickRepository } from "@/domain/repositories/DraftPickRepository";

export class SupabaseDraftPickRepository implements DraftPickRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByGameId(gameId: string): Promise<PickInventory[]> {
    const { data, error } = await this.client
      .from("game_pick_inventory")
      .select("*, draft_picks(*)")
      .eq("game_id", gameId)
      .order("owner_team_id");
    if (error) throw new Error(error.message);
    return data.map(this.mapToEntity);
  }

  async getById(gameId: string, id: string): Promise<PickInventory | null> {
    const { data, error } = await this.client
      .from("game_pick_inventory")
      .select("*, draft_picks(*)")
      .eq("game_id", gameId)
      .eq("id", id)
      .single();
    if (error) return null;
    return this.mapToEntity(data);
  }

  private mapToEntity(row: Record<string, unknown>): PickInventory {
    const pick = row.draft_picks as Record<string, unknown>;
    return pickInventorySchema.parse({
      id: row.id as string,
      gameId: row.game_id as string,
      draftPickId: row.draft_pick_id as string,
      ownerTeamId: row.owner_team_id as string,
      isTransferable: row.is_transferable as boolean,
      pick: {
        id: pick.id as string,
        draftYear: pick.draft_year as number,
        draftRound: pick.draft_round as number,
        protection: pick.protection === null ? undefined : (pick.protection as string | undefined),
        originalTeamId: pick.original_team_id as string,
      },
    });
  }
}
