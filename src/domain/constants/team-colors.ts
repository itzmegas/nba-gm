/**
 * Official team brand colors for the 30 NBA franchises.
 *
 * These values are consumed by `TeamThemeApplier` to scope a per-team CSS
 * variable override via `data-team="<ABBREV>"` on <html>, and by
 * `TeamThemeSelector` to render color swatches. The matching CSS token
 * overrides live in `src/app/globals.css`.
 */

interface TeamBrandColor {
  primary: string;
  secondary: string;
  accent: string;
}

interface TeamMetadata {
  city: string;
  name: string;
  /** Primary brand color, reused for swatch previews in selectors. */
  color: string;
}

export const TEAM_COLORS: Record<string, TeamBrandColor> = Object.freeze({
  ATL: { primary: "#E03A3E", secondary: "#C1D32F", accent: "#26282A" },
  BOS: { primary: "#007A33", secondary: "#BA9653", accent: "#000000" },
  BKN: { primary: "#000000", secondary: "#FFFFFF", accent: "#8C8C8C" },
  CHA: { primary: "#00788C", secondary: "#1D1160", accent: "#BEC0C2" },
  CHI: { primary: "#CE1141", secondary: "#1D1D1D", accent: "#B6BFBF" },
  CLE: { primary: "#860038", secondary: "#FDBB30", accent: "#000000" },
  DAL: { primary: "#00538C", secondary: "#002B5E", accent: "#B8C4CA" },
  DEN: { primary: "#0E2240", secondary: "#FEC524", accent: "#4D90CD" },
  DET: { primary: "#C8102E", secondary: "#1D42BA", accent: "#002D62" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C", accent: "#006BB6" },
  HOU: { primary: "#CE1141", secondary: "#000000", accent: "#C4CED4" },
  IND: { primary: "#002D62", secondary: "#FDBB30", accent: "#B7B7B7" },
  LAC: { primary: "#C8102E", secondary: "#1D428A", accent: "#000000" },
  LAL: { primary: "#552583", secondary: "#FDB927", accent: "#000000" },
  MEM: { primary: "#5D76A9", secondary: "#12173F", accent: "#F5B112" },
  MIA: { primary: "#98002E", secondary: "#F9A01B", accent: "#000000" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6", accent: "#0077C0" },
  MIN: { primary: "#0C2340", secondary: "#236192", accent: "#78BE20" },
  NOP: { primary: "#0C2340", secondary: "#C8102E", accent: "#85714D" },
  NYK: { primary: "#006BB6", secondary: "#F58426", accent: "#B5825C" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24", accent: "#002D62" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4", accent: "#000000" },
  PHI: { primary: "#006BB6", secondary: "#ED174C", accent: "#002B5C" },
  PHX: { primary: "#1D1160", secondary: "#E56020", accent: "#000000" },
  POR: { primary: "#E03A3E", secondary: "#000000", accent: "#B7B7B7" },
  SAC: { primary: "#5A2D81", secondary: "#63727A", accent: "#000000" },
  SAS: { primary: "#000000", secondary: "#C4CED4", accent: "#F9A01B" },
  TOR: { primary: "#CE1141", secondary: "#000000", accent: "#A1A1A4" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B", accent: "#00471B" },
  WAS: { primary: "#002B5C", secondary: "#E31837", accent: "#C4926C" },
});

export const TEAM_METADATA: Record<string, TeamMetadata> = Object.freeze({
  ATL: { city: "Atlanta", name: "Hawks", color: "#E03A3E" },
  BOS: { city: "Boston", name: "Celtics", color: "#007A33" },
  BKN: { city: "Brooklyn", name: "Nets", color: "#000000" },
  CHA: { city: "Charlotte", name: "Hornets", color: "#00788C" },
  CHI: { city: "Chicago", name: "Bulls", color: "#CE1141" },
  CLE: { city: "Cleveland", name: "Cavaliers", color: "#860038" },
  DAL: { city: "Dallas", name: "Mavericks", color: "#00538C" },
  DEN: { city: "Denver", name: "Nuggets", color: "#0E2240" },
  DET: { city: "Detroit", name: "Pistons", color: "#C8102E" },
  GSW: { city: "Golden State", name: "Warriors", color: "#1D428A" },
  HOU: { city: "Houston", name: "Rockets", color: "#CE1141" },
  IND: { city: "Indiana", name: "Pacers", color: "#002D62" },
  LAC: { city: "Los Angeles", name: "Clippers", color: "#C8102E" },
  LAL: { city: "Los Angeles", name: "Lakers", color: "#552583" },
  MEM: { city: "Memphis", name: "Grizzlies", color: "#5D76A9" },
  MIA: { city: "Miami", name: "Heat", color: "#98002E" },
  MIL: { city: "Milwaukee", name: "Bucks", color: "#00471B" },
  MIN: { city: "Minnesota", name: "Timberwolves", color: "#0C2340" },
  NOP: { city: "New Orleans", name: "Pelicans", color: "#0C2340" },
  NYK: { city: "New York", name: "Knicks", color: "#006BB6" },
  OKC: { city: "Oklahoma City", name: "Thunder", color: "#007AC1" },
  ORL: { city: "Orlando", name: "Magic", color: "#0077C0" },
  PHI: { city: "Philadelphia", name: "76ers", color: "#006BB6" },
  PHX: { city: "Phoenix", name: "Suns", color: "#1D1160" },
  POR: { city: "Portland", name: "Trail Blazers", color: "#E03A3E" },
  SAC: { city: "Sacramento", name: "Kings", color: "#5A2D81" },
  SAS: { city: "San Antonio", name: "Spurs", color: "#000000" },
  TOR: { city: "Toronto", name: "Raptors", color: "#CE1141" },
  UTA: { city: "Utah", name: "Jazz", color: "#002B5C" },
  WAS: { city: "Washington", name: "Wizards", color: "#002B5C" },
});

/** Sorted list of team abbreviations for stable, deterministic rendering. */
export const TEAM_ABBREVIATIONS: readonly string[] = Object.freeze(Object.keys(TEAM_COLORS).sort());

/** Type guard: true when the given abbreviation has a known theme. */
export function isKnownTeamAbbreviation(abbreviation: string): boolean {
  return abbreviation in TEAM_COLORS;
}
