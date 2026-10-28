import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { OffseasonEntry } from "@/domain/entities/Offseason";
import type { OffseasonRepository } from "@/domain/repositories/OffseasonRepository";

const gameIdSchema = z.uuid();
const seasonYearSchema = z.number().int().min(1).max(9998);
const enteredAtSchema = z.iso.datetime({ offset: true });
const entrySchema = z.object({ seasonYear: seasonYearSchema, enteredAt: enteredAtSchema });
const rowSchema = z.object({ season_year: seasonYearSchema, entered_at: enteredAtSchema });

export class SupabaseOffseasonRepository implements OffseasonRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getEntry(gameId: string, seasonYear: number): Promise<OffseasonEntry | null> {
    gameIdSchema.parse(gameId);
    seasonYearSchema.parse(seasonYear);
    const { data, error } = await this.client
      .from("game_offseasons")
      .select("season_year, entered_at")
      .eq("game_id", gameId)
      .eq("season_year", seasonYear)
      .maybeSingle();
    if (error) throw new Error("Failed to load offseason entry", { cause: error });
    if (data === null) return null;
    const row = rowSchema.parse(data);
    if (row.season_year !== seasonYear) throw new Error("Offseason entry season mismatch");
    return { seasonYear: row.season_year, enteredAt: row.entered_at };
  }

  async enter(gameId: string, seasonYear: number): Promise<OffseasonEntry> {
    gameIdSchema.parse(gameId);
    seasonYearSchema.parse(seasonYear);
    const { data, error } = await this.client.rpc("enter_offseason", {
      p_game_id: gameId,
      p_season_year: seasonYear,
    });
    if (error) throw new Error("Failed to enter offseason", { cause: error });
    const entry = entrySchema.parse(data);
    if (entry.seasonYear !== seasonYear) throw new Error("Offseason entry season mismatch");
    return entry;
  }
}
