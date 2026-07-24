import {
  CAREER_EVENT_KIND,
  CAREER_STAGE,
  type CareerEventEffects,
  type CareerEventKind,
  type CareerStage,
} from "@/domain/entities/CareerSave";
import type { Team } from "@/domain/entities/Team";

export interface CareerEventTemplate {
  kind: CareerEventKind;
  prompt: string;
  appliesTo: CareerStage[];
  options: Array<{ label: string; effects: CareerEventEffects }>;
}

const option = (label: string, overallDelta: number, nextStage?: CareerStage) => ({
  label,
  effects: { overallDelta, ageDelta: 1, ...(nextStage ? { nextStage } : {}) },
});
const event = (
  kind: CareerEventKind,
  prompt: string,
  stage: CareerStage,
  options: CareerEventTemplate["options"]
) => ({ kind, prompt, appliesTo: [stage], options });
export const CAREER_EVENTS: CareerEventTemplate[] = [
  event(
    CAREER_EVENT_KIND.RIVALRY,
    "Rival taunts you before the big game. How do you respond?",
    CAREER_STAGE.COLLEGE,
    [
      option("Match his energy and dominate", 2, CAREER_STAGE.DRAFT),
      option("Stay calm and let your game speak", 1, CAREER_STAGE.DRAFT),
    ]
  ),
  event(
    CAREER_EVENT_KIND.INJURY,
    "A nagging injury tests your preparation. What do you do?",
    CAREER_STAGE.NBA,
    [option("Trust the medical staff", -1), option("Push through the pain", 1)]
  ),
  event(
    CAREER_EVENT_KIND.DECISION,
    "Your coach asks you to change your role for the team.",
    CAREER_STAGE.NBA,
    [option("Embrace the new role", 2), option("Keep your current approach", 0)]
  ),
  event(
    CAREER_EVENT_KIND.RIVALRY,
    "A division rival challenges your place in the league.",
    CAREER_STAGE.NBA,
    [option("Answer on the court", 2), option("Lead by example", 1)]
  ),
];

function hashDjb2(input: string): number {
  return Array.from(input).reduce(
    (hash, char) => ((hash << 5) + hash + char.charCodeAt(0)) | 0,
    5381
  );
}

export function selectEvent(
  saveId: string,
  currentAge: number,
  currentOverall: number,
  stage: CareerStage
): CareerEventTemplate {
  const eligible = CAREER_EVENTS.filter((event) => event.appliesTo.includes(stage));
  if (eligible.length === 0) throw new Error(`No events available for stage: ${stage}`);
  const index = Math.abs(hashDjb2(`${saveId}:${currentAge}:${currentOverall}`)) % eligible.length;
  return eligible[index];
}

export function pickNbaOffers(saveId: string, teams: Team[]): Team[] {
  const uniqueTeams = Array.from(new Map(teams.map((team) => [team.id, team])).values());
  if (uniqueTeams.length < 3) {
    throw new Error(`Need at least 3 unique teams for draft offers, got ${uniqueTeams.length}`);
  }

  const shuffled = [...uniqueTeams];
  let seed = hashDjb2(saveId);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}
