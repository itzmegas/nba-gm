import { z } from "zod";

export const CAREER_STAGE = {
  COLLEGE: "college",
  DRAFT: "draft",
  NBA: "nba",
  RETIRED: "retired",
} as const;
export type CareerStage = (typeof CAREER_STAGE)[keyof typeof CAREER_STAGE];

export const CAREER_POSITION = {
  PG: "PG",
  SG: "SG",
  SF: "SF",
  PF: "PF",
  C: "C",
} as const;
export type CareerPosition = (typeof CAREER_POSITION)[keyof typeof CAREER_POSITION];

export const COLLEGES = ["Duke", "Kentucky", "North Carolina", "Kansas", "UCLA"] as const;
export type College = (typeof COLLEGES)[number];

export const CAREER_EVENT_KIND = {
  RIVALRY: "rivalry",
  INJURY: "injury",
  DECISION: "decision",
} as const;
export type CareerEventKind = (typeof CAREER_EVENT_KIND)[keyof typeof CAREER_EVENT_KIND];

const careerEventEffectsSchema = z.object({
  overallDelta: z.number().int(),
  ageDelta: z.number().int(),
  nextStage: z.enum(CAREER_STAGE).optional(),
  teamId: z.uuid().optional(),
});

export const pendingEventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(CAREER_EVENT_KIND),
  prompt: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        effects: careerEventEffectsSchema,
      })
    )
    .length(2),
});

export const supabaseRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  position: z.enum(CAREER_POSITION),
  college: z.enum(COLLEGES),
  current_age: z.number().int().min(18),
  current_overall: z.number().int().min(40).max(99),
  events_resolved: z.number().int().min(0),
  stage: z.enum(CAREER_STAGE),
  current_team_id: z.uuid().nullable(),
  pending_event: pendingEventSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const careerSaveSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  position: z.enum(CAREER_POSITION),
  college: z.enum(COLLEGES),
  currentAge: z.number().int().min(18),
  currentOverall: z.number().int().min(40).max(99),
  eventsResolved: z.number().int().min(0),
  stage: z.enum(CAREER_STAGE),
  currentTeamId: z.uuid().nullable(),
  pendingEvent: pendingEventSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type CareerEventEffects = z.infer<typeof careerEventEffectsSchema>;
export type PendingCareerEvent = z.infer<typeof pendingEventSchema>;
export type CareerSave = z.infer<typeof careerSaveSchema>;

export const createCareerSaveInputSchema = z.object({
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  position: z.enum(CAREER_POSITION),
  college: z.enum(COLLEGES),
});
export type CreateCareerSaveInput = z.infer<typeof createCareerSaveInputSchema>;

export const resolveEventInputSchema = z.object({
  optionIndex: z.number().int().min(0).max(1),
});
export type ResolveEventInput = z.infer<typeof resolveEventInputSchema>;

export const draftPickInputSchema = z
  .object({
    teamId: z.uuid(),
    offerIds: z.array(z.uuid()).length(3),
  })
  .refine((input) => new Set(input.offerIds).size === input.offerIds.length, {
    message: "offerIds must contain exactly 3 distinct UUIDs",
  });
export type DraftPickInput = z.infer<typeof draftPickInputSchema>;

export function parseSupabaseRow(row: unknown): CareerSave {
  const parsed = supabaseRowSchema.parse(row);
  return careerSaveSchema.parse({
    ...parsed,
    userId: parsed.user_id,
    firstName: parsed.first_name,
    lastName: parsed.last_name,
    currentAge: parsed.current_age,
    currentOverall: parsed.current_overall,
    eventsResolved: parsed.events_resolved,
    currentTeamId: parsed.current_team_id,
    pendingEvent: parsed.pending_event,
    createdAt: new Date(parsed.created_at),
    updatedAt: new Date(parsed.updated_at),
  });
}

export function applyChoice(
  save: CareerSave,
  optionIndex: number
): Pick<CareerSave, "currentAge" | "currentOverall" | "stage" | "currentTeamId"> {
  const event = save.pendingEvent;
  if (!event) throw new Error("No pending event to resolve");
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= event.options.length) {
    throw new Error(`Invalid option index: ${optionIndex}`);
  }

  const effects = event.options[optionIndex].effects;
  return {
    currentAge: save.currentAge + effects.ageDelta,
    currentOverall: Math.max(40, Math.min(99, save.currentOverall + effects.overallDelta)),
    stage: effects.nextStage ?? save.stage,
    currentTeamId: effects.teamId ?? save.currentTeamId,
  };
}
