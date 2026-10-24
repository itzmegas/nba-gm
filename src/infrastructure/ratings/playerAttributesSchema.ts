import { z } from "zod";
import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";

const ratingSchema = z.number().int().min(0).max(99);
export const playerAttributesSchema = z.object({
  closeShot: ratingSchema,
  midRangeShot: ratingSchema,
  threePointShot: ratingSchema,
  freeThrow: ratingSchema,
  drawFoul: ratingSchema,
  ballHandle: ratingSchema,
  passAccuracy: ratingSchema,
  interiorDefense: ratingSchema,
  perimeterDefense: ratingSchema,
  steal: ratingSchema,
  block: ratingSchema,
  offensiveRebound: ratingSchema,
  defensiveRebound: ratingSchema,
  stamina: ratingSchema,
}) satisfies z.ZodType<PlayerAttributes>;
