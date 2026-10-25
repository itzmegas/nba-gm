import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  OFFSEASON_DECISION,
  OFFSEASON_LEDGER_STATUS,
  type OffseasonContract,
  type OffseasonDecision,
} from "@/domain/entities/OffseasonContract";
import type { OffseasonContractRepository } from "@/domain/repositories/OffseasonContractRepository";

const inputSchema = z.object({ gameId: z.uuid(), seasonYear: z.number().int().min(1).max(9998) });
const rowSchema = z
  .object({
    player_id: z.uuid(),
    team_id: z.uuid(),
    season_year: z.number().int(),
    classification: z.enum(OFFSEASON_LEDGER_STATUS),
    decision: z.enum(OFFSEASON_DECISION).nullable(),
    next_salary: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .refine((row) => row.classification === "team_option" || row.decision === null);

export class SupabaseOffseasonContractRepository implements OffseasonContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(gameId: string, seasonYear: number): Promise<OffseasonContract[]> {
    inputSchema.parse({ gameId, seasonYear });
    const { data, error } = await this.client
      .from("game_offseason_contracts")
      .select("player_id, team_id, season_year, classification, decision, next_salary")
      .eq("game_id", gameId)
      .eq("season_year", seasonYear);
    if (error) throw new Error("Unable to load offseason contracts", { cause: error });
    return this.parse(data, seasonYear);
  }

  async prepare(gameId: string, seasonYear: number): Promise<OffseasonContract[]> {
    inputSchema.parse({ gameId, seasonYear });
    const { data, error } = await this.client.rpc("prepare_offseason_contracts", {
      p_game_id: gameId,
      p_season_year: seasonYear,
    });
    if (error) throw new Error("Unable to prepare offseason contracts", { cause: error });
    return this.parse(data, seasonYear);
  }

  async decide(
    gameId: string,
    seasonYear: number,
    playerId: string,
    decision: OffseasonDecision
  ): Promise<OffseasonContract> {
    inputSchema
      .extend({ playerId: z.uuid(), decision: z.enum(OFFSEASON_DECISION) })
      .parse({ gameId, seasonYear, playerId, decision });
    const { data, error } = await this.client.rpc("decide_offseason_team_option", {
      p_game_id: gameId,
      p_season_year: seasonYear,
      p_player_id: playerId,
      p_decision: decision,
    });
    if (error) throw new Error("Unable to save team option", { cause: error });
    const [row] = this.parse([data], seasonYear);
    if (
      !row ||
      row.playerId !== playerId ||
      row.status !== "team_option" ||
      row.decision !== decision
    )
      throw new Error("Team option response mismatch");
    return row;
  }

  private parse(data: unknown, seasonYear: number): OffseasonContract[] {
    const rows = z.array(rowSchema).parse(data);
    if (
      rows.some((row) => row.season_year !== seasonYear) ||
      new Set(rows.map((row) => row.player_id)).size !== rows.length
    )
      throw new Error("Offseason ledger scope mismatch");
    return rows.map((row) => ({
      playerId: row.player_id,
      teamId: row.team_id,
      seasonYear: row.season_year,
      status: row.classification,
      decision: row.decision,
      nextSalary: row.next_salary,
    }));
  }
}
