export interface PlayerAttributes {
  closeShot: number;
  midRangeShot: number;
  threePointShot: number;
  freeThrow: number;
  drawFoul: number;
  ballHandle: number;
  passAccuracy: number;
  interiorDefense: number;
  perimeterDefense: number;
  steal: number;
  block: number;
  offensiveRebound: number;
  defensiveRebound: number;
  stamina: number;
}

export interface PlayerRatings {
  attributes: PlayerAttributes;
  estimated: boolean;
  overall: number | null;
}
