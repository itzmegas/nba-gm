export function franchiseHref(gameId: string, teamId: string, queryString = ""): string {
  const query = new URLSearchParams(queryString);
  query.delete("teamId");
  const suffix = query.toString();
  return `/games/${encodeURIComponent(gameId)}/dashboard/league/teams/${encodeURIComponent(teamId)}${suffix ? `?${suffix}` : ""}`;
}

export function teamsHref(gameId: string, teamId: string, queryString = ""): string {
  const query = new URLSearchParams(queryString);
  query.delete("franchiseTab");
  query.set("teamId", teamId);
  if (query.get("standingsReturn") === "1") {
    query.delete("standingsReturn");
    return `/games/${encodeURIComponent(gameId)}/dashboard/league/standings?${query.toString()}`;
  }
  return `/games/${encodeURIComponent(gameId)}/dashboard/league/teams?${query.toString()}`;
}

export function playerProfileHref(
  gameId: string,
  playerId: string,
  leagueTeamId?: string,
  leagueReturnQuery?: string
): string {
  const query = new URLSearchParams();
  if (leagueTeamId) {
    query.set("leagueTeamId", leagueTeamId);
    if (leagueReturnQuery) query.set("leagueReturnQuery", leagueReturnQuery);
  }
  const suffix = query.toString();
  return `/games/${encodeURIComponent(gameId)}/dashboard/player/${encodeURIComponent(playerId)}${suffix ? `?${suffix}` : ""}`;
}
