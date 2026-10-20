import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PlayerState } from "@/domain/entities/PlayerState";
import type { PlayerStateRepository } from "@/domain/repositories/PlayerStateRepository";
import type { ReleasePlayerInput } from "@/domain/roster/ReleasePlayer";

const releaseInputSchema = z.object({
  gameId: z.uuid(),
  playerId: z.uuid(),
  requestId: z.uuid(),
  contractId: z.uuid().nullable(),
});

export class SupabasePlayerStateRepository implements PlayerStateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async release(input: ReleasePlayerInput): Promise<string> {
    const parsed = releaseInputSchema.parse(input);
    const { data, error } = await this.client.rpc("release_roster_player", {
      p_game_id: parsed.gameId,
      p_player_id: parsed.playerId,
      p_request_id: parsed.requestId,
      p_contract_id: parsed.contractId,
    });
    if (error) throw new Error(error.message);
    return z.uuid().parse(data);
  }

  async getReleaseCapCharge(gameId: string, teamId: string, seasonYear: number): Promise<number> {
    z.uuid().parse(gameId);
    z.uuid().parse(teamId);
    z.number().int().parse(seasonYear);
    const { data, error } = await this.client.rpc("get_roster_release_cap_charge", {
      p_game_id: gameId,
      p_team_id: teamId,
      p_season_year: seasonYear,
    });
    if (error) throw new Error(error.message);
    return z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(data);
  }

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
