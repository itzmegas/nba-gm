import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  FREE_AGENCY_MARKET_OFFER_STATUS,
  FREE_AGENCY_OFFER_ORIGIN,
  type FreeAgencyMarketSnapshot,
  type SubmitFreeAgencyOfferInput,
} from "@/domain/freeAgency/FreeAgencyMarketSnapshot";
import type {
  FreeAgencyRepository,
  PendingFreeAgencyOffer,
} from "@/domain/freeAgency/FreeAgencyRepository";

const seasonSchema = z
  .string()
  .regex(/^(\d{4})-(\d{2})$/u)
  .refine((season) => Number(season.slice(5)) === (Number(season.slice(0, 4)) + 1) % 100);
const safeSalarySchema = z.number().int().positive().safe();

const marketContextSchema = z
  .object({
    team_id: z.uuid(),
    season: seasonSchema,
    simulation_date: z.iso.date(),
    salary_cap: z.number().int().nonnegative().safe(),
    payroll: z.number().int().nonnegative().safe(),
    cap_room: z.number().int().nonnegative().safe(),
    roster_count: z.number().int().nonnegative().safe(),
  })
  .strict();

const marketCandidateSchema = z
  .object({
    player_id: z.uuid(),
    first_name: z.string(),
    last_name: z.string(),
    position: z.string(),
    minimum_salary: safeSalarySchema,
    maximum_salary: safeSalarySchema,
  })
  .strict();

const marketOfferBaseSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  owner_id: z.uuid(),
  game_id: z.uuid(),
  player_id: z.uuid(),
  team_id: z.uuid(),
  season: seasonSchema,
  annual_salary: safeSalarySchema,
  years: z.number().int().min(1).max(5).safe(),
  due_date: z.iso.date(),
  created_at: z.iso.datetime({ offset: true }),
  resolved_at: z.iso.datetime({ offset: true }).nullable(),
  resolved_date: z.iso.date().nullable(),
  resolution_reason: z.string().nullable(),
  resolution_detail: z.string().nullable(),
  resolved_contract_id: z.uuid().nullable(),
  offer_origin: z.enum([FREE_AGENCY_OFFER_ORIGIN.HUMAN, FREE_AGENCY_OFFER_ORIGIN.AI]),
  ai_decision_date: z.iso.date().nullable(),
  player_name: z.string(),
  team_name: z.string(),
});

const marketOfferSchema = z
  .discriminatedUnion("status", [
    marketOfferBaseSchema.extend({
      status: z.literal(FREE_AGENCY_MARKET_OFFER_STATUS.PENDING),
      resolved_at: z.null(),
      resolved_date: z.null(),
      resolution_reason: z.null(),
      resolution_detail: z.null(),
      resolved_contract_id: z.null(),
    }),
    marketOfferBaseSchema.extend({
      status: z.literal(FREE_AGENCY_MARKET_OFFER_STATUS.ACCEPTED),
      resolved_at: z.iso.datetime({ offset: true }),
      resolved_date: z.iso.date(),
      resolution_reason: z.literal("selected_offer_accepted"),
      resolution_detail: z.null(),
      resolved_contract_id: z.uuid(),
    }),
    marketOfferBaseSchema.extend({
      status: z.literal(FREE_AGENCY_MARKET_OFFER_STATUS.REJECTED),
      resolved_at: z.iso.datetime({ offset: true }),
      resolved_date: z.iso.date(),
      resolution_reason: z.enum(["another_offer_accepted", "offer_no_longer_legal"]),
      resolution_detail: z.string().min(1).nullable(),
      resolved_contract_id: z.null(),
    }),
  ])
  .superRefine((offer, context) => {
    if (
      (offer.offer_origin === FREE_AGENCY_OFFER_ORIGIN.AI) !==
      (offer.ai_decision_date !== null)
    ) {
      context.addIssue({ code: "custom", message: "AI offers require an AI decision date." });
    }
    if (
      (offer.resolution_reason === "offer_no_longer_legal") !==
      (offer.resolution_detail !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Resolution detail must match the terminal reason.",
      });
    }
  });

const freeMarketBaseSchema = {
  game_id: z.uuid(),
  offers: z.array(marketOfferSchema),
};
const freeAgencyMarketSchema = z.discriminatedUnion("supported", [
  z
    .object({
      ...freeMarketBaseSchema,
      supported: z.literal(true),
      context: marketContextSchema,
      candidates: z.array(marketCandidateSchema),
    })
    .strict(),
  z
    .object({
      ...freeMarketBaseSchema,
      supported: z.literal(false),
      context: z.null(),
      candidates: z.array(marketCandidateSchema).length(0),
    })
    .strict(),
]);

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
    season: seasonSchema,
    annualSalary: safeSalarySchema,
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

  async getMarket(gameId: string): Promise<FreeAgencyMarketSnapshot> {
    const parsedGameId = z.uuid().parse(gameId);
    const { data, error } = await this.client.rpc("get_free_agency_market", {
      p_game_id: parsedGameId,
    });
    if (error) throw new Error(error.message);
    const market = freeAgencyMarketSchema.parse(data);
    if (
      market.game_id !== parsedGameId ||
      market.offers.some((offer) => offer.game_id !== parsedGameId)
    ) {
      throw new Error("Free agency market response contains a foreign game row.");
    }
    return {
      gameId: market.game_id,
      supported: market.supported,
      context: market.context
        ? {
            teamId: market.context.team_id,
            season: market.context.season,
            simulationDate: market.context.simulation_date,
            salaryCap: market.context.salary_cap,
            payroll: market.context.payroll,
            capRoom: market.context.cap_room,
            rosterCount: market.context.roster_count,
          }
        : null,
      candidates: market.candidates.map((candidate) => ({
        playerId: candidate.player_id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        position: candidate.position,
        minimumSalary: candidate.minimum_salary,
        maximumSalary: candidate.maximum_salary,
      })),
      offers: market.offers.map((offer) => ({
        id: offer.id,
        requestId: offer.request_id,
        gameId: offer.game_id,
        playerId: offer.player_id,
        teamId: offer.team_id,
        offer: { season: offer.season, annualSalary: offer.annual_salary, years: offer.years },
        dueDate: offer.due_date,
        status: offer.status,
        origin: offer.offer_origin,
        playerName: offer.player_name,
        teamName: offer.team_name,
        resolvedDate: offer.resolved_date,
        resolutionReason: offer.resolution_reason,
        resolutionDetail: offer.resolution_detail,
        resolvedContractId: offer.resolved_contract_id,
      })),
    };
  }

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

  async submitOffer(input: SubmitFreeAgencyOfferInput): Promise<PendingFreeAgencyOffer> {
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
