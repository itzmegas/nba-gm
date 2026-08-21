import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerState } from "@/domain/entities/PlayerState";
import type { PlayerStateRepository } from "@/domain/repositories/PlayerStateRepository";

export class SupabasePlayerStateRepository implements PlayerStateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getByGameId(gameId: string): Promise<PlayerState[]> {
    const { data, error } = await this.client
      .from("game_player_states")
      .select("*")
      .eq("game_id", gameId);

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getByGameAndTeam(gameId: string, teamId: string): Promise<PlayerState[]> {
    const { data, error } = await this.client
      .from("game_player_states")
      .select("*")
      .eq("game_id", gameId)
      .eq("team_id", teamId);

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async getByGameAndPlayer(gameId: string, playerId: string): Promise<PlayerState | null> {
    const { data, error } = await this.client
      .from("game_player_states")
      .select("*")
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async bulkCreateForGame(
    gameId: string,
    playerStates: Omit<PlayerState, "id" | "gameId" | "createdAt" | "updatedAt">[]
  ): Promise<PlayerState[]> {
    const rows = playerStates.map((playerState) =>
      this.mapToRow({
        ...playerState,
        gameId,
      })
    );

    const { data, error } = await this.client.from("game_player_states").insert(rows).select();

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async updateByGameAndPlayer(
    gameId: string,
    playerId: string,
    playerState: Partial<PlayerState>
  ): Promise<PlayerState> {
    const row = this.mapToRow(playerState);

    const { data, error } = await this.client
      .from("game_player_states")
      .update(row)
      .eq("game_id", gameId)
      .eq("player_id", playerId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  private mapToEntity(row: Record<string, unknown>): PlayerState {
    return {
      id: row.id as string,
      gameId: row.game_id as string,
      playerId: row.player_id as string,
      teamId: row.team_id as string | undefined,
      morale: row.morale as number,
      fatigue: row.fatigue as number,
      isActive: row.is_active as boolean,
      isInjured: row.is_injured as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapToRow(entity: Partial<PlayerState>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.gameId !== undefined) row.game_id = entity.gameId;
    if (entity.playerId !== undefined) row.player_id = entity.playerId;
    if (entity.teamId !== undefined) row.team_id = entity.teamId;
    if (entity.morale !== undefined) row.morale = entity.morale;
    if (entity.fatigue !== undefined) row.fatigue = entity.fatigue;
    if (entity.isActive !== undefined) row.is_active = entity.isActive;
    if (entity.isInjured !== undefined) row.is_injured = entity.isInjured;

    return row;
  }
}
