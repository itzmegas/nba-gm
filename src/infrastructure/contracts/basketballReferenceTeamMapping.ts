import { z } from "zod";

const teamMappingSchema = z
  .array(
    z.object({
      nbaAbbreviation: z.string().regex(/^[A-Z]{3}$/),
      basketballReferenceAbbreviation: z.string().regex(/^[A-Z]{3}$/),
    })
  )
  .length(30)
  .superRefine((teams, context) => {
    for (const field of ["nbaAbbreviation", "basketballReferenceAbbreviation"] as const) {
      if (new Set(teams.map((team) => team[field])).size !== 30) {
        context.addIssue({
          code: "custom",
          message: `Expected 30 unique ${field} values`,
        });
      }
    }
  });

const INTERNAL_NBA_TO_BREF_TEAM_MAPPING = [
  { nbaAbbreviation: "ATL", basketballReferenceAbbreviation: "ATL" },
  { nbaAbbreviation: "BKN", basketballReferenceAbbreviation: "BRK" },
  { nbaAbbreviation: "BOS", basketballReferenceAbbreviation: "BOS" },
  { nbaAbbreviation: "CHA", basketballReferenceAbbreviation: "CHO" },
  { nbaAbbreviation: "CHI", basketballReferenceAbbreviation: "CHI" },
  { nbaAbbreviation: "CLE", basketballReferenceAbbreviation: "CLE" },
  { nbaAbbreviation: "DAL", basketballReferenceAbbreviation: "DAL" },
  { nbaAbbreviation: "DEN", basketballReferenceAbbreviation: "DEN" },
  { nbaAbbreviation: "DET", basketballReferenceAbbreviation: "DET" },
  { nbaAbbreviation: "GSW", basketballReferenceAbbreviation: "GSW" },
  { nbaAbbreviation: "HOU", basketballReferenceAbbreviation: "HOU" },
  { nbaAbbreviation: "IND", basketballReferenceAbbreviation: "IND" },
  { nbaAbbreviation: "LAC", basketballReferenceAbbreviation: "LAC" },
  { nbaAbbreviation: "LAL", basketballReferenceAbbreviation: "LAL" },
  { nbaAbbreviation: "MEM", basketballReferenceAbbreviation: "MEM" },
  { nbaAbbreviation: "MIA", basketballReferenceAbbreviation: "MIA" },
  { nbaAbbreviation: "MIL", basketballReferenceAbbreviation: "MIL" },
  { nbaAbbreviation: "MIN", basketballReferenceAbbreviation: "MIN" },
  { nbaAbbreviation: "NOP", basketballReferenceAbbreviation: "NOP" },
  { nbaAbbreviation: "NYK", basketballReferenceAbbreviation: "NYK" },
  { nbaAbbreviation: "OKC", basketballReferenceAbbreviation: "OKC" },
  { nbaAbbreviation: "ORL", basketballReferenceAbbreviation: "ORL" },
  { nbaAbbreviation: "PHI", basketballReferenceAbbreviation: "PHI" },
  { nbaAbbreviation: "PHX", basketballReferenceAbbreviation: "PHO" },
  { nbaAbbreviation: "POR", basketballReferenceAbbreviation: "POR" },
  { nbaAbbreviation: "SAC", basketballReferenceAbbreviation: "SAC" },
  { nbaAbbreviation: "SAS", basketballReferenceAbbreviation: "SAS" },
  { nbaAbbreviation: "TOR", basketballReferenceAbbreviation: "TOR" },
  { nbaAbbreviation: "UTA", basketballReferenceAbbreviation: "UTA" },
  { nbaAbbreviation: "WAS", basketballReferenceAbbreviation: "WAS" },
] as const;

export const NBA_TO_BASKETBALL_REFERENCE_TEAMS = teamMappingSchema.parse(
  INTERNAL_NBA_TO_BREF_TEAM_MAPPING
);

export type BasketballReferenceTeamMapping = (typeof NBA_TO_BASKETBALL_REFERENCE_TEAMS)[number];
