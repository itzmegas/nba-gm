import type { RosterEntry } from "@/application/roster/currentRosterRefresh";

interface NbaStatsResponse {
  resultSets?: Array<{
    headers: string[];
    rowSet: unknown[][];
  }>;
}

export async function fetchCurrentRosterForTeam(
  teamNbaId: number,
  signal?: AbortSignal
): Promise<RosterEntry[]> {
  const season = process.env.NBA_ROSTER_SEASON ?? "2025-26";
  const url = new URL("https://stats.nba.com/stats/commonteamroster");
  url.searchParams.set("LeagueID", "00");
  url.searchParams.set("Season", season);
  url.searchParams.set("TeamID", teamNbaId.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://stats.nba.com/",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`NBA stats API returned ${response.status}`);
  }

  const data = (await response.json()) as NbaStatsResponse;
  const rosterSet = data.resultSets?.find((set) => set.headers.includes("PLAYER_ID"));

  if (!rosterSet) {
    throw new Error("NBA stats API response missing roster data");
  }

  const playerIdIndex = rosterSet.headers.indexOf("PLAYER_ID");

  return rosterSet.rowSet.map((row) => {
    const rawNbaId = row[playerIdIndex];
    const nbaId = typeof rawNbaId === "number" ? rawNbaId : Number(rawNbaId);

    if (!Number.isFinite(nbaId)) {
      throw new Error("NBA stats API returned a non-numeric PLAYER_ID");
    }

    const payload: Record<string, unknown> = {};

    for (let index = 0; index < rosterSet.headers.length; index++) {
      payload[rosterSet.headers[index]] = row[index];
    }

    return { nbaId, payload };
  });
}
