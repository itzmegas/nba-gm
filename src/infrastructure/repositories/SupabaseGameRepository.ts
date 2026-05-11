import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "@/domain/entities/Game";
import { GAME_STATUS } from "@/domain/entities/Game";
import type { GameRepository } from "@/domain/repositories/GameRepository";

export class SupabaseGameRepository implements GameRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getById(id: string): Promise<Game | null> {
    const { data, error } = await this.client.from("games").select("*").eq("id", id).single();

    if (error) return null;

    return this.mapToEntity(data);
  }

  async getByUserId(userId: string): Promise<Game[]> {
    const { data, error } = await this.client
      .from("games")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(this.mapToEntity);
  }

  async create(game: Omit<Game, "id" | "createdAt" | "updatedAt">): Promise<Game> {
    const row = this.mapToRow({
      ...game,
      status: game.status ?? GAME_STATUS.INITIALIZING,
    });

    const { data, error } = await this.client.from("games").insert(row).select().single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  async update(id: string, game: Partial<Game>): Promise<Game> {
    const row = this.mapToRow(game);

    const { data, error } = await this.client
      .from("games")
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return this.mapToEntity(data);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from("games")
      .update({
        status: GAME_STATUS.DELETED,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  private mapToEntity(row: Record<string, unknown>): Game {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      selectedTeamId: row.selected_team_id as string,
      seasonYear: row.season_year as number,
      simulationDate: new Date(row.simulation_date as string),
      status: row.status as Game["status"],
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapToRow(entity: Partial<Game>): Record<string, unknown> {
    const row: Record<string, unknown> = {};

    if (entity.userId !== undefined) row.user_id = entity.userId;
    if (entity.name !== undefined) row.name = entity.name;
    if (entity.selectedTeamId !== undefined) row.selected_team_id = entity.selectedTeamId;
    if (entity.seasonYear !== undefined) row.season_year = entity.seasonYear;
    if (entity.simulationDate !== undefined) row.simulation_date = entity.simulationDate;
    if (entity.status !== undefined) row.status = entity.status;
    if (entity.deletedAt !== undefined) row.deleted_at = entity.deletedAt;

    return row;
  }
}
