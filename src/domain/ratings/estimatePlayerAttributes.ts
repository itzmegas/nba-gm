import type { PlayerAttributes } from "@/domain/entities/PlayerAttributes";

export const PLAYER_ATTRIBUTE_ESTIMATE_VERSION = "replacement-v1";

// shortcut: replacement-level position profiles, recalibrate against simulated performance later.
const baseline: PlayerAttributes = {
  closeShot: 62,
  midRangeShot: 55,
  threePointShot: 55,
  freeThrow: 65,
  drawFoul: 50,
  ballHandle: 55,
  passAccuracy: 55,
  interiorDefense: 50,
  perimeterDefense: 55,
  steal: 45,
  block: 40,
  offensiveRebound: 40,
  defensiveRebound: 50,
  stamina: 75,
};

const guard: PlayerAttributes = {
  ...baseline,
  threePointShot: 62,
  ballHandle: 66,
  passAccuracy: 65,
  perimeterDefense: 60,
  interiorDefense: 40,
  block: 30,
  offensiveRebound: 30,
};

const big: PlayerAttributes = {
  ...baseline,
  closeShot: 68,
  threePointShot: 35,
  freeThrow: 55,
  ballHandle: 40,
  interiorDefense: 63,
  perimeterDefense: 40,
  block: 60,
  offensiveRebound: 60,
  defensiveRebound: 66,
};

export function estimatePlayerAttributes(
  playerId: string,
  position: string | null
): PlayerAttributes {
  const primary = position?.trim().toUpperCase().split("-")[0] ?? "";
  const profile =
    primary === "C" || primary === "PF" ? big : primary.includes("G") ? guard : baseline;
  const attributes = { ...profile };
  for (const key of Object.keys(attributes) as (keyof PlayerAttributes)[]) {
    let seed = 2_166_136_261;
    for (const character of `${PLAYER_ATTRIBUTE_ESTIMATE_VERSION}:${playerId}:${key}`) {
      seed = Math.imul(seed ^ character.charCodeAt(0), 16_777_619);
    }
    attributes[key] = Math.max(0, Math.min(99, profile[key] + ((seed >>> 0) % 9) - 4));
  }
  return attributes;
}
