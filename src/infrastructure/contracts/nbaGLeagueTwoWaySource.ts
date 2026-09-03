import { z } from "zod";

export const NBA_G_LEAGUE_TWO_WAY_URL = "https://gleague.nba.com/twowayplayers";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000;

const rowSchema = z.object({
  playerName: z.string().min(1),
  nbaTeamName: z.string().min(1),
  gLeagueAffiliateName: z.string().min(1),
});

export const nbaGLeagueTwoWaySnapshotSchema = z.object({
  sourceUrl: z.literal(NBA_G_LEAGUE_TWO_WAY_URL),
  observedAt: z.iso.datetime(),
  season: z.string().regex(/^\d{4}-\d{2}$/),
  rows: z.array(rowSchema).min(1),
});

export type NbaGLeagueTwoWaySnapshot = z.infer<typeof nbaGLeagueTwoWaySnapshotSchema>;
export const NBA_TEAM_NAME_BY_ABBREVIATION: Readonly<Record<string, string>> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "LA Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};
let cachedSnapshot: { fetchedAt: number; value: NbaGLeagueTwoWaySnapshot } | null = null;

export class NbaGLeagueTwoWaySourceUnavailableError extends Error {
  override readonly name = "NbaGLeagueTwoWaySourceUnavailableError";
}

export function resetNbaGLeagueTwoWayCacheForTests(): void {
  cachedSnapshot = null;
}

function text(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#241;|&ntilde;/gi, "ñ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseNbaGLeagueTwoWayTracker(
  html: string,
  observedAt = new Date()
): NbaGLeagueTwoWaySnapshot {
  const season = text(html).match(/Two-Way Players from the (\d{4}-\d{2}) season/i)?.[1];
  if (!season) throw new Error("NBA G League tracker season was not found");
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      text(cell[1])
    );
    if (cells.length < 3 || cells[0] === "") return [];
    return [{ playerName: cells[0], nbaTeamName: cells[1], gLeagueAffiliateName: cells[2] }];
  });
  return nbaGLeagueTwoWaySnapshotSchema.parse({
    sourceUrl: NBA_G_LEAGUE_TWO_WAY_URL,
    observedAt: observedAt.toISOString(),
    season,
    rows,
  });
}

export async function fetchNbaGLeagueTwoWayTracker(
  signal?: AbortSignal,
  now = Date.now(),
  expectedSeason?: string
): Promise<NbaGLeagueTwoWaySnapshot> {
  if (signal?.aborted) throw abortError();
  const matchesSeason = !expectedSeason || cachedSnapshot?.value.season === expectedSeason;
  if (cachedSnapshot && matchesSeason && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS)
    return cachedSnapshot.value;
  try {
    const response = await fetch(NBA_G_LEAGUE_TWO_WAY_URL, {
      headers: { Accept: "text/html", "User-Agent": "nba-gm-contract-ingestion/1.0" },
      signal,
    });
    if (!response.ok) {
      if (response.status >= 500)
        throw new NbaGLeagueTwoWaySourceUnavailableError(
          `NBA G League tracker returned ${response.status}`
        );
      throw new Error(`NBA G League tracker returned ${response.status}`);
    }
    const value = parseNbaGLeagueTwoWayTracker(await response.text(), new Date(now));
    if (expectedSeason && value.season !== expectedSeason)
      throw new Error(
        `NBA G League tracker season ${value.season} does not match ${expectedSeason}`
      );
    cachedSnapshot = { fetchedAt: now, value };
    return value;
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    const unavailable =
      error instanceof NbaGLeagueTwoWaySourceUnavailableError || error instanceof TypeError;
    if (
      unavailable &&
      cachedSnapshot &&
      matchesSeason &&
      now - cachedSnapshot.fetchedAt <= MAX_STALE_AGE_MS
    )
      return cachedSnapshot.value;
    throw error;
  }
}

function abortError(): DOMException {
  return new DOMException("NBA G League tracker request aborted", "AbortError");
}
