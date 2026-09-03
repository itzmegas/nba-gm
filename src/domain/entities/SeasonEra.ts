import { formatSeasonLabel } from "@/domain/entities/Season";

export const SEASON_ERA_IDS = {
  MODERN: "modern",
  LEBRON: "lebron",
  JORDAN: "jordan",
} as const;

export type SeasonEraId = (typeof SEASON_ERA_IDS)[keyof typeof SEASON_ERA_IDS];

export interface SeasonEra {
  id: SeasonEraId;
  name: string;
  description: string;
  seasonYear: number;
  initialSimulationDate: string;
  isHistoricalDatasetAvailable: boolean;
}

export const DEFAULT_SEASON_ERA_ID = SEASON_ERA_IDS.MODERN;

export const SEASON_ERAS = [
  {
    id: SEASON_ERA_IDS.MODERN,
    name: `Current season (${formatSeasonLabel(2026)})`,
    description: "Starts from the canonical 2026-27 preseason dataset.",
    seasonYear: 2026,
    initialSimulationDate: "2026-10-15T00:00:00.000Z",
    isHistoricalDatasetAvailable: false,
  },
  {
    id: SEASON_ERA_IDS.LEBRON,
    name: `Base era LeBron (${formatSeasonLabel(2010)})`,
    description: "Usa rosters reales de 2010-11 con contratos aproximados generados.",
    seasonYear: 2010,
    initialSimulationDate: "2010-10-26T00:00:00.000Z",
    isHistoricalDatasetAvailable: true,
  },
  {
    id: SEASON_ERA_IDS.JORDAN,
    name: `Base era Jordan (${formatSeasonLabel(1995)})`,
    description: "Usa rosters reales de 1995-96 con contratos aproximados generados.",
    seasonYear: 1995,
    initialSimulationDate: "1995-11-03T00:00:00.000Z",
    isHistoricalDatasetAvailable: true,
  },
] as const satisfies readonly SeasonEra[];

export function getSeasonEraById(id: SeasonEraId): SeasonEra {
  const defaultEra = SEASON_ERAS.find((era) => era.id === DEFAULT_SEASON_ERA_ID);

  if (!defaultEra) {
    throw new Error("Default season era is not configured.");
  }

  return SEASON_ERAS.find((era) => era.id === id) ?? defaultEra;
}
