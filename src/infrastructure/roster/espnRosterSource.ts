import { z } from "zod";
import type { RosterEntry, RosterTeam } from "@/application/roster/currentRosterRefresh";

const athleteSchema = z.object({
  id: z.string().regex(/^\d+$/),
  firstName: z.string().min(1),
  lastName: z.string(),
  fullName: z.string().min(1),
  displayHeight: z.string().optional(),
  displayWeight: z.string().optional(),
  jersey: z.string().nullable().optional(),
  position: z.object({ abbreviation: z.string() }).optional(),
});

const rosterSchema = z.object({
  status: z.literal("success"),
  athletes: z.array(athleteSchema).min(1),
});

const ESPN_TEAM_SLUGS: Readonly<Record<string, string>> = {
  NOP: "no",
  UTA: "utah",
};

const REQUEST_INTERVAL_MS = 800;
let nextRequestAt = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + REQUEST_INTERVAL_MS;

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export async function fetchCurrentRosterForTeam(
  team: RosterTeam,
  signal?: AbortSignal
): Promise<RosterEntry[]> {
  await waitForRateLimit();

  const abbreviation = ESPN_TEAM_SLUGS[team.abbreviation] ?? team.abbreviation.toLowerCase();
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${encodeURIComponent(abbreviation)}/roster`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "nba-gm-roster-refresh/1.0" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`ESPN roster API returned ${response.status} for ${team.abbreviation}`);
  }

  const parsed = rosterSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error(`ESPN roster API returned invalid data for ${team.abbreviation}`);
  }

  return parsed.data.athletes.map((athlete) => ({
    provider: "espn",
    sourceId: Number(athlete.id),
    payload: {
      first_name: athlete.firstName,
      last_name: athlete.lastName,
      full_name: athlete.fullName,
      position: athlete.position?.abbreviation ?? null,
      height: athlete.displayHeight ?? null,
      weight: athlete.displayWeight ?? null,
      jersey_number: athlete.jersey ?? null,
    },
  }));
}
