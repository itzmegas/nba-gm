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
  experience: z
    .object({ years: z.number().int().nonnegative().max(99) })
    .nullable()
    .optional(),
});

const rosterSchema = z.object({
  status: z.literal("success"),
  athletes: z.array(athleteSchema).min(1),
});

const positionGroupSchema = z.object({
  athletes: z.array(athleteSchema).min(1),
});

const currentWebRosterSchema = z.object({
  positionGroups: z.array(positionGroupSchema).min(1),
});

const webRosterSchema = z.object({
  athletes: z
    .array(z.union([athleteSchema, z.object({ items: z.array(athleteSchema).min(1) })]))
    .min(1),
});

const ESPN_TEAM_SLUGS: Readonly<Record<string, string>> = {
  NOP: "no",
  UTA: "utah",
};

const REQUEST_INTERVAL_MS = 800;
let nextRequestAt = 0;
let legacyProviderDenied = false;

export function resetEspnRosterSourceForTests(): void {
  nextRequestAt = 0;
  legacyProviderDenied = false;
}

function abortError(): DOMException {
  return new DOMException("ESPN roster request aborted", "AbortError");
}

async function waitForRateLimit(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  const now = Date.now();
  const waitMs = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + REQUEST_INTERVAL_MS;

  if (waitMs > 0) {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(abortError());
      };
      const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, waitMs);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

export async function fetchCurrentRosterForTeam(
  team: RosterTeam,
  signal?: AbortSignal
): Promise<RosterEntry[]> {
  await waitForRateLimit(signal);

  const abbreviation = ESPN_TEAM_SLUGS[team.abbreviation] ?? team.abbreviation.toLowerCase();
  const webUrl = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/${encodeURIComponent(abbreviation)}/roster?region=us&lang=en&contentorigin=espn`;
  let response = await fetch(webUrl, {
    headers: { Accept: "application/json", "User-Agent": "nba-gm-roster-refresh/1.0" },
    signal,
  });
  let payload: unknown = await response.json().catch(() => null);
  if (!response.ok && !legacyProviderDenied) {
    const legacyUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${encodeURIComponent(abbreviation)}/roster`;
    response = await fetch(legacyUrl, {
      headers: { Accept: "application/json", "User-Agent": "nba-gm-roster-refresh/1.0" },
      signal,
    });
    payload = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) legacyProviderDenied = true;
  }
  if (!response.ok)
    throw new Error(`ESPN roster API returned ${response.status} for ${team.abbreviation}`);
  const currentWebParsed = currentWebRosterSchema.safeParse(payload);
  const webParsed = webRosterSchema.safeParse(payload);
  const legacyParsed = rosterSchema.safeParse(payload);
  const athletes = currentWebParsed.success
    ? currentWebParsed.data.positionGroups.flatMap((group) => group.athletes)
    : webParsed.success
      ? webParsed.data.athletes.flatMap((group) => ("items" in group ? group.items : [group]))
      : legacyParsed.success
        ? legacyParsed.data.athletes
        : null;
  if (!athletes) {
    throw new Error(`ESPN roster API returned invalid data for ${team.abbreviation}`);
  }

  return athletes.map((athlete) => ({
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
      years_of_experience: athlete.experience?.years ?? null,
    },
  }));
}
