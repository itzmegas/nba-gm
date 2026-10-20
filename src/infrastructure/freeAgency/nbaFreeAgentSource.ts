import { z } from "zod";

const trackerPlayerSchema = z.object({
  season: z.string().regex(/^\d{4}$/u),
  playerId: z.number().int().positive(),
  playerFirstName: z.string().trim().min(1),
  playerLastName: z.string().trim().min(1),
  playerDisplayName: z.string().trim().min(1),
  position: z.string().regex(/^[GFC](?:-[GFC])?$/u),
  exp: z.number().int().min(0).max(99),
  type: z.enum(["ufa", "rfa"]),
  newTeamId: z.string().regex(/^\d+$/u),
  isPlayerOption: z.boolean(),
  isTeamOption: z.boolean(),
  isEarlyTerminationOption: z.boolean(),
  isTwoWayFreeAgent: z.boolean(),
});

export const freeAgentImportSchema = z.object({
  sourceUrl: z.url(),
  fetchedAt: z.iso.datetime(),
  seasonYear: z.literal(2026),
  players: z.array(trackerPlayerSchema).min(1).max(1000),
});

export type FreeAgentImport = z.infer<typeof freeAgentImportSchema>;

export function parseNbaFreeAgentTracker(html: string, fetchedAt: Date): FreeAgentImport {
  const script = /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/u.exec(
    html
  );
  if (!script) throw new Error("NBA free-agent tracker data is missing.");
  const page = z
    .object({ props: z.object({ pageProps: z.object({ players: z.array(trackerPlayerSchema) }) }) })
    .parse(JSON.parse(script[1]));
  const players = page.props.pageProps.players;
  if (players.some((player) => player.season !== "2026")) {
    throw new Error("NBA free-agent tracker returned a different season.");
  }
  if (new Set(players.map((player) => player.playerId)).size !== players.length) {
    throw new Error("NBA free-agent tracker contains duplicate player identities.");
  }
  // NBA's own tracker derives Unsigned from newTeamId; it is not contract absence.
  return freeAgentImportSchema.parse({
    sourceUrl: "https://www.nba.com/players/free-agent-tracker/2026",
    fetchedAt: fetchedAt.toISOString(),
    seasonYear: 2026,
    players,
  });
}

export async function fetchNbaFreeAgentTracker(): Promise<FreeAgentImport> {
  const response = await fetch("https://www.nba.com/players/free-agent-tracker/2026", {
    headers: { Accept: "text/html", "User-Agent": "nba-gm-free-agency/1.0" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`NBA free-agent tracker returned HTTP ${response.status}.`);
  }
  return parseNbaFreeAgentTracker(await response.text(), new Date());
}
