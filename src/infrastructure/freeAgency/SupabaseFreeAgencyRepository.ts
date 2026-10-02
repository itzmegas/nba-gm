import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  FreeAgencyRepository,
  PendingFreeAgencyOffer,
} from "@/domain/freeAgency/FreeAgencyRepository";

const offerRowSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  game_id: z.uuid(),
  player_id: z.uuid(),
  team_id: z.uuid(),
  season: z.string().regex(/^\d{4}-\d{2}$/u),
  annual_salary: z.number().int().positive(),
  years: z.number().int().min(1).max(5),
  due_date: z.iso.date(),
  status: z.literal("pending"),
});

const submitInputSchema = z.object({
  gameId: z.uuid(),
  playerId: z.uuid(),
  requestId: z.uuid(),
  offer: z.object({
    season: z.string().regex(/^\d{4}-\d{2}$/u),
    annualSalary: z.number().int().positive(),
    years: z.number().int().min(1).max(5),
  }),
});

function toOffer(row: z.infer<typeof offerRowSchema>): PendingFreeAgencyOffer {
  return {
    id: row.id,
    requestId: row.request_id,
    gameId: row.game_id,
    playerId: row.player_id,
    teamId: row.team_id,
    offer: { season: row.season, annualSalary: row.annual_salary, years: row.years },
    dueDate: row.due_date,
    status: row.status,
  };
}

export class SupabaseFreeAgencyRepository implements FreeAgencyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listPendingOffers(gameId: string): Promise<readonly PendingFreeAgencyOffer[]> {
    const parsedGameId = z.uuid().parse(gameId);
    const { data, error } = await this.client.rpc("list_pending_free_agency_offers", {
      p_game_id: parsedGameId,
    });
    if (error) throw new Error(error.message);
    return z
      .array(offerRowSchema)
      .parse(data ?? [])
      .map(toOffer);
  }

  async submitOffer(input: {
    gameId: string;
    playerId: string;
    requestId: string;
    offer: PendingFreeAgencyOffer["offer"];
  }): Promise<PendingFreeAgencyOffer> {
    const parsed = submitInputSchema.parse(input);
    const { data, error } = await this.client.rpc("submit_free_agency_offer", {
      p_game_id: parsed.gameId,
      p_player_id: parsed.playerId,
      p_request_id: parsed.requestId,
      p_season: parsed.offer.season,
      p_annual_salary: parsed.offer.annualSalary,
      p_years: parsed.offer.years,
    });
    if (error) throw new Error(error.message);
    return toOffer(offerRowSchema.parse(data));
  }
}
