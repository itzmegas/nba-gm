import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { OFFSEASON_DECISION } from "@/domain/entities/OffseasonContract";
import {
  type OffseasonPlayerOption,
  PLAYER_OPTION_POLICY_VERSION,
  PLAYER_OPTION_REASON,
} from "@/domain/entities/OffseasonPlayerOption";
import type { OffseasonPlayerOptionRepository } from "@/domain/repositories/OffseasonPlayerOptionRepository";

const inputSchema = z.object({ gameId: z.uuid(), seasonYear: z.number().int().min(1).max(9998) });
const salarySchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const rowSchema = z
  .object({
    game_id: z.uuid(),
    season_year: z.number().int(),
    player_id: z.uuid(),
    team_id: z.uuid(),
    current_salary: salarySchema,
    next_salary: salarySchema,
    decision: z.enum(OFFSEASON_DECISION),
    reason: z.enum(PLAYER_OPTION_REASON),
    policy_version: z.literal(PLAYER_OPTION_POLICY_VERSION),
    resolved_at: z.iso.datetime({ offset: true }),
  })
  .refine((row) => (row.decision === "exercise") === (row.reason === "salary_not_lower"));

export class SupabaseOffseasonPlayerOptionRepository implements OffseasonPlayerOptionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(gameId: string, seasonYear: number): Promise<OffseasonPlayerOption[]> {
    inputSchema.parse({ gameId, seasonYear });
    const { data, error } = await this.client
      .from("game_offseason_player_options")
      .select(
        "game_id, season_year, player_id, team_id, current_salary, next_salary, decision, reason, policy_version, resolved_at"
      )
      .eq("game_id", gameId)
      .eq("season_year", seasonYear);
    if (error) throw new Error("Unable to load player options", { cause: error });
    return this.parse(data, gameId, seasonYear);
  }

  async resolve(gameId: string, seasonYear: number): Promise<OffseasonPlayerOption[]> {
    inputSchema.parse({ gameId, seasonYear });
    const { data, error } = await this.client.rpc("resolve_offseason_player_options", {
      p_game_id: gameId,
      p_season_year: seasonYear,
    });
    if (error) throw new Error("Unable to resolve player options", { cause: error });
    return this.parse(data, gameId, seasonYear);
  }

  private parse(data: unknown, gameId: string, seasonYear: number): OffseasonPlayerOption[] {
    const rows = z.array(rowSchema).parse(data);
    if (
      rows.some((row) => row.game_id !== gameId || row.season_year !== seasonYear) ||
      new Set(rows.map((row) => row.player_id)).size !== rows.length
    )
      throw new Error("Player option scope mismatch");
    return rows.map((row) => ({
      gameId: row.game_id,
      seasonYear: row.season_year,
      playerId: row.player_id,
      teamId: row.team_id,
      currentSalary: row.current_salary,
      nextSalary: row.next_salary,
      decision: row.decision,
      reason: row.reason,
      policyVersion: row.policy_version,
      resolvedAt: row.resolved_at,
    }));
  }
}
